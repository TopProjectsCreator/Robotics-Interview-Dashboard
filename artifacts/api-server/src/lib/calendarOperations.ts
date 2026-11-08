import { randomUUID } from "node:crypto";
import type {
  CalendarData,
  CalendarEventInput,
  CalendarEventPatch,
  CalendarOperationInput,
} from "@workspace/api-zod";

const MAX_EVENTS = 2_000;
const MAX_FEEDS = 50;
const MAX_EVENT_TITLE = 200;
const MAX_EVENT_DESCRIPTION = 12_000;
const MAX_LOCATION = 500;
const MAX_ASSIGNEES = 32;
const MAX_ASSIGNEE = 80;
const MAX_CALENDAR_DESCRIPTION = 500;
const MAX_FEED_NAME = 80;
const MAX_FEED_URL = 2_048;
const MAX_CALENDAR_TITLE = 120;
const DEFAULT_CALENDAR_DESCRIPTION =
  "Team events, interviews, and deadlines. Everyone can add or update events; external iCal feeds stay attached below.";
export const DEFAULT_CALENDAR_COLOR = "#16869a";
export const CALENDAR_COLORS = [
  "#16869a",
  "#f8c84a",
  "#707fd0",
  "#d35d68",
  "#429276",
  "#a75bc2",
  "#70859a",
  "#e08a3c",
] as const;

type OperationResult =
  | { ok: true; data: CalendarData; title?: string }
  | { ok: false; status: number; error: string };

export type ImportedCalendarEvent = {
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  allDay: boolean;
  assignees: string[];
};

export type ApplyCalendarOptions = {
  now?: Date;
  importedEvents?: ImportedCalendarEvent[];
  feedError?: string;
};

function fail(error: string, status = 400): OperationResult {
  return { ok: false, error, status };
}

function normalizeColor(value: string | null | undefined): { color?: string; error?: string } {
  const normalized = value?.trim();
  if (!normalized) return { color: DEFAULT_CALENDAR_COLOR };
  if (!/^#[0-9a-fA-F]{3}$/.test(normalized) && !/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return { error: "Choose a valid color." };
  }
  return { color: normalized.toLowerCase() };
}

function normalizeAssignees(value: string[] | undefined): { assignees?: string[]; error?: string } {
  const seen = new Set<string>();
  const assignees: string[] = [];
  for (const raw of value ?? []) {
    const name = raw.trim().slice(0, MAX_ASSIGNEE);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    assignees.push(name);
  }
  if (assignees.length > MAX_ASSIGNEES) {
    return { error: `An event can have up to ${MAX_ASSIGNEES} assignees.` };
  }
  return { assignees };
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

type NormalizedEvent = CalendarData["events"][number];

function normalizeEvent(
  input: CalendarEventInput | (Partial<CalendarEventInput> & { title: string; startAt: string | Date }),
  feedId: string | null,
  now: Date,
): { event?: NormalizedEvent; error?: string } {
  const title = input.title?.trim();
  if (!title) return { error: "Event names cannot be empty." };
  if (title.length > MAX_EVENT_TITLE) return { error: `Event names must be ${MAX_EVENT_TITLE} characters or fewer.` };
  const description = (input.description ?? "").trim().slice(0, MAX_EVENT_DESCRIPTION);
  const location = (input.location ?? "").trim().slice(0, MAX_LOCATION);
  const startAt = toDate(input.startAt);
  if (!startAt) return { error: "Choose a valid start time." };
  const allDay = Boolean(input.allDay);
  let endAt = toDate(input.endAt);
  if (!endAt) {
    endAt = new Date(startAt.getTime() + (allDay ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000));
  }
  if (endAt.getTime() < startAt.getTime()) {
    return { error: "The end time must be on or after the start time." };
  }
  const color = normalizeColor(input.color);
  if (color.error || !color.color) return { error: color.error ?? "Choose a valid color." };
  const assignees = normalizeAssignees(input.assignees);
  if (assignees.error || !assignees.assignees) return { error: assignees.error ?? "Invalid assignees." };
  return {
    event: {
      id: randomUUID(),
      title,
      description,
      startAt,
      endAt,
      allDay,
      location,
      assignees: assignees.assignees,
      color: color.color,
      feedId,
      createdAt: now,
      updatedAt: now,
      updatedBy: "",
    },
  };
}

function patchEvent(
  existing: NormalizedEvent,
  patch: CalendarEventPatch,
): { event?: NormalizedEvent; error?: string } {
  const nextInput: CalendarEventInput = {
    title: patch.title ?? existing.title,
    description: patch.description ?? existing.description,
    startAt: patch.startAt ?? existing.startAt,
    endAt: patch.endAt ?? existing.endAt,
    allDay: patch.allDay ?? existing.allDay,
    location: patch.location ?? existing.location,
    assignees: patch.assignees ?? existing.assignees,
    color: patch.color ?? existing.color,
  };
  const normalized = normalizeEvent(nextInput, existing.feedId, existing.createdAt);
  if (normalized.error || !normalized.event) return { error: normalized.error ?? "Event details are invalid." };
  return {
    event: {
      ...normalized.event,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
      updatedBy: "",
    },
  };
}

export function initialCalendarData(): CalendarData {
  return {
    kind: "calendar",
    version: 1,
    description: DEFAULT_CALENDAR_DESCRIPTION,
    events: [],
    feeds: [],
  };
}

export function parseCalendarData(raw: string): CalendarData | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (
      candidate.kind !== "calendar" ||
      candidate.version !== 1 ||
      !Array.isArray(candidate.events) ||
      !Array.isArray(candidate.feeds) ||
      candidate.events.length > MAX_EVENTS ||
      candidate.feeds.length > MAX_FEEDS
    ) {
      return null;
    }
    const description =
      candidate.description === undefined ? DEFAULT_CALENDAR_DESCRIPTION : candidate.description;
    if (typeof description !== "string" || description.length > MAX_CALENDAR_DESCRIPTION) return null;
    const feeds: CalendarData["feeds"] = [];
    for (const value of candidate.feeds as unknown[]) {
      if (!value || typeof value !== "object") return null;
      const feed = value as Record<string, unknown>;
      const lastFetchedAt = feed.lastFetchedAt == null ? null : new Date(feed.lastFetchedAt as string | Date);
      if (
        typeof feed.id !== "string" ||
        typeof feed.name !== "string" ||
        typeof feed.url !== "string" ||
        typeof feed.color !== "string" ||
        (feed.lastFetchedAt != null && (!lastFetchedAt || Number.isNaN(lastFetchedAt.getTime()))) ||
        (feed.lastError != null && typeof feed.lastError !== "string")
      ) {
        return null;
      }
      feeds.push({
        id: feed.id,
        name: feed.name,
        url: feed.url,
        color: feed.color,
        lastFetchedAt: lastFetchedAt ?? null,
        lastError: typeof feed.lastError === "string" ? feed.lastError : null,
      });
    }
    const events: CalendarData["events"] = [];
    for (const value of candidate.events as unknown[]) {
      if (!value || typeof value !== "object") return null;
      const event = value as Record<string, unknown>;
      const startAt = toDate(event.startAt as string | Date);
      const endAt = toDate(event.endAt as string | Date);
      const createdAt = new Date(event.createdAt as string | Date);
      const updatedAt = new Date(event.updatedAt as string | Date);
      if (
        typeof event.id !== "string" ||
        typeof event.title !== "string" ||
        typeof event.description !== "string" ||
        !startAt ||
        !endAt ||
        endAt.getTime() < startAt.getTime() ||
        typeof event.allDay !== "boolean" ||
        typeof event.location !== "string" ||
        !Array.isArray(event.assignees) ||
        !(event.assignees as unknown[]).every((name) => typeof name === "string") ||
        typeof event.color !== "string" ||
        (event.feedId != null && typeof event.feedId !== "string") ||
        Number.isNaN(createdAt.getTime()) ||
        Number.isNaN(updatedAt.getTime()) ||
        typeof event.updatedBy !== "string"
      ) {
        return null;
      }
      events.push({
        id: event.id,
        title: event.title,
        description: event.description,
        startAt,
        endAt,
        allDay: event.allDay,
        location: event.location,
        assignees: event.assignees as string[],
        color: event.color,
        feedId: typeof event.feedId === "string" ? event.feedId : null,
        createdAt,
        updatedAt,
        updatedBy: event.updatedBy,
      });
    }
    return { kind: "calendar", version: 1, description, events, feeds };
  } catch {
    return null;
  }
}

function importedToEvent(event: ImportedCalendarEvent, feedId: string, now: Date): NormalizedEvent {
  return {
    id: randomUUID(),
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    assignees: event.assignees,
    color: DEFAULT_CALENDAR_COLOR,
    feedId,
    createdAt: now,
    updatedAt: now,
    updatedBy: "iCal feed",
  };
}

export function applyCalendarOperation(
  current: CalendarData,
  operation: CalendarOperationInput,
  actor: string,
  options: ApplyCalendarOptions = {},
): OperationResult {
  const now = options.now ?? new Date();
  const data: CalendarData = {
    ...current,
    events: [...current.events],
    feeds: [...current.feeds],
  };

  switch (operation.operation) {
    case "rename_calendar": {
      const title = operation.title === undefined ? undefined : operation.title.trim();
      if (operation.title !== undefined && !title) return fail("Calendar name cannot be empty.");
      if (title && title.length > MAX_CALENDAR_TITLE) return fail("Calendar names must be 120 characters or fewer.");
      if (operation.title === undefined && operation.description === undefined) {
        return fail("Choose a calendar name or description to update.");
      }
      const description = operation.description === undefined ? data.description : operation.description.trim();
      if (description.length > MAX_CALENDAR_DESCRIPTION) {
        return fail("Calendar descriptions must be 500 characters or fewer.");
      }
      return { ok: true, data: { ...data, description }, ...(title ? { title } : {}) };
    }

    case "create_event": {
      if (!operation.event) return fail("Event details are required.");
      if (data.events.length >= MAX_EVENTS) return fail(`This calendar has reached the ${MAX_EVENTS.toLocaleString()}-event limit.`, 413);
      const normalized = normalizeEvent(operation.event, null, now);
      if (normalized.error || !normalized.event) return fail(normalized.error ?? "Event details are invalid.");
      normalized.event.updatedBy = actor;
      data.events.push(normalized.event);
      return { ok: true, data };
    }

    case "update_event": {
      if (!operation.eventId || !operation.eventPatch) return fail("Event details are required.");
      const existing = data.events.find((event) => event.id === operation.eventId);
      if (!existing) return fail("Event not found.", 404);
      if (!Object.keys(operation.eventPatch).length) return fail("Choose at least one field to update.");
      const patched = patchEvent(existing, operation.eventPatch);
      if (patched.error || !patched.event) return fail(patched.error ?? "Event details are invalid.");
      patched.event.updatedBy = actor;
      patched.event.updatedAt = now;
      data.events = data.events.map((event) => (event.id === existing.id ? patched.event! : event));
      return { ok: true, data };
    }

    case "delete_event": {
      if (!operation.eventId) return fail("Choose an event to delete.");
      const existing = data.events.find((event) => event.id === operation.eventId);
      if (!existing) return fail("Event not found.", 404);
      data.events = data.events.filter((event) => event.id !== existing.id);
      return { ok: true, data };
    }

    case "add_ical_feed": {
      const url = operation.feedUrl?.trim();
      if (!url) return fail("Paste the iCal feed URL first.");
      if (url.length > MAX_FEED_URL) return fail("Feed URLs must be 2048 characters or fewer.");
      if (!/^https?:\/\//i.test(url)) return fail("Feed URLs must start with http:// or https://.");
      if (data.feeds.some((feed) => feed.url === url)) return fail("That feed is already subscribed.", 409);
      if (data.feeds.length >= MAX_FEEDS) return fail(`This calendar can follow up to ${MAX_FEEDS} feeds.`, 413);
      if (options.importedEvents === undefined) return fail("The feed could not be read yet. Try again.");
      const name = operation.feedName?.trim().slice(0, MAX_FEED_NAME) || url;
      const color = normalizeColor(operation.feedColor);
      if (color.error || !color.color) return fail(color.error ?? "Choose a valid color.");
      const feedId = randomUUID();
      const imported = options.importedEvents;
      if (data.events.length + imported.length > MAX_EVENTS) {
        return fail("Importing that feed would exceed the calendar event limit.", 413);
      }
      data.feeds.push({ id: feedId, name, url, color: color.color, lastFetchedAt: now, lastError: null });
      data.events.push(...imported.map((event) => importedToEvent(event, feedId, now)));
      return { ok: true, data };
    }

    case "remove_ical_feed": {
      const feedId = operation.feedId?.trim();
      if (!feedId) return fail("Choose a feed to remove.");
      const feed = data.feeds.find((item) => item.id === feedId);
      if (!feed) return fail("Feed not found.", 404);
      data.feeds = data.feeds.filter((item) => item.id !== feedId);
      data.events = data.events.filter((event) => event.feedId !== feedId);
      return { ok: true, data };
    }

    case "refresh_ical_feed": {
      const feedId = operation.feedId?.trim();
      if (!feedId) return fail("Choose a feed to refresh.");
      const feed = data.feeds.find((item) => item.id === feedId);
      if (!feed) return fail("Feed not found.", 404);
      data.feeds = data.feeds.map((item) =>
        item.id === feedId
          ? { ...item, lastFetchedAt: now, lastError: options.feedError ?? null }
          : item,
      );
      if (options.feedError) {
        return { ok: true, data };
      }
      if (options.importedEvents === undefined) {
        return fail("The feed could not be refreshed yet. Try again.");
      }
      const imported = options.importedEvents;
      data.events = data.events.filter((event) => event.feedId !== feedId);
      if (data.events.length + imported.length > MAX_EVENTS) {
        return fail("Refreshing that feed would exceed the calendar event limit.", 413);
      }
      data.events.push(...imported.map((event) => importedToEvent(event, feedId, now)));
      return { ok: true, data };
    }
  }
}
