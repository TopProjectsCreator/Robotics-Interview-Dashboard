import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WORKSPACE_VISIBILITY,
  isWorkspaceKey,
  isWorkspaceRole,
  normalizeWorkspaceVisibility,
  roleCanSeeWorkspace,
  userCanSeeWorkspace,
  visibleWorkspacesForRole,
  visibleWorkspacesForUser,
} from "./workspaceVisibility.ts";

test("CAD and Code are admin-only by default and match pre-existing role behaviour", () => {
  assert.deepEqual(DEFAULT_WORKSPACE_VISIBILITY.cad, ["coordinator"]);
  assert.deepEqual(DEFAULT_WORKSPACE_VISIBILITY.code, ["coordinator"]);
  assert.deepEqual(DEFAULT_WORKSPACE_VISIBILITY.interview, ["coordinator"]);
  assert.deepEqual(DEFAULT_WORKSPACE_VISIBILITY.chat, [
    "coordinator",
    "treasurer",
    "interviewer",
  ]);
  assert.deepEqual(DEFAULT_WORKSPACE_VISIBILITY.parts, [
    "coordinator",
    "treasurer",
    "interviewer",
  ]);
});

test("recognises only known workspaces and roles", () => {
  assert.equal(isWorkspaceKey("cad"), true);
  assert.equal(isWorkspaceKey("CAD"), false);
  assert.equal(isWorkspaceKey("spreadsheets"), false);
  assert.equal(isWorkspaceRole("coordinator"), true);
  assert.equal(isWorkspaceRole("admin"), false);
  assert.equal(isWorkspaceRole(undefined), false);
});

test("falls back to defaults for missing, malformed, and hostile input", () => {
  assert.deepEqual(normalizeWorkspaceVisibility(null), DEFAULT_WORKSPACE_VISIBILITY);
  assert.deepEqual(normalizeWorkspaceVisibility("nope"), DEFAULT_WORKSPACE_VISIBILITY);
  assert.deepEqual(normalizeWorkspaceVisibility({}), DEFAULT_WORKSPACE_VISIBILITY);
  assert.deepEqual(
    normalizeWorkspaceVisibility({ chat: "coordinator" }),
    DEFAULT_WORKSPACE_VISIBILITY,
    "a non-array value falls back instead of granting nothing or everything",
  );
});

test("drops unknown workspaces, keeps user IDs and legacy roles", () => {
  const normalized = normalizeWorkspaceVisibility({
    cad: ["coordinator", "abc123user", "treasurer", "coordinator", "", 42, null],
    admin: ["coordinator"],
    interview: ["admin"],
  });
  assert.deepEqual(normalized.cad, ["coordinator", "treasurer", "abc123user"]);
  assert.equal("admin" in normalized, false, "unknown workspace is not smuggled in");
  assert.deepEqual(
    normalized.interview,
    ["admin"],
    "a present-but-unknown string is kept as a user ID (safe: matches nobody)",
  );
});

test("returns entries in a stable order: roles first, then sorted user IDs", () => {
  const normalized = normalizeWorkspaceVisibility({
    parts: ["zz-user", "interviewer", "aa-user", "coordinator", "treasurer"],
  });
  assert.deepEqual(normalized.parts, ["coordinator", "treasurer", "interviewer", "aa-user", "zz-user"]);
});

test("gates workspaces by role, treating unknown roles as no access", () => {
  const visibility = normalizeWorkspaceVisibility({
    cad: ["coordinator", "treasurer"],
  });
  assert.equal(roleCanSeeWorkspace(visibility, "coordinator", "cad"), true);
  assert.equal(roleCanSeeWorkspace(visibility, "treasurer", "cad"), true);
  assert.equal(roleCanSeeWorkspace(visibility, "interviewer", "cad"), false);
  assert.equal(roleCanSeeWorkspace(visibility, undefined, "cad"), false);
  assert.equal(roleCanSeeWorkspace(visibility, "admin", "cad"), false);
});

test("an emptied role list locks a workspace for that role", () => {
  const visibility = normalizeWorkspaceVisibility({ chat: [] });
  assert.equal(roleCanSeeWorkspace(visibility, "coordinator", "chat"), false);
  assert.equal(roleCanSeeWorkspace(visibility, "interviewer", "chat"), false);
});

test("lists the workspaces a role can open in canonical order", () => {
  const visibility = normalizeWorkspaceVisibility({ cad: ["coordinator", "treasurer"] });
  assert.deepEqual(visibleWorkspacesForRole(visibility, "coordinator"), [
    "interview",
    "chat",
    "parts",
    "cad",
    "code",
  ]);
  assert.deepEqual(visibleWorkspacesForRole(visibility, "treasurer"), ["chat", "parts", "cad"]);
  assert.deepEqual(visibleWorkspacesForRole(visibility, "interviewer"), ["chat", "parts"]);
  assert.deepEqual(visibleWorkspacesForRole(visibility, undefined), []);
});

test("coordinators always pass the per-user check so settings never lock them out", () => {
  const visibility = normalizeWorkspaceVisibility({ chat: [] });
  assert.equal(userCanSeeWorkspace(visibility, "any-id", "coordinator", "chat"), true);
  assert.equal(userCanSeeWorkspace(visibility, undefined, "coordinator", "cad"), true);
});

test("grants access by account ID, with legacy role fallback", () => {
  const visibility = normalizeWorkspaceVisibility({
    chat: ["user-1", "user-2"],
    parts: ["interviewer"],
    cad: ["coordinator"],
  });
  assert.equal(userCanSeeWorkspace(visibility, "user-1", "interviewer", "chat"), true);
  assert.equal(userCanSeeWorkspace(visibility, "user-9", "interviewer", "chat"), false);
  assert.equal(userCanSeeWorkspace(visibility, "user-9", "interviewer", "parts"), true, "legacy role still grants");
  assert.equal(userCanSeeWorkspace(visibility, undefined, "interviewer", "parts"), true);
  assert.equal(userCanSeeWorkspace(visibility, "user-9", "interviewer", "cad"), false);
  assert.equal(userCanSeeWorkspace(visibility, undefined, undefined, "chat"), false);
});

test("lists the workspaces a user can open in canonical order", () => {
  const visibility = normalizeWorkspaceVisibility({
    chat: ["user-1"],
    code: ["user-1"],
  });
  assert.deepEqual(visibleWorkspacesForUser(visibility, "user-1", "interviewer"), ["chat", "parts", "code"]);
  assert.deepEqual(visibleWorkspacesForUser(visibility, "user-9", "interviewer"), ["parts"]);
});
