// Shared iCal export helpers for the team calendar.
// The server-side importer lives in artifacts/api-server/src/lib/calendarIcal.ts;
// this module builds the downloadable .ics file from the live calendar data so
// "Export as iCal" works client-side even while offline-ish.
export type IcalExportEvent = {
  id: string;
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string;
  assignees: string[];
};

export type ParsedIcalEvent = {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  location: string;
  assignees: string[];
};

export function escapeIcalText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function toIcalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function toIcalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function byteLength(char: string): number {
  const code = char.codePointAt(0) ?? 0;
  if (code < 0x80) return 1;
  if (code < 0x800) return 2;
  if (code < 0x10000) return 3;
  return 4;
}

function foldLine(line: string): string {
  let total = 0;
  for (const char of line) total += byteLength(char);
  if (total <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const charBytes = byteLength(char);
    if (currentBytes + charBytes > 75) {
      chunks.push(current);
      current = ` ${char}`;
      currentBytes = 1 + charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current) chunks.push(current);
  return chunks.join("\r\n");
}

export function buildIcalExport(calendarId: string, title: string, events: IcalExportEvent[]): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Robotics Interview Dashboard//Shared Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(title)}`,
  ];
  const stamp = toIcalDateTime(new Date());
  for (const event of [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime())) {
    const description = [event.description, event.assignees.length ? `Assignees: ${event.assignees.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@${calendarId}`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART${event.allDay ? ";VALUE=DATE" : ""}:${event.allDay ? toIcalDate(event.startAt) : toIcalDateTime(event.startAt)}`);
    lines.push(`DTEND${event.allDay ? ";VALUE=DATE" : ""}:${event.allDay ? toIcalDate(event.endAt) : toIcalDateTime(event.endAt)}`);
    lines.push(`SUMMARY:${escapeIcalText(event.title)}`);
    if (description) lines.push(`DESCRIPTION:${escapeIcalText(description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcalText(event.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export function downloadIcalFile(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- iCal import (files + pasted text) ------------------------------------

const MAX_IMPORTED_EVENTS = 200;
const MAX_RECURRING_INSTANCES = 50;
const RECURRING_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

type IcalLine = { name: string; params: Record<string, string>; value: string };

function unfoldLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines: string[] = [];
  for (const line of normalized.split("\n")) {
    if (/^[ \t]/.test(line) && lines.length) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function parseLine(line: string): IcalLine | null {
  const separator = line.indexOf(":");
  if (separator <= 0) return null;
  const head = line.slice(0, separator);
  const value = line.slice(separator + 1);
  const parts = head.split(";");
  const name = parts[0].toUpperCase();
  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1);
  }
  return { name, params, value };
}

function unescapeIcalText(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\N/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseIcalDate(line: IcalLine): { date: Date; allDay: boolean } | null {
  const value = line.value.trim();
  if (line.params.VALUE === "DATE" || /^\d{8}$/.test(value)) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0));
    return Number.isNaN(date.getTime()) ? null : { date, allDay: true };
  }
  const utc = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    const date = new Date(Date.UTC(Number(utc[1]), Number(utc[2]) - 1, Number(utc[3]), Number(utc[4]), Number(utc[5]), Number(utc[6])));
    return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
  }
  const local = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (local) {
    const date = new Date(Number(local[1]), Number(local[2]) - 1, Number(local[3]), Number(local[4]), Number(local[5]), Number(local[6]));
    return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : { date: parsed, allDay: false };
}

function parseDuration(value: string): number | null {
  const match = value.trim().match(/^([+-])?P(?:(\d+)W|(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?)$/);
  if (!match) return null;
  const days = Number(match[3] ?? 0) + Number(match[2] ?? 0) * 7;
  const ms = ((days * 24 + Number(match[4] ?? 0)) * 60 + Number(match[5] ?? 0)) * 60 * 1000 + Number(match[6] ?? 0) * 1000;
  return match[1] === "-" ? -ms : ms;
}

function advanceByFreq(date: Date, freq: string, interval: number): Date {
  const next = new Date(date.getTime());
  switch (freq) {
    case "DAILY":
      next.setDate(next.getDate() + interval);
      break;
    case "WEEKLY":
      next.setDate(next.getDate() + interval * 7);
      break;
    case "MONTHLY":
      next.setMonth(next.getMonth() + interval);
      break;
    case "YEARLY":
      next.setFullYear(next.getFullYear() + interval);
      break;
    default:
      next.setDate(next.getDate() + interval);
  }
  return next;
}

function expandRecurrence(start: Date, end: Date, rrule: string | undefined): Array<{ start: Date; end: Date }> {
  if (!rrule) return [{ start, end }];
  const parts = new Map<string, string>();
  for (const chunk of rrule.split(";")) {
    const eq = chunk.indexOf("=");
    if (eq > 0) parts.set(chunk.slice(0, eq).toUpperCase(), chunk.slice(eq + 1).toUpperCase());
  }
  const freq = parts.get("FREQ");
  if (!freq) return [{ start, end }];
  const interval = Math.max(1, Math.min(24, Number.parseInt(parts.get("INTERVAL") ?? "1", 10) || 1));
  const count = Number.parseInt(parts.get("COUNT") ?? "", 10);
  const maxCount = Number.isFinite(count) && count > 0 ? Math.min(count, MAX_RECURRING_INSTANCES) : MAX_RECURRING_INSTANCES;
  const untilRaw = parts.get("UNTIL");
  const until = untilRaw ? (/^\d{8}$/.test(untilRaw)
    ? new Date(Date.UTC(Number(untilRaw.slice(0, 4)), Number(untilRaw.slice(4, 6)) - 1, Number(untilRaw.slice(6, 8))))
    : new Date(untilRaw)) : null;
  const windowEnd = start.getTime() + RECURRING_WINDOW_MS;
  const durationMs = end.getTime() - start.getTime();
  const instances: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(start.getTime());
  for (let index = 0; index < maxCount; index += 1) {
    if (cursor.getTime() > windowEnd) break;
    if (until && !Number.isNaN(until.getTime()) && cursor.getTime() > until.getTime()) break;
    instances.push({ start: new Date(cursor.getTime()), end: new Date(cursor.getTime() + durationMs) });
    cursor = advanceByFreq(cursor, freq, interval);
    if (cursor.getTime() === instances[instances.length - 1].start.getTime()) break;
  }
  return instances.length ? instances : [{ start, end }];
}

/**
 * Parse an .ics document (uploaded file or pasted text) into plain events.
 * Mirrors the server importer so pasted/file imports behave identically.
 */
export function parseIcalText(text: string): ParsedIcalEvent[] {
  if (!/BEGIN:VEVENT/i.test(text) || !/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error("No iCal calendar content was found in that text.");
  }
  const events: ParsedIcalEvent[] = [];
  let current: IcalLine[] | null = null;
  for (const rawLine of unfoldLines(text)) {
    const line = parseLine(rawLine);
    if (!line) continue;
    if (line.name === "BEGIN" && line.value.toUpperCase() === "VEVENT") {
      current = [];
      continue;
    }
    if (line.name === "END" && line.value.toUpperCase() === "VEVENT") {
      if (current) {
        events.push(...toImportedEvents(current));
      }
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  if (!events.length) throw new Error("No events were found in that iCal document.");
  if (events.length > MAX_IMPORTED_EVENTS) {
    throw new Error(`That document has too many events (up to ${MAX_IMPORTED_EVENTS} at a time).`);
  }
  return events;
}

function toImportedEvents(lines: IcalLine[]): ParsedIcalEvent[] {
  const props = new Map<string, IcalLine[]>();
  for (const line of lines) {
    const list = props.get(line.name) ?? [];
    list.push(line);
    props.set(line.name, list);
  }
  const title = unescapeIcalText(props.get("SUMMARY")?.[0]?.value ?? "").trim();
  if (!title) return [];
  const startLine = props.get("DTSTART")?.[0];
  if (!startLine) return [];
  const parsedStart = parseIcalDate(startLine);
  if (!parsedStart) return [];
  const endLine = props.get("DTEND")?.[0];
  const durationLine = props.get("DURATION")?.[0];
  const durationMs = durationLine ? parseDuration(durationLine.value) : null;
  let end = new Date(parsedStart.date.getTime() + (parsedStart.allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000));
  if (endLine) {
    const parsedEnd = parseIcalDate(endLine);
    if (parsedEnd) end = parsedEnd.date;
  } else if (durationMs != null && durationMs >= 0) {
    end = new Date(parsedStart.date.getTime() + durationMs);
  }
  if (end.getTime() < parsedStart.date.getTime()) end = new Date(parsedStart.date.getTime());
  const description = unescapeIcalText(props.get("DESCRIPTION")?.[0]?.value ?? "").trim().slice(0, 12_000);
  const location = unescapeIcalText(props.get("LOCATION")?.[0]?.value ?? "").trim().slice(0, 500);
  const assignees: string[] = [];
  for (const attendee of props.get("ATTENDEE") ?? []) {
    const cn = attendee.params.CN ? decodeURIComponent(attendee.params.CN) : "";
    const email = attendee.value.toLowerCase().startsWith("mailto:") ? attendee.value.slice("mailto:".length) : attendee.value;
    const name = (cn || email).trim().slice(0, 80);
    if (name && !assignees.some((item) => item.toLowerCase() === name.toLowerCase())) assignees.push(name);
  }
  const rrule = props.get("RRULE")?.[0]?.value;
  return expandRecurrence(parsedStart.date, end, rrule).map(({ start, end: instanceEnd }) => ({
    title: title.slice(0, 200),
    description,
    location,
    startAt: start,
    endAt: instanceEnd,
    allDay: parsedStart.allDay,
    assignees: assignees.slice(0, 32),
  }));
}

// --- CSV export -----------------------------------------------------------

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildCsvExport(title: string, events: IcalExportEvent[]): string {
  const header = ["Title", "Start", "End", "AllDay", "Location", "Assignees", "Description"];
  const rows = [...events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime()).map((event) => [
    event.title,
    event.startAt.toISOString(),
    event.endAt.toISOString(),
    event.allDay ? "yes" : "no",
    event.location,
    event.assignees.join("; "),
    event.description,
  ]);
  const safeTitle = title.replace(/\r\n/g, "\n");
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n") + `\r\n` + `# ${safeTitle}\r\n`;
}

export function downloadTextFile(filename: string, text: string, mime = "text/plain;charset=utf-8"): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
