import { beforeEach, describe, expect, it } from "vitest";

import {
  applyExplicitTeamThemeChoice,
  decideTeamTheme,
  hasStoredThemeChoice,
  readTeamThemeFollow,
} from "./useTeamTheme";

const FOLLOW_KEY = "robotics-team-theme-follow";
const THEME_KEY = "theme";

/**
 * The team theme feature lets a team admin pick a default (light/dark) and a
 * policy: recommended (members land on the default but can switch) or locked
 * (members cannot switch). The pure decision function is what both the
 * auto-follow effect and the write paths rely on.
 */
describe("decideTeamTheme", () => {
  const recommended = { desired: "dark" as const, locked: false };
  const locked = { desired: "dark" as const, locked: true };

  it("does nothing when the team has no default theme", () => {
    expect(decideTeamTheme({ theme: "light", hasStoredChoice: true, following: true, desired: null, locked: true }))
      .toEqual({ apply: null, follow: null });
  });

  it("applies the team default to a fresh device in recommended mode", () => {
    expect(decideTeamTheme({ theme: "light", hasStoredChoice: false, following: false, ...recommended }))
      .toEqual({ apply: "dark", follow: "dark" });
  });

  it("keeps devices with their own choice in recommended mode", () => {
    expect(decideTeamTheme({ theme: "light", hasStoredChoice: true, following: false, ...recommended }))
      .toEqual({ apply: null, follow: null });
  });

  it("switches following devices when the admin changes the team default", () => {
    expect(decideTeamTheme({ theme: "light", hasStoredChoice: true, following: true, desired: "dark", locked: false }))
      .toEqual({ apply: "dark", follow: "dark" });
  });

  it("keeps following devices on the default without re-applying", () => {
    expect(decideTeamTheme({ theme: "dark", hasStoredChoice: true, following: true, ...recommended }))
      .toEqual({ apply: null, follow: "dark" });
  });

  it("forces the team default even over a member choice when locked", () => {
    expect(decideTeamTheme({ theme: "light", hasStoredChoice: true, following: false, ...locked }))
      .toEqual({ apply: "dark", follow: "dark" });
  });

  it("does not re-apply when a locked device is already on the default", () => {
    expect(decideTeamTheme({ theme: "dark", hasStoredChoice: true, following: false, ...locked }))
      .toEqual({ apply: null, follow: "dark" });
  });
});

describe("explicit team theme choices", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("re-subscribes a device that picks the team default", () => {
    applyExplicitTeamThemeChoice("dark", "dark");
    expect(readTeamThemeFollow()).toBe(true);
    expect(hasStoredThemeChoice()).toBe(false); // only the follow marker is written here
  });

  it("opts a device out when it picks a different theme than the team default", () => {
    window.localStorage.setItem(FOLLOW_KEY, "dark");
    applyExplicitTeamThemeChoice("light", "dark");
    expect(readTeamThemeFollow()).toBe(false);
  });

  it("clears the follow marker when the team has no default", () => {
    window.localStorage.setItem(FOLLOW_KEY, "dark");
    applyExplicitTeamThemeChoice("light", null);
    expect(readTeamThemeFollow()).toBe(false);
  });

  it("detects a fresh device via the next-themes storage key", () => {
    expect(hasStoredThemeChoice()).toBe(false);
    window.localStorage.setItem(THEME_KEY, "light");
    expect(hasStoredThemeChoice()).toBe(true);
  });
});
