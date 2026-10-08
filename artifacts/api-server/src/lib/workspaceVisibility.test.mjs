import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_WORKSPACE_VISIBILITY,
  isWorkspaceKey,
  isWorkspaceRole,
  normalizeWorkspaceVisibility,
  roleCanSeeWorkspace,
  visibleWorkspacesForRole,
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

test("drops unknown roles and unknown workspaces rather than trusting them", () => {
  const normalized = normalizeWorkspaceVisibility({
    cad: ["coordinator", "superuser", "treasurer", "coordinator"],
    admin: ["coordinator"],
    interview: ["admin"],
  });
  assert.deepEqual(normalized.cad, ["coordinator", "treasurer"]);
  assert.equal("admin" in normalized, false, "unknown workspace is not smuggled in");
  assert.deepEqual(
    normalized.interview,
    [],
    "a present-but-invalid role list yields no access, not default access",
  );
});

test("returns role lists in a stable canonical order", () => {
  const normalized = normalizeWorkspaceVisibility({
    parts: ["interviewer", "coordinator", "treasurer"],
  });
  assert.deepEqual(normalized.parts, ["coordinator", "treasurer", "interviewer"]);
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

test("an emptied role list locks a workspace for everyone", () => {
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
