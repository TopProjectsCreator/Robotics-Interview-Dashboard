import { describe, expect, it } from "vitest";
import { buildApplicantMentionPeople, findChatMentions, messageMentionsInterviewer } from "./chat-mentions";

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