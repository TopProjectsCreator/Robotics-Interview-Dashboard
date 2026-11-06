import { describe, expect, it } from "vitest";
import { buildCsvExport, buildIcalExport, escapeIcalText, parseIcalText } from "./calendarIcal";

describe("buildIcalExport", () => {
  it("exports events as a VCALENDAR with times, location, and assignees", () => {
    const ics = buildIcalExport("cal-1", "Team calendar", [
      {
        id: "evt-1",
        title: "Demo day",
        description: "Bring robots",
        startAt: new Date("2026-11-12T18:00:00.000Z"),
        endAt: new Date("2026-11-12T20:00:00.000Z"),
        allDay: false,
        location: "Field house",
        assignees: ["Ishaan", "Priya"],
      },
      {
        id: "evt-2",
        title: "Holiday",
        description: "",
        startAt: new Date("2026-12-25T12:00:00.000Z"),
        endAt: new Date("2026-12-26T12:00:00.000Z"),
        allDay: true,
        location: "",
        assignees: [],
      },
    ]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("X-WR-CALNAME:Team calendar");
    expect(ics).toContain("SUMMARY:Demo day");
    expect(ics).toContain("LOCATION:Field house");
    expect(ics).toContain("DTSTART:20261112T180000Z");
    expect(ics).toContain("DESCRIPTION:Bring robots\\nAssignees: Ishaan\\, Priya");
    expect(ics).toContain("DTSTART;VALUE=DATE:20261225");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("escapes special characters", () => {
    expect(escapeIcalText("a, b; c\\d\ne")).toBe("a\\, b\\; c\\\\d\\ne");
  });
});

const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:a@example.com",
  "DTSTAMP:20261101T000000Z",
  "DTSTART:20261110T140000Z",
  "DTEND:20261110T150000Z",
  "SUMMARY:Tryout check-in\\, gate B",
  "DESCRIPTION:Meet drivers",
  "LOCATION:Pit building",
  "ATTENDEE;CN=Ishaan:mailto:ishaan@example.com",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:b@example.com",
  "DTSTAMP:20261101T000000Z",
  "DTSTART:20261104T090000Z",
  "DTEND:20261104T100000Z",
  "RRULE:FREQ=DAILY;COUNT=3",
  "SUMMARY:Standup",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcalText", () => {
  it("parses timed, escaped, attendee, and recurring events", () => {
    const events = parseIcalText(ICS);
    expect(events).toHaveLength(4);
    const checkIn = events.find((event) => event.title === "Tryout check-in, gate B");
    expect(checkIn?.location).toBe("Pit building");
    expect(checkIn?.assignees).toEqual(["Ishaan"]);
    expect(checkIn?.startAt.toISOString()).toBe("2026-11-10T14:00:00.000Z");
    const standups = events.filter((event) => event.title === "Standup");
    expect(standups).toHaveLength(3);
  });

  it("rejects non-calendar text", () => {
    expect(() => parseIcalText("not a calendar")).toThrow("No iCal calendar content");
  });
});

describe("buildCsvExport", () => {
  it("quotes fields containing commas and newlines", () => {
    const csv = buildCsvExport("Team calendar", [
      {
        id: "evt-1",
        title: 'Demo, "final"',
        description: "line1\nline2",
        startAt: new Date("2026-11-12T18:00:00.000Z"),
        endAt: new Date("2026-11-12T20:00:00.000Z"),
        allDay: false,
        location: "Field, house",
        assignees: ["Ishaan", "Priya"],
      },
    ]);
    expect(csv).toContain("Title,Start,End,AllDay,Location,Assignees,Description");
    expect(csv).toContain('"Demo, ""final"""');
    expect(csv).toContain('"Field, house"');
    expect(csv).toContain("Ishaan; Priya");
  });
});
