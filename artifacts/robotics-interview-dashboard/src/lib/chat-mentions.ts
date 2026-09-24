export type ChatMentionToken = {
  token: string;
};

export type ChatMentionPerson = ChatMentionToken & {
  label: string;
  detail: string;
  initials: string;
  kind: "interviewer" | "group" | "assistant" | "applicant";
};

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