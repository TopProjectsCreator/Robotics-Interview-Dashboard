/**
 * Formatting for the chat-history export (`GET /queue/chat/export`, used by
 * the `/export` composer command). Pure string/date helpers with no database
 * or Express imports so they can be unit-tested in isolation.
 *
 * Deleted messages are always rendered as `[message deleted]` — the same
 * thing every chat client sees on screen — while their `deleted_at`
 * timestamp is preserved so an export never silently drops a row.
 */

export type ChatExportFormat = "csv" | "md" | "txt";

/** One persisted chat message as far as the export is concerned. */
export interface ChatExportRow {
  id: string;
  author: string;
  message: string;
  parentMessageId: string | null;
  editedAt: Date | null;
  deletedAt: Date | null;
  /** Raw stored `activities` JSON array ("[]" when none). */
  activities: string;
  createdAt: Date;
}

export const CHAT_EXPORT_DELETED_PLACEHOLDER = "[message deleted]";

const FORMAT_ALIASES: Record<string, ChatExportFormat> = {
  csv: "csv",
  md: "md",
  markdown: "md",
  txt: "txt",
  text: "txt",
};

/** Accepts the composer/query synonyms for the three formats; null when unknown. */
export function parseChatExportFormat(raw: unknown): ChatExportFormat | null {
  if (typeof raw !== "string") return null;
  return FORMAT_ALIASES[raw.trim().toLowerCase()] ?? null;
}

export const CHAT_EXPORT_CONTENT_TYPES: Record<ChatExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
};

export const CHAT_EXPORT_EXTENSIONS: Record<ChatExportFormat, string> = {
  csv: "csv",
  md: "md",
  txt: "txt",
};

/**
 * Parses the `last` query param. `undefined`/empty means "full history" and
 * returns `null`; a positive safe integer returns the window size; anything
 * else returns the string "invalid" so the caller can 400.
 */
export function parseChatExportLastParam(raw: unknown): number | null | "invalid" {
  if (raw === undefined || raw === null) return null;
  if (Array.isArray(raw)) return "invalid";
  const text = String(raw).trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) return "invalid";
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) return "invalid";
  return value;
}

/** Lowercase filesystem-safe slug for the conversation label; never empty. */
export function sanitizeExportLabel(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return slug || "chat";
}

function compactTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}-${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

/** `chat-export-<label>-<yyyymmdd-hhmmss>.<ext>`, UTC. */
export function chatExportFileName(label: string, format: ChatExportFormat, now: Date): string {
  return `chat-export-${sanitizeExportLabel(label)}-${compactTimestamp(now)}.${CHAT_EXPORT_EXTENSIONS[format]}`;
}

/** `YYYY-MM-DD HH:mm:ss UTC` — unambiguous in every format. */
export function formatExportTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

/** Escapes one CSV cell per RFC 4180 (used with CRLF record separators). */
export function escapeCsvCell(value: string): string {
  const text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export const CHAT_EXPORT_CSV_COLUMNS = [
  "id",
  "created_at",
  "author",
  "parent_message_id",
  "edited_at",
  "deleted_at",
  "activities",
  "message",
] as const;

export function chatExportCsvHeaderLine(): string {
  return CHAT_EXPORT_CSV_COLUMNS.join(",") + "\r\n";
}

function visibleMessage(row: ChatExportRow): string {
  if (row.deletedAt) return CHAT_EXPORT_DELETED_PLACEHOLDER;
  return row.message.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function cleanAuthor(author: string): string {
  return author.replace(/[\r\n]+/g, " ").trim() || "Unknown";
}

/** Parsed activity pills for human-readable formats: ["tool: detail", ...]. */
export function activitySummaries(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const summaries: string[] = [];
    for (const item of parsed.slice(0, 100)) {
      if (!item || typeof item !== "object") continue;
      const tool = (item as { tool?: unknown }).tool;
      const detail = (item as { detail?: unknown }).detail;
      if (typeof tool !== "string" || !tool.trim()) continue;
      const cleanDetail = typeof detail === "string" ? detail.replace(/[\r\n]+/g, " ").trim() : "";
      summaries.push(cleanDetail ? `${tool.trim()}: ${cleanDetail}` : tool.trim());
    }
    return summaries;
  } catch {
    return [];
  }
}

export function rowToCsvLine(row: ChatExportRow): string {
  const cells = [
    row.id,
    row.createdAt.toISOString(),
    cleanAuthor(row.author),
    row.parentMessageId ?? "",
    row.editedAt?.toISOString() ?? "",
    row.deletedAt?.toISOString() ?? "",
    row.activities.trim() || "[]",
    visibleMessage(row),
  ];
  return cells.map(escapeCsvCell).join(",") + "\r\n";
}

function rowMarkers(row: ChatExportRow): string {
  const markers: string[] = [];
  if (row.editedAt) markers.push("edited");
  if (row.deletedAt) markers.push("deleted");
  return markers.length ? ` · ${markers.join(" · ")}` : "";
}

function markdownActivities(row: ChatExportRow): string {
  const summaries = activitySummaries(row.activities);
  if (!summaries.length) return "";
  return summaries.map(summary => `↳ ${summary}`).join("\n") + "\n";
}

/** The block of text for one message in Markdown form (ends with a newline). */
export function rowToMarkdown(row: ChatExportRow): string {
  const lines = [`**${cleanAuthor(row.author)}** · ${formatExportTimestamp(row.createdAt)}${rowMarkers(row)}`, "", visibleMessage(row)];
  const activities = markdownActivities(row);
  if (activities) lines.push(activities.trimEnd());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n") + "\n\n";
}

/** The block of text for one message in plain-text form (ends with a newline). */
export function rowToTxt(row: ChatExportRow): string {
  const lines = [`[${formatExportTimestamp(row.createdAt)}] ${cleanAuthor(row.author)}${rowMarkers(row)}:`, visibleMessage(row)];
  const activities = markdownActivities(row);
  if (activities) lines.push(activities.trimEnd());
  return lines.join("\n") + "\n\n";
}

/** Conversation label for headings/filenames, e.g. "Team chat" or a peer/channel. */
export function chatExportConversationLabel(conversation: {
  scope: string;
  peer: string | null;
  channelName: string | null;
}): string {
  if (conversation.scope === "channel") return conversation.channelName?.trim() || "channel";
  if (conversation.scope === "direct") return conversation.peer?.trim() || "direct";
  return "Team chat";
}

/** Leading bytes every transcript starts with (header block, not per-row). */
export function chatExportHeader(format: ChatExportFormat, label: string, now: Date): string {
  if (format === "csv") return chatExportCsvHeaderLine();
  if (format === "md") {
    return `# Chat export — ${label}\nExported ${formatExportTimestamp(now)}\n\n`;
  }
  return `Chat export — ${label}\nExported ${formatExportTimestamp(now)}\n\n`;
}

/** Per-row chunk writer for the streaming route. */
export function rowToChunk(row: ChatExportRow, format: ChatExportFormat): string {
  if (format === "csv") return rowToCsvLine(row);
  if (format === "md") return rowToMarkdown(row);
  return rowToTxt(row);
}
