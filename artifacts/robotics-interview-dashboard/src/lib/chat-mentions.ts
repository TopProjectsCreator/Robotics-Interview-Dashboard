export type ChatMentionToken = {
  token: string;
};

export type ChatMentionPerson = ChatMentionToken & {
  label: string;
  detail: string;
  initials: string;
  kind: "interviewer" | "group" | "assistant" | "applicant";
};

export type ChatObjectKind = "document" | "whiteboard" | "board" | "spreadsheet" | "calendar";

/**
 * A resolvable shared-artifact token pointing at something created in chat
 * (document, Excalidraw whiteboard, task board or spreadsheet). `token` is a
 * chat-safe title (disambiguated on duplicates), or the object's id when
 * mentioned by id. `kind` tells the renderer how to open it; `idToken` is
 * true when `token` is the raw id rather than the title.
 */
export type ChatObjectMention = ChatMentionToken & {
  id: string;
  title: string;
  kind: ChatObjectKind;
  detail: string;
  idToken: boolean;
};

export type ObjectMentionSource = {
  id: string;
  title: string;
  data: string;
};

/**
 * A resolvable `#channel-name` token. `token` is the channel name matched
 * after the `#` trigger (whitespace-normalized); `id` is the stable channel
 * id used for navigation, since names can change.
 */
export type ChatChannelMention = ChatMentionToken & {
  id: string;
  name: string;
  emoji: string | null;
  memberCount: number;
  kind: "channel";
};

type ChatFtcMentionBase = {
  start: number;
  end: number;
  text: string;
  season: number;
};
export type ChatFtcMention =
  | (ChatFtcMentionBase & { kind: "team"; teamNumber: number })
  | (ChatFtcMentionBase & { kind: "event"; eventCode: string });

/**
 * FIRST references use a stable, searchable message token:
 * `@FTC Team <season> <number>` or `@FTC Event <season> <event code>`.
 * The rendered token can stay compact while its season and identifier remain
 * available to every chat participant after reload.
 */
export function findChatFtcMentions(text: string): ChatFtcMention[] {
  const pattern = /(^|[^\p{L}\p{N}_.+-])(@FTC Team (\d{4}) (\d{1,5})|@FTC Event (\d{4}) ([A-Za-z0-9]{3,20}))(?=$|[^\p{L}\p{N}_-])/giu;
  const mentions: ChatFtcMention[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    const token = match[2];
    const start = match.index + match[1].length;
    if (match[3] && match[4]) {
      const season = Number(match[3]);
      const teamNumber = Number(match[4]);
      if (season < 2022 || season > 2100 || teamNumber < 1 || teamNumber > 99999) continue;
      mentions.push({
        kind: "team",
        start,
        end: start + token.length,
        text: token,
        season,
        teamNumber,
      });
    } else if (match[5] && match[6]) {
      const season = Number(match[5]);
      if (season < 2022 || season > 2100) continue;
      mentions.push({
        kind: "event",
        start,
        end: start + token.length,
        text: token,
        season,
        eventCode: match[6],
      });
    }
  }
  return mentions;
}

export type ApplicantMentionSource = {
  id: string;
  name: string;
  grade: string;
  queuePosition: number;
};

export function buildApplicantMentionPeople(
  applicants: readonly ApplicantMentionSource[],
  reservedTokens: readonly string[] = [],
): ChatMentionPerson[] {
  const identityCounts = new Map<string, number>();
  for (const applicant of applicants) {
    const name = applicant.name.trim().replace(/\s+/g, " ").toLowerCase();
    const grade = applicant.grade.trim().replace(/\s+/g, " ").toLowerCase() || "not listed";
    const identity = `${name}\u0000${grade}`;
    identityCounts.set(identity, (identityCounts.get(identity) ?? 0) + 1);
  }

  const usedTokens = new Set(["all", "ai", ...reservedTokens].map(token => token.trim().toLowerCase()));
  return applicants.flatMap(applicant => {
    const label = applicant.name.trim().replace(/\s+/g, " ");
    if (!label) return [];
    const grade = applicant.grade.trim().replace(/\s+/g, " ") || "not listed";
    const identity = `${label.toLowerCase()}\u0000${grade.toLowerCase()}`;
    const baseToken = `Applicant ${label} (Grade ${grade})`;
    const duplicateIdentity = (identityCounts.get(identity) ?? 0) > 1;
    const idTag = applicant.id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "REF";
    let token = duplicateIdentity ? `${baseToken} · Ref ${idTag}` : baseToken;
    let collision = 0;
    while (usedTokens.has(token.toLowerCase())) {
      collision += 1;
      token = `${baseToken} · Ref ${idTag}-${collision}`;
    }
    usedTokens.add(token.toLowerCase());
    const queueDetail = applicant.queuePosition > 0 ? `Queue #${applicant.queuePosition}` : "Not currently queued";
    return [{
      token,
      label,
      detail: `Applicant · Grade ${grade} · ${queueDetail}`,
      initials: label.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase() || "?",
      kind: "applicant" as const,
    }];
  });
}

export type ChannelMentionSource = {
  id: string;
  name: string;
  emoji?: string | null;
  memberCount?: number | null;
};

const OBJECT_KIND_LABELS: Record<ChatObjectKind, string> = {
  document: "Document",
  whiteboard: "Whiteboard",
  board: "Board",
  spreadsheet: "Spreadsheet",
  calendar: "Calendar",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The chat artifacts all live in one table and are told apart by `data.kind`.
 * Plain Excalidraw whiteboards have no `kind`, so absence means whiteboard.
 */
export function objectKindOfData(raw: string | undefined): ChatObjectKind | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return undefined;
    const kind = parsed.kind;
    if (kind === "document" || kind === "board" || kind === "spreadsheet" || kind === "whiteboard" || kind === "calendar") return kind;
    return "whiteboard";
  } catch {
    return undefined;
  }
}

/**
 * Builds the `@`-mention tokens for chat-created artifacts. Each object gets
 * up to two tokens: its whitespace-normalized title (titles shared by two
 * artifacts gain a `· Ref <id6>` suffix, mirroring applicant mentions) and
 * its raw id, so `@the-report` and `@3f2a...` both resolve. Tokens that are
 * ids carry `idToken: true` and are hidden from the picker but still match
 * at render time.
 */
export function buildObjectMentions(
  objects: readonly ObjectMentionSource[],
  reservedTokens: readonly string[] = [],
): ChatObjectMention[] {
  const titleCounts = new Map<string, number>();
  for (const object of objects) {
    const key = object.title.trim().replace(/\s+/g, " ").toLowerCase();
    if (!key) continue;
    titleCounts.set(key, (titleCounts.get(key) ?? 0) + 1);
  }

  const usedTokens = new Set(reservedTokens.map(token => token.trim().toLowerCase()));
  const mentions: ChatObjectMention[] = [];
  for (const object of objects) {
    const title = object.title.trim().replace(/\s+/g, " ");
    const kind = objectKindOfData(object.data);
    if (!title || !kind) continue;
    const titleKey = title.toLowerCase();
    const duplicate = (titleCounts.get(titleKey) ?? 0) > 1;
    const refTag = object.id.replace(/[^a-z0-9]/gi, "").slice(0, 6).toUpperCase() || "REF";
    const baseToken = duplicate ? `${title} · Ref ${refTag}` : title;
    let titleToken = baseToken;
    let collision = 0;
    while (usedTokens.has(titleToken.toLowerCase())) {
      collision += 1;
      titleToken = `${baseToken} · ${refTag}-${collision}`;
    }
    usedTokens.add(titleToken.toLowerCase());
    const detail = `${OBJECT_KIND_LABELS[kind]} · click to open`;
    mentions.push({ token: titleToken, id: object.id, title, kind, detail, idToken: false });
    const idToken = object.id.trim();
    if (idToken && !usedTokens.has(idToken.toLowerCase())) {
      usedTokens.add(idToken.toLowerCase());
      mentions.push({ token: idToken, id: object.id, title, kind, detail, idToken: true });
    }
  }
  return mentions;
}

/**
 * Builds the `#`-mention token list from the channels the signed-in account
 * can access. Tokens are the whitespace-normalized channel names; the server
 * already enforces case-insensitive uniqueness per team, but duplicates are
 * dropped defensively and the first channel wins.
 */
export function buildChannelMentions(
  channels: readonly ChannelMentionSource[],
): ChatChannelMention[] {
  const seen = new Set<string>();
  const mentions: ChatChannelMention[] = [];
  for (const channel of channels) {
    const name = channel.name.trim().replace(/\s+/g, " ");
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mentions.push({
      id: channel.id,
      token: name,
      name,
      emoji: channel.emoji ?? null,
      memberCount: Math.max(0, Math.trunc(channel.memberCount ?? 0)),
      kind: "channel",
    });
  }
  return mentions;
}

export type ChatMentionMatch<T extends ChatMentionToken = ChatMentionPerson> = {
  start: number;
  end: number;
  text: string;
  person: T;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTriggeredMentions<T extends ChatMentionToken>(
  text: string,
  items: readonly T[],
  trigger: "@" | "#",
): ChatMentionMatch<T>[] {
  const uniquePeople = items.filter((person, index, list) =>
    person.token.trim() &&
    list.findIndex(candidate => candidate.token.toLowerCase() === person.token.toLowerCase()) === index,
  );
  if (!uniquePeople.length) return [];

  const alternatives = uniquePeople
    .slice()
    .sort((left, right) => right.token.length - left.token.length)
    .map(person => escapeRegExp(person.token.trim()));
  // `#` needs a stricter preceding boundary than `@`: URL fragments
  // (example.com/spec#general) and query strings are not channel references.
  const precedingBoundary = trigger === "#"
    ? "(^|[^\\p{L}\\p{N}_.+\\-/?&=#%])"
    : "(^|[^\\p{L}\\p{N}_.+\\-])";
  const pattern = new RegExp(
    `${precedingBoundary}${escapeRegExp(trigger)}(${alternatives.join("|")})(?=$|[^\\p{L}\\p{N}_\\-])`,
    "giu",
  );
  const byToken = new Map(uniquePeople.map(person => [person.token.toLowerCase(), person]));
  const matches: ChatMentionMatch<T>[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    const person = byToken.get(match[2].toLowerCase());
    if (!person) continue;
    const start = match.index + match[1].length;
    matches.push({
      start,
      end: match.index + match[0].length,
      text: match[0].slice(match[1].length),
      person,
    });
  }

  return matches;
}

export function findChatMentions<T extends ChatMentionToken>(
  text: string,
  people: readonly T[],
): ChatMentionMatch<T>[] {
  return findTriggeredMentions(text, people, "@");
}

/**
 * Finds `#channel` references in message text. Matching rules mirror
 * `findChatMentions`, including multi-word channel names and longest-match
 * preference, so `#design eng` resolves to a channel named "design eng".
 */
export function findChatChannelMentions<T extends ChatChannelMention>(
  text: string,
  channels: readonly T[],
): ChatMentionMatch<T>[] {
  return findTriggeredMentions(text, channels, "#");
}

/**
 * Finds `@artifact` references (documents, whiteboards, boards, spreadsheets)
 * in message text. Same semantics as `findChatMentions` — titles, `Ref`
 * disambiguators and raw ids all resolve to the same object.
 */
export function findChatObjectMentions<T extends ChatObjectMention>(
  text: string,
  objects: readonly T[],
): ChatMentionMatch<T>[] {
  return findTriggeredMentions(text, objects, "@");
}

export function messageMentionsInterviewer(
  message: string,
  interviewer: string,
  mentionPeople?: readonly ChatMentionPerson[],
): boolean {
  const token = interviewer.trim();
  if (!token) return false;
  const people = mentionPeople ?? [
    { token, label: token, detail: "", initials: "", kind: "interviewer" as const },
    { token: "all", label: "All team members", detail: "", initials: "", kind: "group" as const },
  ];
  return findChatMentions(message, people).some(({ person }) =>
    person.kind === "group" ||
    (person.kind === "interviewer" && person.token.toLowerCase() === token.toLowerCase()),
  );
}