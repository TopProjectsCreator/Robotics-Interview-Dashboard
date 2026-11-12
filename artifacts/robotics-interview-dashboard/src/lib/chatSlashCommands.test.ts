import { describe, expect, it } from "vitest";

import { CHAT_SLASH_COMMANDS, filterSlashCommands, findSlashCommandTrigger } from "./chatSlashCommands";

describe("findSlashCommandTrigger", () => {
  it("opens on a bare slash at the start of the draft", () => {
    expect(findSlashCommandTrigger("/", 1)).toEqual({ start: 0, end: 1, query: "" });
  });

  it("captures the partial command name as the query", () => {
    expect(findSlashCommandTrigger("/mul", 4)).toEqual({ start: 0, end: 4, query: "mul" });
  });

  it("measures the query from the caret, not the end of the draft", () => {
    expect(findSlashCommandTrigger("/multimessage", 4)).toEqual({ start: 0, end: 4, query: "mul" });
  });

  it("closes once a space is typed (arguments mode)", () => {
    expect(findSlashCommandTrigger("/multimessage ", 14)).toBeNull();
    expect(findSlashCommandTrigger("/multimessage 5 hi", 18)).toBeNull();
  });

  it("returns null when the draft does not start with a slash", () => {
    expect(findSlashCommandTrigger("multimessage", 12)).toBeNull();
    expect(findSlashCommandTrigger("hello /multimessage", 19)).toBeNull();
    expect(findSlashCommandTrigger("", 0)).toBeNull();
  });

  it("returns null when the caret sits inside the arguments", () => {
    expect(findSlashCommandTrigger("/multimessage", 3)).toEqual({ start: 0, end: 3, query: "mu" });
    expect(findSlashCommandTrigger("/multimessage x", 14)).toBeNull();
  });

  it("tolerates out-of-range caret positions", () => {
    expect(findSlashCommandTrigger("/mul", 999)).toEqual({ start: 0, end: 4, query: "mul" });
    // Caret at offset 0 sits before the slash, so there is no trigger.
    expect(findSlashCommandTrigger("/mul", 0)).toBeNull();
  });
});

describe("filterSlashCommands", () => {
  it("returns every command for an empty query", () => {
    expect(filterSlashCommands("")).toEqual([...CHAT_SLASH_COMMANDS]);
    expect(filterSlashCommands("   ")).toEqual([...CHAT_SLASH_COMMANDS]);
  });

  it("matches command names case-insensitively", () => {
    expect(filterSlashCommands("MULTI")).toEqual([CHAT_SLASH_COMMANDS.find(c => c.name === "multimessage")]);
    expect(filterSlashCommands("multi")).toEqual([CHAT_SLASH_COMMANDS.find(c => c.name === "multimessage")]);
  });

  it("returns no matches for an unknown query instead of guessing", () => {
    expect(filterSlashCommands("zzz")).toEqual([]);
  });
});

describe("CHAT_SLASH_COMMANDS registry", () => {
  it("keeps every command name slash-free and usage anchored with a slash", () => {
    expect(CHAT_SLASH_COMMANDS.length).toBeGreaterThan(0);
    for (const command of CHAT_SLASH_COMMANDS) {
      expect(command.name).not.toContain("/");
      expect(command.usage.startsWith(`/${command.name}`)).toBe(true);
      expect(command.description.trim().length).toBeGreaterThan(0);
    }
  });
});
