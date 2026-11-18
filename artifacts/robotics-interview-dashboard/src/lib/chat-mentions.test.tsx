import { describe, expect, it } from "vitest";
import { buildApplicantMentionPeople, buildChannelMentions, buildObjectMentions, findChatChannelMentions, findChatFtcMentions, findChatMentions, messageMentionsInterviewer } from "./chat-mentions";

const people = [
  { token: "Maksim" },
  { token: "Maksim Stone" },
  { token: "Ishaan" },
];

describe("chat mentions", () => {
  it("matches case-insensitively and preserves punctuation around the name", () => {
    const matches = findChatMentions("Hi, @mAkSiM! Can you check this?", people);

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ start: 4, end: 11, text: "@mAkSiM", person: people[0] });
  });

  it("prefers the longest matching interviewer name", () => {
    const matches = findChatMentions("Thanks, @Maksim Stone.", people);

    expect(matches).toHaveLength(1);
    expect(matches[0].person).toBe(people[1]);
    expect(matches[0].text).toBe("@Maksim Stone");
  });

  it("matches #channel references case-insensitively and prefers the longest channel name", () => {
    const channel = (id: string, name: string) => ({ id, token: name, name, emoji: null, memberCount: 1, kind: "channel" as const });
    const channels = [channel("chan-1", "design"), channel("chan-2", "design eng"), channel("chan-3", "finance")];

    const matches = findChatChannelMentions("See #Design Eng for notes, and #finance too.", channels);

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({ text: "#Design Eng", person: channels[1] });
    expect(matches[1]).toMatchObject({ text: "#finance", person: channels[2] });
  });

  it("does not match partial names, hashes inside words, or c#-style handles", () => {
    const channels = [{ id: "chan-1", token: "general", name: "general", emoji: null, memberCount: 1, kind: "channel" as const }];

    expect(findChatChannelMentions("issue #generals and c#generalcs are not references.", channels)).toHaveLength(0);
    expect(findChatChannelMentions("ping #general!", channels)).toHaveLength(1);
    expect(findChatChannelMentions("guid/#general", channels)).toHaveLength(0);
  });

  it("builds stable, whitespace-normalized channel tokens", () => {
    const channels = buildChannelMentions([
      { id: "chan-1", name: "  Design   Eng  ", emoji: "🔧", memberCount: 3 },
      { id: "chan-2", name: "design eng", emoji: null, memberCount: 4 },
      { id: "chan-3", name: "press room", emoji: null, memberCount: 0 },
      { id: "chan-4", name: "   ", emoji: null, memberCount: 1 },
    ]);

    expect(channels.map(channel => channel.token)).toEqual(["Design Eng", "press room"]);
    expect(channels[0]).toMatchObject({ id: "chan-1", emoji: "🔧", memberCount: 3, kind: "channel" });
    expect(channels[1].memberCount).toBe(0);
  });

  it("finds stable FTC team and event references without matching inside words", () => {
    const text = "Visit @FTC Team 2026 23442, then see @FTC Event 2026 CAFO!";
    expect(findChatFtcMentions(text)).toEqual([
      {
        kind: "team",
        start: 6,
        end: 26,
        text: "@FTC Team 2026 23442",
        season: 2026,
        teamNumber: 23442,
      },
      {
        kind: "event",
        start: 37,
        end: 57,
        text: "@FTC Event 2026 CAFO",
        season: 2026,
        eventCode: "CAFO",
      },
    ]);
    expect(findChatFtcMentions("x@FTC Team 2026 23442 and mail@FTC Event 2026 CAFO")).toHaveLength(0);
    expect(findChatFtcMentions("@FTC Team 2020 23442 @FTC Team 2026 0 @FTC Event 2101 CAFO")).toHaveLength(0);
  });

  it("matches applicant references with a stable roster qualifier", () => {
    const applicant = { token: "Applicant Casey Nguyen (Grade 6)", kind: "applicant" as const };
    const matches = findChatMentions("Discuss @Applicant Casey Nguyen (Grade 6) after the interview.", [applicant]);

    expect(matches).toHaveLength(1);
    expect(matches[0].person).toBe(applicant);
    expect(matches[0].text).toBe("@Applicant Casey Nguyen (Grade 6)");
  });

  it("builds stable applicant tokens with grade and collision-safe references", () => {
    const applicants = [
      { id: "app-123456", name: "Casey Nguyen", grade: "6", queuePosition: 4 },
      { id: "app-987654", name: "Casey Nguyen", grade: "6", queuePosition: 2 },
      { id: "app-456789", name: "Riley Chen", grade: "7", queuePosition: 1 },
    ];

    const mentions = buildApplicantMentionPeople(applicants, ["Ishaan"]);
    const reorderedMentions = buildApplicantMentionPeople(
      applicants.map(applicant => ({ ...applicant, queuePosition: applicant.queuePosition + 10 })).reverse(),
      ["Ishaan"],
    );

    expect(mentions.map(person => person.token).sort()).toEqual(reorderedMentions.map(person => person.token).sort());
    expect(mentions.map(person => person.token)).toEqual([
      "Applicant Casey Nguyen (Grade 6) · Ref APP123",
      "Applicant Casey Nguyen (Grade 6) · Ref APP987",
      "Applicant Riley Chen (Grade 7)",
    ]);
    expect(mentions[0].detail).toBe("Applicant · Grade 6 · Queue #4");
    expect(mentions[0]).not.toHaveProperty("email");
  });

  it("does not match partial names, email addresses, or embedded handles", () => {
    const matches = findChatMentions(
      "Maksimx, contact@example.com, and foo@Ishaan are not mentions.",
      people,
    );

    expect(matches).toHaveLength(0);
  });

  it("identifies when the signed-in interviewer was mentioned", () => {
    expect(messageMentionsInterviewer("Please review, @Ishaan.", "Ishaan")).toBe(true);
    expect(messageMentionsInterviewer("Please review, @Ishaan.", "Maksim")).toBe(false);
    expect(messageMentionsInterviewer("Team update, @all.", "Maksim")).toBe(true);
  });

  it("does not treat an applicant mention as an interviewer mention", () => {
    const roster = [
      { token: "Ishaan", label: "Ishaan", detail: "Interviewer", initials: "I", kind: "interviewer" as const },
      { token: "Applicant Ishaan", label: "Ishaan", detail: "Applicant", initials: "I", kind: "applicant" as const },
      { token: "all", label: "All interviewers", detail: "Group", initials: "∗", kind: "group" as const },
    ];

    expect(messageMentionsInterviewer("@Ishaan", "Ishaan", roster)).toBe(true);
    expect(messageMentionsInterviewer("@Applicant Ishaan", "Ishaan", roster)).toBe(false);
    expect(messageMentionsInterviewer("@all", "Ishaan", roster)).toBe(true);
  });
});
describe("chat object mentions", () => {
  const objects = [
    { id: "11111111-2222-4333-8444-555555555555", title: "Sprint plan", data: JSON.stringify({ kind: "board" }) },
    { id: "bbbbbbbb-1111-4333-8666-777777777777", title: "Budget sheet", data: JSON.stringify({ kind: "spreadsheet" }) },
    { id: "cccccccc-2222-4333-8777-888888888888", title: "Collision", data: JSON.stringify({ kind: "document" }) },
    { id: "dddddddd-3333-4333-8888-999999999999", title: "Collision", data: "{\"kind\":\"whiteboard\"}" },
    { id: "eeeeeeee-5555-4333-9000-aaaaaaaaaaaa", title: "Tryout calendar", data: JSON.stringify({ kind: "calendar" }) },
  ];

  it("builds mention tokens for every chat-created object kind (document, whiteboard, board, spreadsheet, calendar)", () => {
    const mentions = buildObjectMentions(objects, ["Ishaan", "all", "ai"]);
    const kinds = new Set(mentions.map(object => object.kind));
    expect([...kinds].sort()).toEqual(["board", "calendar", "document", "spreadsheet", "whiteboard"]);

    const board = mentions.find(object => object.kind === "board");
    const sheet = mentions.find(object => object.kind === "spreadsheet");
    const document = mentions.find(object => object.kind === "document");
    const whiteboard = mentions.find(object => object.kind === "whiteboard");
    const calendar = mentions.find(object => object.kind === "calendar");
    expect(board?.title).toBe("Sprint plan");
    expect(sheet?.title).toBe("Budget sheet");
    expect(document?.title).toBe("Collision");
    expect(whiteboard?.title).toBe("Collision");
    expect(calendar?.title).toBe("Tryout calendar");
    // Duplicate titles get a stable Ref disambiguator.
    expect(new Set([document?.token, whiteboard?.token]).size).toBe(2);
    expect([document?.token, whiteboard?.token].every(token => token?.startsWith("Collision"))).toBe(true);
  });

  it("matches object mentions by whitespace-normalized title, case-insensitively", () => {
    const mentions = buildObjectMentions(objects, []);
    const matches = findChatMentions("Open @Sprint plan when you get back.", mentions);

    expect(matches).toHaveLength(1);
    expect(matches[0].person).toMatchObject({ kind: "board", id: "11111111-2222-4333-8444-555555555555" });
    expect(matches[0].text).toBe("@Sprint plan");
  });

  it("matches object mentions by raw id", () => {
    const mentions = buildObjectMentions(objects, []);
    const matches = findChatMentions("See @11111111-2222-4333-8444-555555555555 for the plan.", mentions);

    expect(matches).toHaveLength(1);
    expect(matches[0].person).toMatchObject({ kind: "board", title: "Sprint plan" });
  });

  it("prefers the longest token when titles overlap", () => {
    const overlapping = [
      ...objects,
      { id: "eeeeeeee-4444-4333-8999-000000000000", title: "Sprint plan v2", data: JSON.stringify({ kind: "document" }) },
    ];
    const mentions = buildObjectMentions(overlapping, []);
    const matches = findChatMentions("Check @Sprint plan v2 and @Sprint plan.", mentions);

    expect(matches).toHaveLength(2);
    expect(matches.map(match => match.person.title)).toEqual(["Sprint plan v2", "Sprint plan"]);
  });

  it("ignores mentions with no @ or with a token that is not an object", () => {
    const mentions = buildObjectMentions(objects, []);

    expect(findChatMentions("Sprint plan without trigger", mentions)).toHaveLength(0);
    expect(findChatMentions("@Sprint plans", mentions)).toHaveLength(0);
    expect(findChatMentions("", mentions)).toHaveLength(0);
  });
});
