export type ChatMentionToken = {
  token: string;
};

export type ChatMentionPerson = ChatMentionToken & {
  label: string;
  detail: string;
  initials: string;
  kind: "interviewer" | "group" | "assistant" | "applicant";
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