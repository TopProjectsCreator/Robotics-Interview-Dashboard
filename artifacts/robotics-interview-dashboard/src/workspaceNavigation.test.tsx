import { describe, expect, it } from "vitest";

import {
  getWorkspaceNavigation,
  workspaceAreaForPath,
  type WorkspaceKey,
} from "./workspaceNavigation";

describe("workspace navigation", () => {
  it("shows every workspace choice on the overview", () => {
    expect(workspaceAreaForPath("/dashboard")).toBe("overview");
    expect(getWorkspaceNavigation("overview").map(({ label, kind }) => [label, kind])).toEqual([
      ["Interview", "workspace"],
      ["Chat", "workspace"],
      ["Parts", "workspace"],
      ["CAD", "workspace"],
      ["Code", "workspace"],
      ["Custom apps", "section"],
    ]);
  });

  it("shows interview navigation only inside interview routes", () => {
    for (const path of ["/interview", "/interview/assistant", "/applicants", "/queue", "/attendance", "/big-screen"]) {
      expect(workspaceAreaForPath(path)).toBe("interview");
    }
    expect(getWorkspaceNavigation("interview").map(({ label }) => label)).toEqual([
      "Interview",
      "Chat",
      "Parts",
      "CAD",
      "Code",
      "Applicants",
      "Interview queue",
      "Attendance",
      "Big screen",
      "AI assistant",
    ]);
    expect(getWorkspaceNavigation("interview").find(({ label }) => label === "AI assistant")?.href)
      .toBe("/interview/assistant");
  });

  it("keeps team chat, the assistant, and chat documents in the chat area", () => {
    for (const path of ["/chat", "/assistant", "/spreadsheets/board-1"]) {
      expect(workspaceAreaForPath(path)).toBe("chat");
    }
    expect(getWorkspaceNavigation("chat").map(({ label }) => label)).toEqual([
      "Interview",
      "Chat",
      "Parts",
      "CAD",
      "Code",
      "AI assistant",
    ]);
    expect(getWorkspaceNavigation("chat").find(({ label }) => label === "AI assistant")?.href)
      .toBe("/assistant");
  });

  it("keeps parts, CAD, and code routes in their own workspaces", () => {
    expect(workspaceAreaForPath("/parts")).toBe("parts");
    expect(workspaceAreaForPath("/parts?search=shaft")).toBe("parts");
    expect(workspaceAreaForPath("/cad")).toBe("cad");
    expect(workspaceAreaForPath("/cad/")).toBe("cad");
    expect(workspaceAreaForPath("/code")).toBe("code");
    expect(workspaceAreaForPath("/code/")).toBe("code");
    expect(workspaceAreaForPath("/custom-workspaces")).toBe("overview");
    expect(workspaceAreaForPath("/parts")).toBe("parts");
    expect(getWorkspaceNavigation("parts").map(({ label }) => label)).toEqual([
      "Interview",
      "Chat",
      "Parts",
      "CAD",
      "Code",
    ]);
    expect(getWorkspaceNavigation("cad").map(({ label }) => label)).toEqual([
      "Interview",
      "Chat",
      "Parts",
      "CAD",
      "Code",
    ]);
    expect(getWorkspaceNavigation("code").map(({ label }) => label)).toEqual([
      "Interview",
      "Chat",
      "Parts",
      "CAD",
      "Code",
      "Custom apps",
    ]);
  });

  it("hides workspaces the viewer cannot open", () => {
    const visible = new Set<WorkspaceKey>(["chat", "parts"]);
    expect(getWorkspaceNavigation("overview", visible).map(({ label }) => label)).toEqual([
      "Chat",
      "Parts",
      "Custom apps",
    ]);
    expect(getWorkspaceNavigation("chat", visible).map(({ label }) => label)).toEqual([
      "Chat",
      "Parts",
      "AI assistant",
    ]);
  });

  it("hides sections whose workspace is hidden", () => {
    const visible = new Set<WorkspaceKey>(["chat", "parts"]);
    expect(
      getWorkspaceNavigation("interview", visible).map(({ label }) => label),
    ).not.toContain("Interview queue");
    const withoutChat = new Set<WorkspaceKey>(["parts"]);
    expect(
      getWorkspaceNavigation("chat", withoutChat).map(({ label }) => label),
    ).not.toContain("AI assistant");
  });
});
