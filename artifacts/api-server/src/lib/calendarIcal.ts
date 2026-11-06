import type { CalendarData } from "@workspace/api-zod";
import type { ImportedCalendarEvent } from "./calendarOperations";

export const ICAL_FEED_LIMIT_BYTES = 2 * 1024 * 1024;
export const ICAL_FETCH_TIMEOUT_MS = 10_000;
const MAX_FEED_EVENTS = 2_000;
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

export function unescapeIcalText(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\N/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

export function escapeIcalText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
}

function parseIcalDate(line: IcalLine): { date: Date; allDay: boolean } | null {
  const value = line.value.trim();
  if (line.params.VALUE === "DATE" || /^\d{8}$/.test(value)) {
    const match = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (!match) return null;
    const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return Number.isNaN(date.getTime()) ? null : { date, allDay: true };
  }
  const utc = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (utc) {
    const date = new Date(Date.UTC(Number(utc[1]), Number(utc[2]) - 1, Number(utc[3]), Number(utc[4]), Number(utc[5]), Number(utc[6])));
    return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
  }
  const local = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (local) {
    // Floating (and TZID) times have no offset: read them as server-local.
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

export function parseIcalFeed(text: string): ImportedCalendarEvent[] {
  if (!/BEGIN:VEVENT/i.test(text) || !/BEGIN:VCALENDAR/i.test(text)) {
    throw new Error("No iCal calendar content was found.");
  }
  const events: ImportedCalendarEvent[] = [];
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
        const parsed = toImportedEvent(current);
        if (parsed) events.push(...parsed);
      }
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  if (events.length > MAX_FEED_EVENTS) {
    throw new Error(`That feed has too many events (up to ${MAX_FEED_EVENTS}).`);
  }
  return events;
}

function toImportedEvent(lines: IcalLine[]): ImportedCalendarEvent[] | null {
  const props = new Map<string, IcalLine[]>();
  for (const line of lines) {
    const list = props.get(line.name) ?? [];
    list.push(line);
    props.set(line.name, list);
  }
  const title = unescapeIcalText(props.get("SUMMARY")?.[0]?.value ?? "").trim();
  if (!title) return null;
  const startLine = props.get("DTSTART")?.[0];
  if (!startLine) return null;
  const parsedStart = parseIcalDate(startLine);
  if (!parsedStart) return null;
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

function isBlockedFeedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host === "::1" || host === "0.0.0.0" || host.endsWith(".localhost")) return true;
  if (/^127\./.test(host) || /^0\./.test(host) || host === "169.254.169.254" || /^169\.254\./.test(host)) return true;
  if (/^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
}

export async function fetchIcalFeed(url: string, fetchFn: typeof fetch = fetch): Promise<ImportedCalendarEvent[]> {
  const trimmed = url.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("That feed URL is not valid.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Feed URLs must start with http:// or https://.");
  }
  if (isBlockedFeedHost(parsed.hostname)) {
    throw new Error("That feed address cannot be used.");
  }
  if (trimmed.length > 2_048) throw new Error("Feed URLs must be 2048 characters or fewer.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ICAL_FETCH_TIMEOUT_MS);
  try {
    const response = await fetchFn(trimmed, {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "text/calendar, text/x-calendar, text/plain;q=0.8" },
    });
    if (!response.ok) throw new Error(`The feed returned ${response.status}.`);
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (Number.isFinite(declared) && declared > ICAL_FEED_LIMIT_BYTES) {
      throw new Error("That feed is too large to import.");
    }
    const text = await response.text();
    if (Buffer.byteLength(text, "utf8") > ICAL_FEED_LIMIT_BYTES) {
      throw new Error("That feed is too large to import.");
    }
    const events = parseIcalFeed(text);
    if (!events.length) throw new Error("No events were found in that feed.");
    return events;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("That feed took too long to load.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function toIcalDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function toIcalDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`;
}

function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  const limit = 75;
  for (const char of line) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (currentBytes + charBytes > limit) {
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

export function buildIcalFeed(calendarId: string, title: string, data: CalendarData): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Robotics Interview Dashboard//Shared Calendar//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcalText(title)}`,
  ];
  const now = toIcalDateTime(new Date());
  const events = [...data.events].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  for (const event of events) {
    const description = [event.description, event.assignees.length ? `Assignees: ${event.assignees.join(", ")}` : ""]
      .filter(Boolean)
      .join("\n");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@${calendarId}`);
    lines.push(`DTSTAMP:${now}`);
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
