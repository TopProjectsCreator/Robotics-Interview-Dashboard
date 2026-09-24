import { describe, expect, it } from "vitest";
import { findChatMentions, messageMentionsInterviewer } from "./chat-mentions";

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
});