import { describe, expect, it } from "vitest";
import { addTeamEmojiMarkdown, getTeamEmojiStorageUrl } from "./chat-custom-emojis";

describe("addTeamEmojiMarkdown", () => {
  const emojiPaths = new Map([["rover", "/objects/abc-123"]]);

  it("converts known shortcodes into authenticated storage images", () => {
    expect(addTeamEmojiMarkdown("Nice work :rover:", emojiPaths))
      .toBe("Nice work ![emoji:rover](/api/storage/objects/abc-123)");
  });

  it("matches shortcode names without case sensitivity and leaves unknown names alone", () => {
    expect(addTeamEmojiMarkdown(":ROVER: :missing:", emojiPaths))
      .toBe("![emoji:ROVER](/api/storage/objects/abc-123) :missing:");
  });

  it("does not expand shortcodes inside inline or fenced code", () => {
    expect(addTeamEmojiMarkdown("`:rover:`\n```txt\n:rover:\n```", emojiPaths))
      .toBe("`:rover:`\n```txt\n:rover:\n```");
  });

  it("rejects stored object paths that are not a single private object id", () => {
    expect(addTeamEmojiMarkdown(":rover:", new Map([["rover", "/objects/a/../b"]])))
      .toBe(":rover:");
  });

  it("resolves team emoji reactions to the authenticated private image route", () => {
    expect(getTeamEmojiStorageUrl(":ROVER:", emojiPaths))
      .toBe("/api/storage/objects/abc-123");
    expect(getTeamEmojiStorageUrl(":missing:", emojiPaths)).toBeNull();
    expect(getTeamEmojiStorageUrl(":rover: extra", emojiPaths)).toBeNull();
  });
});