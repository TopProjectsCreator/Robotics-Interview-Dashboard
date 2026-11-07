import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  primaryDb,
  secondaryDb,
  hasSecondary,
  runWithInstance,
  DEFAULT_TEAM_ID,
  maildropInboxesTable,
  ingestedEmailsTable,
  interviewChatMessagesTable,
  type DbInstance,
} from "@workspace/db";
import { logger } from "./logger";
import { pushRealtimeHint } from "./realtime";
import { decryptMaildropApiKey, encryptMaildropApiKey } from "./assistantProviderSecurity";

/**
 * Each team's unique Maildrop mailbox forwards into that team's shared chat.
 * Maildrop mailboxes are temporary, so persisted dedupe records protect chat
 * from repeat polls. Senders match an approved address or a migrated legacy
 * domain rule; all newly added senders are exact email addresses.
 */

const MAILDROP_ENDPOINT = "https://api.maildrop.cc/graphql";
const MAILDROP_TIMEOUT_MS = 15_000;
const MAILDROP_DOMAIN = "maildrop.cc";

export type MaildropMessage = {
  id: string;
  from: string;
  subject: string;
  date: string | null;
  body: string;
};

export type TeamMailboxSettings = {
  teamId: string;
  mailbox: string | null;
  enabled: boolean;
  apiKeyConfigured: boolean;
  allowedSenders: string[];
  legacy: boolean;
};

type StoredMailboxSettings = {
  settings: TeamMailboxSettings;
  encryptedApiKey: string | null;
};

type GraphQLResponse<T> = { data?: T; errors?: { message?: string }[] };

export class MaildropAuthenticationError extends Error {
  constructor() {
    super("Maildrop rejected this team's API key. Replace the key in inbox settings and try again.");
    this.name = "MaildropAuthenticationError";
  }
}

function maildropErrorMessage(payload: GraphQLResponse<unknown>): string {
  const messages = payload.errors?.map((error) => error.message ?? "").join(" ").toLowerCase() ?? "";
  if (/auth|unauthori[sz]ed|forbidden|api.?key|bearer|token/.test(messages)) {
    throw new MaildropAuthenticationError();
  }
  return "Maildrop could not process the inbox request.";
}

async function maildropQuery<T>(
  query: string,
  variables: Record<string, string>,
  apiKey: string,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAILDROP_TIMEOUT_MS);
  try {
    const response = await fetch(MAILDROP_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) throw new MaildropAuthenticationError();
    if (response.status === 429) throw new Error("Maildrop is temporarily rate limiting inbox checks.");
    if (!response.ok) throw new Error("Maildrop is temporarily unavailable.");
    const payload = (await response.json()) as GraphQLResponse<T>;
    if (payload.errors?.length) throw new Error(maildropErrorMessage(payload));
    if (!payload.data) throw new Error("Maildrop returned no inbox data.");
    return payload.data;
  } finally {
    clearTimeout(timer);
  }
}

/** Legacy default-team mailbox configured by the site owner. */
export function maildropMailbox(): string {
  return process.env.MAILDROP_MAILBOX?.trim() ?? "";
}

/** Legacy default-team sender list, retained for the one-time migration. */
export function maildropAllowedSenders(): string[] {
  return normalizeAllowedSenders((process.env.MAILDROP_ALLOWED_SENDERS ?? "").split(","));
}

export function maildropConfigured(): boolean {
  return maildropMailbox().length > 0 && maildropAllowedSenders().length > 0;
}

export function normalizeAllowedSenders(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean))];
}

export function isValidSenderAddress(value: string): boolean {
  return value.length <= 254 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(value);
}

function isValidApprovedSender(value: string): boolean {
  return isValidSenderAddress(value) ||
    /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
}

export function forwardingAddress(mailbox: string): string {
  return `${mailbox}@${MAILDROP_DOMAIN}`;
}

function legacyDefaultSettings(): TeamMailboxSettings {
  const mailbox = maildropMailbox() || null;
  const allowedSenders = maildropAllowedSenders();
  return {
    teamId: DEFAULT_TEAM_ID,
    mailbox,
    enabled: false,
    apiKeyConfigured: false,
    allowedSenders,
    legacy: true,
  };
}

async function storedSettings(teamId: string): Promise<StoredMailboxSettings | null> {
  const [row] = await db.select().from(maildropInboxesTable)
    .where(eq(maildropInboxesTable.teamId, teamId))
    .limit(1);
  return row ? {
    settings: {
      teamId: row.teamId,
      mailbox: row.mailbox,
      enabled: row.enabled && Boolean(row.encryptedApiKey),
      apiKeyConfigured: Boolean(row.encryptedApiKey),
      allowedSenders: normalizeAllowedSenders(row.allowedSenders),
      legacy: false,
    },
    encryptedApiKey: row.encryptedApiKey ?? null,
  } : null;
}

export async function getTeamMailboxSettings(teamId: string): Promise<TeamMailboxSettings> {
  return (await storedSettings(teamId))?.settings ??
    (teamId === DEFAULT_TEAM_ID ? legacyDefaultSettings() : {
      teamId,
      mailbox: null,
      enabled: false,
      apiKeyConfigured: false,
      allowedSenders: [],
      legacy: false,
    });
}

/**
 * Move the previous environment-only default inbox into the primary database.
 * It is safe to run on every boot: a coordinator's saved settings always win.
 */
export async function migrateLegacyDefaultMailbox(): Promise<void> {
  const mailbox = maildropMailbox();
  if (!mailbox) return;
  await primaryDb.insert(maildropInboxesTable).values({
    teamId: DEFAULT_TEAM_ID,
    mailbox,
    enabled: false,
    allowedSenders: maildropAllowedSenders(),
    encryptedApiKey: null,
  }).onConflictDoNothing();
}

export async function saveTeamMailboxSettings(
  teamId: string,
  enabled: boolean,
  allowedSenders: string[],
  apiKey?: string,
  removeApiKey = false,
): Promise<TeamMailboxSettings> {
  const senders = normalizeAllowedSenders(allowedSenders);
  if (senders.some((sender) => !isValidApprovedSender(sender))) {
    throw new TypeError("Enter valid email addresses or domains for approved senders.");
  }
  if (enabled && senders.length === 0) {
    throw new TypeError("Add at least one approved sender before enabling the inbox.");
  }
  if (removeApiKey && apiKey !== undefined) {
    throw new TypeError("Choose whether to replace or remove the Maildrop API key.");
  }
  if (removeApiKey && enabled) {
    throw new TypeError("Disable the inbox before removing its Maildrop API key.");
  }
  const existing = await storedSettings(teamId);
  const inherited = !existing && teamId === DEFAULT_TEAM_ID ? legacyDefaultSettings() : null;
  const mailbox = existing?.settings.mailbox ?? inherited?.mailbox ??
    `robotics-${randomUUID().replaceAll("-", "").slice(0, 20)}`;
  let encryptedApiKey = existing?.encryptedApiKey ?? null;
  if (removeApiKey) {
    encryptedApiKey = null;
  } else if (apiKey !== undefined) {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey || normalizedKey.length > 2048 || /[\u0000-\u001f\u007f]/.test(normalizedKey)) {
      throw new TypeError("Enter a valid Maildrop API key.");
    }
    encryptedApiKey = encryptMaildropApiKey(normalizedKey);
  }
  if (enabled && !encryptedApiKey) {
    throw new TypeError("Save this team's Maildrop API key before enabling the inbox.");
  }
  await db.insert(maildropInboxesTable).values({
    teamId,
    mailbox,
    enabled,
    allowedSenders: senders,
    encryptedApiKey,
  }).onConflictDoUpdate({
    target: maildropInboxesTable.teamId,
    set: { mailbox, enabled, allowedSenders: senders, encryptedApiKey, updatedAt: new Date() },
  });
  return {
    teamId,
    mailbox,
    enabled,
    apiKeyConfigured: Boolean(encryptedApiKey),
    allowedSenders: senders,
    legacy: false,
  };
}

function senderAddress(from: string): string {
  const bracketed = from.match(/<\s*([^<>]+)\s*>/)?.[1];
  const candidate = (bracketed ?? from).trim().replace(/^mailto:/i, "").toLowerCase();
  return isValidSenderAddress(candidate) ? candidate : "";
}

export function senderAllowed(from: string, approvedSenders = maildropAllowedSenders()): boolean {
  const address = senderAddress(from);
  if (!address) return false;
  const approved = normalizeAllowedSenders(approvedSenders);
  const domain = address.slice(address.lastIndexOf("@") + 1);
  return approved.some((entry) => entry.includes("@")
    ? address === entry
    : domain === entry || domain.endsWith(`.${entry}`));
}

/** Lists the messages currently sitting in the mailbox (newest last). */
export async function listMailboxMessages(mailbox: string, apiKey: string): Promise<MaildropMessage[]> {
  const data = await maildropQuery<{ inbox: { id: string; headerfrom?: string | null; subject?: string | null; date?: string | null }[] }>(
    `query Inbox($mailbox: String!) { inbox(mailbox: $mailbox) { id headerfrom subject date } }`,
    { mailbox },
    apiKey,
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
export async function fetchMailboxMessage(mailbox: string, id: string, apiKey: string): Promise<MaildropMessage | null> {
  const data = await maildropQuery<{ message: { id: string; headerfrom?: string | null; subject?: string | null; date?: string | null; data?: string | null; html?: string | null } | null }>(
    `query Message($mailbox: String!, $id: String!) { message(mailbox: $mailbox, id: $id) { id headerfrom subject date data html } }`,
    { mailbox, id },
    apiKey,
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
 * Ingests one team's mailbox only. The database transaction claims each
 * mailbox/message pair before posting, so concurrent pollers cannot duplicate
 * either accepted or rejected messages.
 */
export async function ingestMailboxIntoChat(
  teamId: string,
  providedSettings?: StoredMailboxSettings,
): Promise<{ posted: number; skipped: number; reason?: string }> {
  let stored: StoredMailboxSettings | null;
  try {
    stored = providedSettings ?? await storedSettings(teamId);
  } catch {
    return { posted: 0, skipped: 0, reason: "The saved Maildrop API key could not be read. Replace it in team inbox settings." };
  }
  const settings = stored?.settings;
  const mailbox = settings?.mailbox;
  if (settings?.enabled && !stored?.encryptedApiKey) {
    return { posted: 0, skipped: 0, reason: "Add this team's Maildrop API key in inbox settings before checking." };
  }
  let apiKey: string;
  try {
    if (!stored?.encryptedApiKey) {
      return { posted: 0, skipped: 0, reason: "Add this team's Maildrop API key in inbox settings before checking." };
    }
    apiKey = decryptMaildropApiKey(stored.encryptedApiKey);
  } catch {
    return { posted: 0, skipped: 0, reason: "The saved Maildrop API key could not be read. Replace it in team inbox settings." };
  }
  const allowedSenders = settings?.allowedSenders ?? [];
  if (!settings?.enabled || !mailbox) {
    return { posted: 0, skipped: 0, reason: "Inbox is not enabled" };
  }
  if (!allowedSenders.length) {
    return { posted: 0, skipped: 0, reason: "No approved senders configured" };
  }
  let listed: MaildropMessage[];
  try {
    listed = await listMailboxMessages(mailbox, apiKey);
  } catch (error) {
    const authenticationFailed = error instanceof MaildropAuthenticationError;
    logger.warn({ teamId, failure: authenticationFailed ? "authentication" : "maildrop-request" }, "Could not read the team mailbox");
    return {
      posted: 0,
      skipped: 0,
      reason: authenticationFailed
        ? error.message
        : "Maildrop could not read this team's mailbox. Check the key and try again.",
    };
  }

  let posted = 0;
  let skipped = 0;
  for (const summary of listed) {
    try {
      const approved = senderAllowed(summary.from, allowedSenders);
      const full = approved ? await fetchMailboxMessage(mailbox, summary.id, apiKey) : null;
      const from = (full?.from || summary.from).trim();
      const subject = (full?.subject || summary.subject || "(no subject)").trim();
      const receivedAt = summary.date ? new Date(summary.date) : null;
      const created = await db.transaction(async (tx) => {
        const [claim] = await tx.insert(ingestedEmailsTable).values({
          id: randomUUID(),
          teamId,
          mailbox,
          messageId: summary.id,
          sender: from,
          subject,
          receivedAt,
          postedMessageId: null,
        }).onConflictDoNothing().returning({ id: ingestedEmailsTable.id });
        if (!claim) return false;
        if (!approved) return true;

        const body = (full?.body ?? "").trim();
        const messageText = [
          `**${subject}**`,
          from ? `From: ${from}` : "",
          body || "(no message body)",
        ].filter(Boolean).join("\n").slice(0, CHAT_MESSAGE_MAX_CHARS);
        const [message] = await tx.insert(interviewChatMessagesTable).values({
          id: randomUUID(),
          teamId,
          author: "Team Email",
          message: messageText,
          conversationScope: "shared",
          conversationPeer: null,
          activities: "[]",
        }).returning({ id: interviewChatMessagesTable.id });
        if (message) {
          await tx.update(ingestedEmailsTable)
            .set({ postedMessageId: message.id })
            .where(eq(ingestedEmailsTable.id, claim.id));
        } else {
          throw new Error("The team chat message could not be created");
        }
        return true;
      });
      if (!created || !approved) {
        skipped += 1;
        continue;
      }
      pushRealtimeHint("interview_chat_messages", "INSERT");
      posted += 1;
    } catch (error) {
      if (error instanceof MaildropAuthenticationError) {
        logger.warn({ teamId, failure: "authentication" }, "Maildrop rejected the team's API key");
        return { posted, skipped: skipped + 1, reason: error.message };
      }
      logger.warn({ teamId, messageId: summary.id }, "Could not ingest a team email");
      skipped += 1;
    }
  }
  if (posted) logger.info({ posted, skipped, teamId }, "Posted team email into the chat");
  return { posted, skipped };
}

async function enabledMailboxes(instance: DbInstance): Promise<StoredMailboxSettings[]> {
  const handle = instance === "secondary" ? secondaryDb() : primaryDb;
  if (!handle) return [];
  const rows = await handle.select().from(maildropInboxesTable)
    .where(eq(maildropInboxesTable.enabled, true));
  return rows.filter((row) => Boolean(row.encryptedApiKey)).map((row) => ({
    settings: {
      teamId: row.teamId,
      mailbox: row.mailbox,
      enabled: row.enabled,
      apiKeyConfigured: true,
      allowedSenders: normalizeAllowedSenders(row.allowedSenders),
      legacy: false,
    },
    encryptedApiKey: row.encryptedApiKey,
  }));
}

export async function pollTeamMailboxesOnce(): Promise<void> {
  try {
    await migrateLegacyDefaultMailbox();
  } catch (error) {
    logger.warn({ err: error }, "Could not migrate the legacy default-team mailbox settings");
  }
  const instances: DbInstance[] = ["primary", ...(hasSecondary() ? ["secondary" as const] : [])];
  for (const instance of instances) {
    let mailboxes: StoredMailboxSettings[];
    try {
      mailboxes = await enabledMailboxes(instance);
    } catch (error) {
      logger.warn({ err: error, instance }, "Could not list enabled team inboxes");
      continue;
    }
    for (const settings of mailboxes) {
      await runWithInstance(instance, () => ingestMailboxIntoChat(settings.settings.teamId, settings))
        .catch(() => logger.warn({ teamId: settings.settings.teamId }, "Mailbox poll failed"));
    }
  }
}

let poller: ReturnType<typeof setInterval> | null = null;
let pollInProgress = false;

/** Poll each enabled team mailbox on both configured database instances. */
export function startMailboxPoller(): void {
  if (poller) return;
  const tick = async () => {
    if (pollInProgress) return;
    pollInProgress = true;
    try {
      await pollTeamMailboxesOnce();
    } finally {
      pollInProgress = false;
    }
  };
  void tick();
  poller = setInterval(() => void tick(), 45_000);
  poller.unref?.();
}
