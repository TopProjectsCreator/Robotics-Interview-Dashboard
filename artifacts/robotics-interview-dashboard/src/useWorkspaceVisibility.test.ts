import { describe, expect, it } from "vitest";

import {
  sessionWithWorkspaceViews,
  WORKSPACE_KEYS,
  WORKSPACE_VIEW_PERMISSIONS,
} from "./useWorkspaceVisibility";

/**
 * Settings → Workspace access is an explicit per-person grant, so a granted
 * team member or treasurer must pass the page-level permission checks for the
 * workspace's read capabilities. Administration stays role-only.
 */
describe("sessionWithWorkspaceViews", () => {
  const interviewer = { role: "interviewer", customRoleId: null, permissions: null };
  const treasurer = { role: "treasurer", customRoleId: null, permissions: null };

  it("leaves a session with no visible workspaces unchanged", () => {
    const session = sessionWithWorkspaceViews(interviewer, new Set());
    expect(session.permissions).toEqual(
      expect.arrayContaining(["chat.view", "parts.view"]),
    );
    expect(session.permissions).not.toContain("applicants.view");
  });

  it("grants interview read permissions when the interview workspace is visible", () => {
    const session = sessionWithWorkspaceViews(interviewer, new Set(["interview"]));
    for (const permission of WORKSPACE_VIEW_PERMISSIONS.interview) {
      expect(session.permissions).toContain(permission);
    }
  });

  it("grants CAD and Code view permissions without administration", () => {
    const session = sessionWithWorkspaceViews(interviewer, new Set(["cad", "code"]));
    expect(session.permissions).toEqual(expect.arrayContaining(["cad.view", "cad.edit", "code.view", "code.edit"]));
    expect(session.permissions).not.toContain("cad.manage");
    expect(session.permissions).not.toContain("code.manage");
  });

  it("does not invent permissions for ungranted workspaces", () => {
    const treasurerSession = sessionWithWorkspaceViews(treasurer, new Set(["chat"]));
    expect(treasurerSession.permissions).not.toContain("cad.view");
    expect(treasurerSession.permissions).not.toContain("interview.view");
  });

  it("merges implied permissions with an explicit custom-role list", () => {
    const custom = { role: "interviewer", customRoleId: "role-1", permissions: ["chat.view"] };
    const session = sessionWithWorkspaceViews(custom, new Set(["cad" as const]));
    expect(session.permissions).toEqual(expect.arrayContaining(["chat.view", "cad.view", "cad.edit"]));
  });

  it("fails closed for a custom role with no permission list", () => {
    const custom = { role: "interviewer", customRoleId: "role-1", permissions: null };
    const session = sessionWithWorkspaceViews(custom, new Set(["cad" as const]));
    expect(session.permissions).toBeNull();
  });

  it("returns undefined sessions unchanged", () => {
    expect(sessionWithWorkspaceViews(undefined, new Set(["cad" as const]))).toBeUndefined();
  });

  it("every workspace in the matrix maps to at least one permission", () => {
    for (const key of WORKSPACE_KEYS) {
      expect(WORKSPACE_VIEW_PERMISSIONS[key].length).toBeGreaterThan(0);
    }
  });
});
