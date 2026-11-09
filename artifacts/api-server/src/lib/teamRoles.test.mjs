import assert from "node:assert/strict";
import { test, mock } from "node:test";
import {
  normalizePermissions,
  permissionsForBuiltInRole,
} from "../../../../lib/api-zod/src/permissions.ts";

const teamRolesTable = { id: "id", teamId: "teamId" };
const savedRoles = new Map([
  ["role-a", {
    id: "role-a",
    teamId: "team-a",
    name: "Interview lead",
    permissions: ["applicants.view", "future.admin"],
  }],
]);
let selectCalls = 0;
const db = {
  select() {
    selectCalls += 1;
    return {
      from(table) {
        return {
          where(conditions) {
            const filters = Array.isArray(conditions) ? conditions : [conditions];
            const matches = [...savedRoles.values()].filter((role) =>
              table === teamRolesTable && filters.every(({ field, value }) =>
                role[field] === value),
              );
            return { limit: async (count) => matches.slice(0, count) };
          },
        };
      },
    };
  },
};

mock.module("drizzle-orm", {
  namedExports: {
    and: (...conditions) => conditions,
    eq: (field, value) => ({ field, value }),
  },
});
mock.module("@workspace/db", {
  namedExports: { DEFAULT_TEAM_ID: "default", db, teamRolesTable },
});
mock.module("@workspace/api-zod", {
  namedExports: { normalizePermissions, permissionsForBuiltInRole },
});

const {
  findAssignedTeamRole,
  normalizeRoleTeamId,
  parsePermissionSelection,
  permissionsForAccount,
} = await import("./teamRoles.ts");

test("built-in Admin authority stays built-in and does not depend on custom-role storage", async () => {
  selectCalls = 0;
  assert.deepEqual(
    await permissionsForAccount({ role: "coordinator", customRoleId: "role-a", teamId: "team-a" }),
    permissionsForBuiltInRole("coordinator"),
  );
  assert.equal(selectCalls, 0);
});

test("custom role permissions are normalized and scoped to the assigned team", async () => {
  assert.deepEqual(
    await permissionsForAccount({ role: "interviewer", customRoleId: "role-a", teamId: "team-a" }),
    ["applicants.view"],
  );
  assert.equal(await findAssignedTeamRole("role-a", "team-b"), null);
  assert.equal(normalizeRoleTeamId(null), "default");
});

test("a refreshed role lookup observes saved permission changes", async () => {
  savedRoles.set("role-a", {
    ...savedRoles.get("role-a"),
    permissions: ["queue.manage"],
  });
  assert.deepEqual(
    await permissionsForAccount({ role: "interviewer", customRoleId: "role-a", teamId: "team-a" }),
    ["queue.manage"],
  );
});

test("permission selections reject unknown, malformed, and duplicate entries", () => {
  assert.deepEqual(parsePermissionSelection(["applicants.view", "queue.manage"]), ["applicants.view", "queue.manage"]);
  assert.equal(parsePermissionSelection(["applicants.view", "future.admin"]), null);
  assert.equal(parsePermissionSelection(["applicants.view", "applicants.view"]), null);
  assert.equal(parsePermissionSelection("applicants.view"), null);
});
