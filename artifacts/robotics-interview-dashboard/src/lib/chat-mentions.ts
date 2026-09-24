export type ChatMentionToken = {
  token: string;
};

export type ChatMentionPerson = ChatMentionToken & {
  label: string;
  detail: string;
  initials: string;
  kind: "interviewer" | "group" | "assistant" | "applicant";
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

export type ChatMentionMatch<T extends ChatMentionToken = ChatMentionPerson> = {
  start: number;
  end: number;
  text: string;
  person: T;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findChatMentions<T extends ChatMentionToken>(
  text: string,
  people: readonly T[],
): ChatMentionMatch<T>[] {
  const uniquePeople = people.filter((person, index, list) =>
    person.token.trim() &&
    list.findIndex(candidate => candidate.token.toLowerCase() === person.token.toLowerCase()) === index,
  );
  if (!uniquePeople.length) return [];

  const alternatives = uniquePeople
    .slice()
    .sort((left, right) => right.token.length - left.token.length)
    .map(person => escapeRegExp(person.token.trim()));
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}_.+\\-])@(${alternatives.join("|")})(?=$|[^\\p{L}\\p{N}_\\-])`,
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

export function messageMentionsInterviewer(
  message: string,
  interviewer: string,
  mentionPeople?: readonly ChatMentionPerson[],
): boolean {
  const token = interviewer.trim();
  if (!token) return false;
  const people = mentionPeople ?? [
    { token, label: token, detail: "", initials: "", kind: "interviewer" as const },
    { token: "all", label: "All interviewers", detail: "", initials: "", kind: "group" as const },
  ];
  return findChatMentions(message, people).some(({ person }) =>
    person.kind === "group" ||
    (person.kind === "interviewer" && person.token.toLowerCase() === token.toLowerCase()),
  );
}