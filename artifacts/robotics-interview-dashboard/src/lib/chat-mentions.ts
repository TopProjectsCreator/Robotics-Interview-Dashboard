export type ChatMentionToken = {
  token: string;
};

export type ChatMentionPerson = ChatMentionToken & {
  label: string;
  detail: string;
  initials: string;
  kind: "interviewer" | "group" | "assistant";
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

export function messageMentionsInterviewer(message: string, interviewer: string): boolean {
  const token = interviewer.trim();
  return token.length > 0 && findChatMentions(message, [{ token }, { token: "all" }]).length > 0;
}