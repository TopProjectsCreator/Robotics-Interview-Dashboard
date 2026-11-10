import assert from "node:assert/strict";
import test from "node:test";

const {
  safeWorkspaceName,
  splitForegroundInterval,
  workspaceIdentityForPath,
} = await import("./workspaceUsage.ts");

test("workspace routes resolve to canonical built-in and individual custom identities", () => {
  assert.deepEqual(workspaceIdentityForPath("/applicants?filter=shortlist"), {
    workspaceKey: "interview",
    customWorkspaceId: null,
  });
  assert.deepEqual(workspaceIdentityForPath("/assistant/scheduled-tasks"), {
    workspaceKey: "chat",
    customWorkspaceId: null,
  });
  assert.deepEqual(workspaceIdentityForPath("/parts/assistant"), {
    workspaceKey: "parts",
    customWorkspaceId: null,
  });
  assert.deepEqual(workspaceIdentityForPath("/custom-workspaces/ws_42/tabs/overview"), {
    workspaceKey: "custom",
    customWorkspaceId: "ws_42",
  });
  assert.equal(workspaceIdentityForPath("/dashboard"), null);
  assert.equal(workspaceIdentityForPath("/custom-workspaces/a%2Fb"), null);
  assert.equal(workspaceIdentityForPath(`/chat/${"x".repeat(520)}`), null);
});

test("foreground intervals split at UTC midnight and never exceed the heartbeat cap", () => {
  assert.deepEqual(
    splitForegroundInterval(
      new Date("2026-11-09T23:59:45.500Z"),
      new Date("2026-11-10T00:00:45.500Z"),
    ),
    [
      { activityDate: "2026-11-09", activeSeconds: 15 },
      { activityDate: "2026-11-10", activeSeconds: 30 },
    ],
  );
  assert.deepEqual(
    splitForegroundInterval(
      new Date("2026-11-09T12:00:00.000Z"),
      new Date("2026-11-09T12:20:00.000Z"),
    ),
    [{ activityDate: "2026-11-09", activeSeconds: 45 }],
  );
  assert.deepEqual(
    splitForegroundInterval(
      new Date("2026-11-09T12:00:00.000Z"),
      new Date("2026-11-09T11:59:00.000Z"),
    ),
    [],
  );
});

test("custom workspace names are safe plain text and bounded", () => {
  assert.equal(safeWorkspaceName("  Team\u202eApp\u0000\u200b "), "TeamApp");
  assert.equal(safeWorkspaceName(" \n "), "Untitled workspace");
  assert.equal(safeWorkspaceName("a".repeat(150)).length, 120);
});
