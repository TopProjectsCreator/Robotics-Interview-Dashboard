/**
 * Slash commands available in the team-chat composer.
 *
 * Commands are anchored to the start of the draft (the server parses them
 * from the trimmed message), so the picker only opens while the caret is
 * inside the command name itself — as soon as the user types a space the
 * popup closes and the draft is treated as arguments. The chat composer
 * surfaces this registry Slack/Discord/Google Chat style: type `/` to see
 * what commands exist.
 */
export interface ChatSlashCommand {
  /** Command name without the leading slash, e.g. "multimessage". */
  name: string;
  /** Full usage string shown in the picker row, e.g. "/multimessage [{delayMs}] <count> <message>". */
  usage: string;
  /** One-line description of what the command does. */
  description: string;
  /**
   * Admin-only commands stay visible to everyone (so users know they exist)
   * but are tagged; the server re-checks the role before doing anything.
   */
  adminOnly?: boolean;
}

export const CHAT_SLASH_COMMANDS: readonly ChatSlashCommand[] = [
  {
    name: "multimessage",
    usage: "/multimessage [{delayMs}] <count> <message>",
    description: "Post the same message multiple times, optionally {delayMs} apart — keeps the composer usable while it runs",
    adminOnly: true,
  },
];

export interface SlashCommandTrigger {
  /** Offset of the "/" in the draft. */
  start: number;
  /** Offset just past the command token — the caret position the trigger was measured at. */
  end: number;
  /** Text between "/" and the caret, used to filter the command list. */
  query: string;
}

/**
 * Finds a "/command" trigger immediately before the caret. Only matches at
 * the very start of the draft with no whitespace yet, mirroring how the
 * composer parses commands on send. Returns null once a space is typed
 * (arguments mode) or the draft doesn't start with "/".
 */
export function findSlashCommandTrigger(value: string, caret: number): SlashCommandTrigger | null {
  if (!value.startsWith("/")) return null;
  const position = Math.max(0, Math.min(caret, value.length));
  const before = value.slice(0, position);
  const match = /^\/([^\s/]*)$/.exec(before);
  if (!match) return null;
  return { start: 0, end: position, query: match[1] };
}

/** Filters the registry by the typed query (case-insensitive substring match). */
export function filterSlashCommands(
  query: string,
  commands: readonly ChatSlashCommand[] = CHAT_SLASH_COMMANDS,
): ChatSlashCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...commands];
  return commands.filter(command => command.name.toLowerCase().includes(normalized));
}
