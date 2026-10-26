import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db, ingestedEmailsTable, interviewChatMessagesTable } from "@workspace/db";
import { logger } from "./logger";
import { pushRealtimeHint } from "./realtime";

/**
 * Team inbox by email forwarding.
 *
 * The team's mailbox address forwards into a Maildrop mailbox; this module
 * polls that mailbox over Maildrop's GraphQL API and posts each new email
 * into the team chat, so the team sees email without anyone watching an
 * inbox nobody checks.
 *
 * Two properties matter:
 * - Maildrop mailboxes are temporary (they keep a handful of messages and
 *   forget them), so ingestion happens promptly and every message is
 *   recorded in `ingested_emails` so it is never posted twice.
 * - Anyone who guesses the mailbox name can post INTO it, so messages are
 * only accepted from senders on the allow list. Without an allow list
 * nothing is posted, rather than posting anything that arrives.
 */

const MAILDROP_ENDPOINT = "https://api.maildrop.cc/graphql";
const MAILDROP_TIMEOUT_MS = 15_000;

export type MaildropMessage = {
  id: string;
  from: string;
  subject: string;
  date: string | null;
  body: string;
};

type GraphQLResponse<T> = { data?: T; errors?: { message?: string }[] };

async function maildropQuery<T>(query: string, variables: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAILDROP_TIMEOUT_MS);
  try {
    const response = await fetch(MAILDROP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Maildrop responded ${response.status}`);
    }
    const payload = (await response.json()) as GraphQLResponse<T>;
    if (payload.errors?.length) {
      throw new Error(payload.errors.map((error) => error.message ?? "unknown").join("; "));
    }
    if (!payload.data) throw new Error("Maildrop returned no data");
    return payload.data;
  } finally {
    clearTimeout(timer);
  }
}

/** Mailbox name configured for this deployment (empty when not set up). */
export function maildropMailbox(): string {
  return process.env.MAILDROP_MAILBOX?.trim() ?? "";
}

/**
 * Senders allowed to post into the team chat through the inbox. Empty means
 * "post nothing": an open mailbox would otherwise let any stranger inject
 * messages into the team's chat.
 */
export function maildropAllowedSenders(): string[] {
  return (process.env.MAILDROP_ALLOWED_SENDERS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function maildropConfigured(): boolean {
  return maildropMailbox().length > 0 && maildropAllowedSenders().length > 0;
}

export function senderAllowed(from: string): boolean {
  const allowed = maildropAllowedSenders();
  if (!allowed.length) return false;
  const address = (from.match(/<([^>]+)>/)?.[1] ?? from).trim().toLowerCase();
  return allowed.some((entry) => address === entry || address.endsWith(`@${entry}`) || from.toLowerCase().includes(entry));
}

/** Lists the messages currently sitting in the mailbox (newest last). */
export async function listMailboxMessages(mailbox: string): Promise<MaildropMessage[]> {
  const data = await maildropQuery<{ inbox: { id: string; headerfrom?: string | null; subject?: string | null; date?: string | null }[] }>(
    `query Inbox($mailbox: String!) { inbox(mailbox: $mailbox) { id headerfrom subject date } }`,
    { mailbox },
  );
  return (data.inbox ?? []).map((message) => ({
    id: String(message.id),
    from: String(message.headerfrom ?? ""),
    subject: String(message.subject ?? ""),
    date: message.date ? new Date(message.date).toISOString() : null,
    body: "",
  }));
}

/** Fetches one message with its body text. */
export async function fetchMailboxMessage(mailbox: string, id: string): Promise<MaildropMessage | null> {
  const data = await maildropQuery<{ message: { id: string; headerfrom?: string | null; subject?: string | null; date?: string | null; data?: string | null; html?: string | null } | null }>(
    `query Message($mailbox: String!, $id: String!) { message(mailbox: $mailbox, id: $id) { id headerfrom subject date data html } }`,
    { mailbox, id },
  );
  const message = data.message;
  if (!message) return null;
  return {
    id: String(message.id),
    from: String(message.headerfrom ?? ""),
    subject: String(message.subject ?? ""),
    date: message.date ? new Date(message.date).toISOString() : null,
    body: plainText(message.data ?? "", message.html ?? ""),
  };
}

/** Keeps the readable part of an email: plain text when present, else HTML. */
function plainText(data: string, html: string): string {
  const text = data.replace(/\r\n/g, "\n").trim();
  if (text) return text;
  if (!html) return "";
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h\d)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const CHAT_MESSAGE_MAX_CHARS = 2000;

/**
 * Posts new mailbox messages into the team chat. Returns how many were
 * posted. Safe to call often: already-ingested messages are skipped.
 */
export async function ingestMailboxIntoChat(teamId: string): Promise<{ posted: number; skipped: number; reason?: string }> {
  const mailbox = maildropMailbox();
  if (!mailbox) return { posted: 0, skipped: 0, reason: "No mailbox configured" };
  if (!maildropAllowedSenders().length) {
    return { posted: 0, skipped: 0, reason: "No allowed senders configured" };
  }
  let listed: MaildropMessage[];
  try {
    listed = await listMailboxMessages(mailbox);
  } catch (error) {
    logger.warn({ err: error }, "Could not read the team mailbox");
    return { posted: 0, skipped: 0, reason: "Mailbox unreachable" };
  }
  let posted = 0;
  let skipped = 0;
  for (const summary of listed) {
    const [seen] = await db.select({ id: ingestedEmailsTable.id })
      .from(ingestedEmailsTable)
      .where(and(eq(ingestedEmailsTable.mailbox, mailbox), eq(ingestedEmailsTable.messageId, summary.id)))
      .limit(1);
    if (seen) {
      skipped += 1;
      continue;
    }
    if (!senderAllowed(summary.from)) {
      // Not from an allowed sender: record it so it is not re-examined, but
      // do not put it in front of the team.
      await db.insert(ingestedEmailsTable).values({
        id: randomUUID(),
        teamId,
        mailbox,
        messageId: summary.id,
        sender: summary.from,
        subject: summary.subject,
        receivedAt: summary.date ? new Date(summary.date) : null,
        postedMessageId: null,
      }).onConflictDoNothing();
      skipped += 1;
      continue;
    }
    const full = await fetchMailboxMessage(mailbox, summary.id).catch(() => null);
    const body = (full?.body ?? "").trim();
    const subject = (full?.subject || summary.subject || "(no subject)").trim();
    const from = (full?.from || summary.from).trim();
    const text = [
      `**${subject}**`,
      from ? `From: ${from}` : "",
      body || "(no message body)",
    ].filter(Boolean).join("\n").slice(0, CHAT_MESSAGE_MAX_CHARS);
    const [message] = await db.insert(interviewChatMessagesTable).values({
      id: randomUUID(),
      teamId,
      author: "Team Email",
      message: text,
      conversationScope: "shared",
      conversationPeer: null,
      activities: "[]",
    }).returning();
    await db.insert(ingestedEmailsTable).values({
      id: randomUUID(),
      teamId,
      mailbox,
      messageId: summary.id,
      sender: from,
      subject,
      postedMessageId: message?.id ?? null,
      receivedAt: summary.date ? new Date(summary.date) : null,
    }).onConflictDoNothing();
    pushRealtimeHint("interview_chat_messages", "INSERT");
    posted += 1;
  }
  if (posted) logger.info({ posted, skipped }, "Posted team email into the chat");
  return { posted, skipped };
}

let poller: ReturnType<typeof setInterval> | null = null;

/**
 * Starts the inbox poller. Maildrop is rate limited (a query every ten
 * seconds or so is plenty) and only holds a few messages, so the poll
 * interval is short enough to catch mail before the mailbox forgets it.
 */
export function startMailboxPoller(teamId: string): void {
  if (poller) return;
  if (!maildropConfigured()) {
    logger.info("Team inbox not configured; skipping the mailbox poller");
    return;
  }
  const tick = () => {
    void ingestMailboxIntoChat(teamId).catch((error) => {
      logger.warn({ err: error }, "Mailbox poll failed");
    });
  };
  tick();
  poller = setInterval(tick, 45_000);
  poller.unref?.();
}
