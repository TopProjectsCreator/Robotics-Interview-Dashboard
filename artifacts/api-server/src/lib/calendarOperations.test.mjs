import assert from "node:assert/strict";
import test from "node:test";
import { applyCalendarOperation, initialCalendarData, parseCalendarData } from "./calendarOperations.ts";
import { buildIcalFeed, parseIcalFeed, fetchIcalFeed } from "./calendarIcal.ts";

const NOW = new Date("2026-11-04T12:00:00.000Z");

function withNow(operation, extra) {
  return applyCalendarOperation(initialCalendarData(), operation, "Ishaan", { now: NOW, ...extra });
}

test("initial calendar data round-trips through parse", () => {
  const data = initialCalendarData();
  assert.equal(data.kind, "calendar");
  assert.deepEqual(parseCalendarData(JSON.stringify(data)), data);
  assert.equal(parseCalendarData("not json"), null);
  assert.equal(parseCalendarData(JSON.stringify({ ...data, kind: "board" })), null);
});

test("create, update, and delete events preserve names, details, location, assignees, and color", () => {
  const created = withNow({
    operation: "create_event",
    event: {
      title: " Tryout check-in ",
      description: " Meet drivers at gate B ",
      location: " Pit building ",
      startAt: new Date("2026-11-10T14:00:00.000Z"),
      endAt: new Date("2026-11-10T15:30:00.000Z"),
      allDay: false,
      assignees: ["Ishaan", "Priya", "Ishaan"],
      color: "#D35D68",
    },
  });
  assert.equal(created.ok, true);
  assert.equal(created.data.events.length, 1);
  const event = created.data.events[0];
  assert.equal(event.title, "Tryout check-in");
  assert.equal(event.description, "Meet drivers at gate B");
  assert.equal(event.location, "Pit building");
  assert.deepEqual(event.assignees, ["Ishaan", "Priya"]);
  assert.equal(event.color, "#d35d68");
  assert.equal(event.updatedBy, "Ishaan");

  const updated = applyCalendarOperation(created.data, {
    operation: "update_event",
    eventId: event.id,
    eventPatch: { title: "Tryout check-in (updated)", location: "Field house" },
  }, "Priya", { now: new Date("2026-11-05T12:00:00.000Z") });
  assert.equal(updated.ok, true);
  assert.equal(updated.data.events[0].title, "Tryout check-in (updated)");
  assert.equal(updated.data.events[0].location, "Field house");
  assert.equal(updated.data.events[0].updatedBy, "Priya");

  const deleted = applyCalendarOperation(updated.data, { operation: "delete_event", eventId: event.id }, "Priya");
  assert.equal(deleted.ok, true);
  assert.equal(deleted.data.events.length, 0);

  const missing = applyCalendarOperation(initialCalendarData(), { operation: "delete_event", eventId: "gone" }, "Priya");
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
});

test("rejects empty names, bad colors, and end-before-start", () => {
  assert.equal(withNow({ operation: "create_event", event: { title: "  ", startAt: new Date("2026-11-10T14:00:00.000Z") } }).ok, false);
  assert.equal(withNow({ operation: "create_event", event: { title: "X", startAt: new Date("2026-11-10T14:00:00.000Z"), color: "red" } }).ok, false);
  assert.equal(withNow({ operation: "create_event", event: { title: "X", startAt: new Date("2026-11-10T15:00:00.000Z"), endAt: new Date("2026-11-10T14:00:00.000Z") } }).ok, false);
});

test("rename calendar updates the title and description", () => {
  const renamed = withNow({ operation: "rename_calendar", title: "Tryout season", description: " Fall calendar " });
  assert.equal(renamed.ok, true);
  assert.equal(renamed.title, "Tryout season");
  assert.equal(renamed.data.description, "Fall calendar");
});

test("iCal feeds: add, duplicate, refresh error, refresh, and remove", () => {
  const imported = [{
    title: "Holiday",
    description: "",
    location: "",
    startAt: new Date("2026-11-26T00:00:00.000Z"),
    endAt: new Date("2026-11-27T00:00:00.000Z"),
    allDay: true,
    assignees: [],
  }];
  const added = withNow(
    { operation: "add_ical_feed", feedUrl: "https://example.com/cal.ics", feedName: "Holidays", feedColor: "#f8c84a" },
    { importedEvents: imported },
  );
  assert.equal(added.ok, true);
  assert.equal(added.data.feeds[0].name, "Holidays");
  assert.equal(added.data.events[0].feedId, added.data.feeds[0].id);
  const feedId = added.data.feeds[0].id;

  const duplicate = applyCalendarOperation(added.data, { operation: "add_ical_feed", feedUrl: "https://example.com/cal.ics" }, "Ishaan", { now: NOW, importedEvents: [] });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.status, 409);

  const refreshedWithError = applyCalendarOperation(added.data, { operation: "refresh_ical_feed", feedId }, "Ishaan", { now: NOW, feedError: "The feed returned 500." });
  assert.equal(refreshedWithError.ok, true);
  assert.equal(refreshedWithError.data.feeds[0].lastError, "The feed returned 500.");
  assert.equal(refreshedWithError.data.events.length, 1);

  const refreshed = applyCalendarOperation(refreshedWithError.data, { operation: "refresh_ical_feed", feedId }, "Ishaan", { now: NOW, importedEvents: [] });
  assert.equal(refreshed.ok, true);
  assert.equal(refreshed.data.events.length, 0);
  assert.equal(refreshed.data.feeds[0].lastError, null);

  const removed = applyCalendarOperation(added.data, { operation: "remove_ical_feed", feedId }, "Ishaan", { now: NOW });
  assert.equal(removed.ok, true);
  assert.equal(removed.data.feeds.length, 0);
  assert.equal(removed.data.events.length, 0);
});

const ICS_FIXTURE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Example//Cal//EN",
  "BEGIN:VEVENT",
  "UID:event-1@example.com",
  "DTSTAMP:20261101T000000Z",
  "DTSTART:20261110T140000Z",
  "DTEND:20261110T150000Z",
  "SUMMARY:Tryout check-in\\, gate B",
  "DESCRIPTION:Meet drivers\\nBring forms",
  "LOCATION:Pit building",
  "ATTENDEE;CN=Ishaan:mailto:ishaan@example.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:event-2@example.com",
  "DTSTAMP:20261101T000000Z",
  "DTSTART;VALUE=DATE:20261225",
  "DTEND;VALUE=DATE:20261226",
  "SUMMARY:Holiday",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:event-3@example.com",
  "DTSTAMP:20261101T000000Z",
  "DTSTART:20261104T090000Z",
  "DTEND:20261104T100000Z",
  "RRULE:FREQ=DAILY;COUNT=3",
  "SUMMARY:Standup",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("parseIcalFeed extracts timed, all-day, and recurring events", () => {
  const events = parseIcalFeed(ICS_FIXTURE);
  assert.equal(events.length, 5); // check-in, holiday, + 3 standups
  const timed = events.find((event) => event.title === "Tryout check-in, gate B");
  assert.equal(timed.location, "Pit building");
  assert.equal(timed.description, "Meet drivers\nBring forms");
  assert.deepEqual(timed.assignees, ["Ishaan"]);
  assert.equal(timed.allDay, false);
  const holiday = events.find((event) => event.title === "Holiday");
  assert.equal(holiday.allDay, true);
  const standups = events.filter((event) => event.title === "Standup");
  assert.equal(standups.length, 3);
  assert.equal(standups[0].startAt.toISOString(), "2026-11-04T09:00:00.000Z");
  assert.equal(standups[2].startAt.toISOString(), "2026-11-06T09:00:00.000Z");
});

test("parseIcalFeed rejects non-calendar text", () => {
  assert.throws(() => parseIcalFeed("hello"), /No iCal calendar content/);
});

test("buildIcalFeed exports title, times, location, description, and assignees", () => {
  const data = withNow({
    operation: "create_event",
    event: {
      title: "Demo day",
      description: "Bring robots",
      location: "Field house",
      startAt: new Date("2026-11-12T18:00:00.000Z"),
      endAt: new Date("2026-11-12T20:00:00.000Z"),
      assignees: ["Ishaan", "Priya"],
    },
  }).data;
  const ics = buildIcalFeed("cal-1", "Team calendar", data);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /X-WR-CALNAME:Team calendar/);
  assert.match(ics, /SUMMARY:Demo day/);
  assert.match(ics, /LOCATION:Field house/);
  assert.match(ics, /DESCRIPTION:Bring robots\\nAssignees: Ishaan\\, Priya/);
  assert.match(ics, /DTSTART:20261112T180000Z/);
  // Exported content parses back to the same event.
  const reparsed = parseIcalFeed(ics);
  assert.equal(reparsed[0].title, "Demo day");
});

test("fetchIcalFeed blocks loopback and private addresses", async () => {
  await assert.rejects(() => fetchIcalFeed("http://localhost/cal.ics"), /cannot be used/);
  await assert.rejects(() => fetchIcalFeed("http://127.0.0.1/cal.ics"), /cannot be used/);
  await assert.rejects(() => fetchIcalFeed("http://169.254.169.254/latest/meta-data/"), /cannot be used/);
});
