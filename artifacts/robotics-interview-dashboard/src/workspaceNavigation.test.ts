import { describe, expect, it } from "vitest";

import { getWorkspaceNavigation, workspaceAreaForPath } from "./workspaceNavigation";

describe("workspace navigation", () => {
  it("keeps the overview limited to the two workspace pills", () => {
    expect(workspaceAreaForPath("/dashboard")).toBe("overview");
    expect(getWorkspaceNavigation("overview").map(({ label, kind }) => [label, kind])).toEqual([
      ["Interview", "workspace"],
      ["Chat", "workspace"],
    ]);
  });

  it("shows interview navigation only inside interview routes", () => {
    for (const path of ["/interview", "/applicants", "/queue", "/attendance", "/big-screen"]) {
      expect(workspaceAreaForPath(path)).toBe("interview");
    }
    expect(getWorkspaceNavigation("interview").map(({ label }) => label)).toEqual([
      "Interview",
      "Chat",
      "Applicants",
      "Interview queue",
      "Attendance",
      "Big screen",
    ]);
  });

  it("keeps team chat, the assistant, and chat documents in the chat area", () => {
    for (const path of ["/chat", "/assistant", "/spreadsheets/board-1"]) {
      expect(workspaceAreaForPath(path)).toBe("chat");
    }
    expect(getWorkspaceNavigation("chat").map(({ label }) => label)).toEqual([
      "Interview",
      "Chat",
      "AI assistant",
    ]);
  });
});