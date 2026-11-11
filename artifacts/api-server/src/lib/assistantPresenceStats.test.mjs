import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.(?:ts|js|mjs|json)$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const accountsTable = {
  id: "account.id",
  displayName: "account.displayName",
  normalizedName: "account.normalizedName",
  teamId: "account.teamId",
};
const visitsTable = {
  accountId: "visit.accountId",
  teamId: "visit.teamId",
  enteredAt: "visit.enteredAt",
};
const state = {
  accounts: [
    { id: "account-team-a", displayName: "Alex Smith", normalizedName: "alex smith", teamId: "team-a" },
    { id: "account-team-b", displayName: "Alex Smith", normalizedName: "alex smith", teamId: "team-b" },
    { id: "account-no-visits", displayName: "Jordan Lee", normalizedName: "jordan lee", teamId: "team-a" },
  ],
  visits: [
    { accountId: "account-team-a", teamId: "team-a", sessionHash: "a-1", page: "/chat", enteredAt: new Date("2026-11-10T10:00:00Z"), exitedAt: new Date("2026-11-10T10:02:00Z"), ip: "192.0.2.10" },
    { accountId: "account-team-a", teamId: "team-a", sessionHash: "a-2", page: "/parts", enteredAt: new Date("2026-11-10T11:00:00Z"), exitedAt: new Date("2026-11-10T11:01:00Z"), ip: "192.0.2.11" },
    { accountId: "account-team-a", teamId: "team-b", sessionHash: "b-1", page: "/private", enteredAt: new Date("2026-11-10T12:00:00Z"), exitedAt: new Date("2026-11-10T14:00:00Z"), ip: "198.51.100.20" },
  ],
};

const condition = (type, ...values) => ({ type, values });
const columnToField = {
  "account.id": "id",
  "account.displayName": "displayName",
  "account.normalizedName": "normalizedName",
  "account.teamId": "teamId",
  "visit.accountId": "accountId",
  "visit.teamId": "teamId",
  "visit.enteredAt": "enteredAt",
};
const db = {
  select(projection) {
    let table;
    let where;
    const project = (rows) => projection
      ? rows.map((row) => Object.fromEntries(Object.entries(projection).map(([key, column]) => [key, row[columnToField[column]]])))
      : rows;
    const query = {
      from(value) {
        table = value;
        return query;
      },
      where(value) {
        where = value;
        return query;
      },
      orderBy() {
        return query;
      },
      async limit(max) {
        return project(rowsForQuery(table, where).slice(0, max));
      },
      then(resolve, reject) {
        return Promise.resolve(project(rowsForQuery(table, where))).then(resolve, reject);
      },
    };
    return query;
  },
};

function matches(row, queryCondition) {
  if (!queryCondition) return true;
  if (queryCondition.type === "and") return queryCondition.values.every((child) => matches(row, child));
  if (queryCondition.type === "eq") {
    return row[columnToField[queryCondition.values[0]]] === queryCondition.values[1];
  }
  if (queryCondition.type === "team") {
    return row[columnToField[queryCondition.values[0]]] === queryCondition.values[1];
  }
  return false;
}

function rowsForQuery(table, where) {
  const rows = table === accountsTable ? state.accounts : table === visitsTable ? state.visits : [];
  return rows.filter((row) => matches(row, where));
}

mock.module("drizzle-orm", {
  namedExports: {
    and: (...values) => condition("and", ...values),
    desc: (value) => condition("desc", value),
    eq: (column, value) => condition("eq", column, value),
    isNull: (column) => condition("isNull", column),
  },
});
mock.module("@workspace/db", {
  namedExports: { db, interviewerAccountsTable: accountsTable, pageVisitsTable: visitsTable },
});
mock.module("./teams", {
  namedExports: { teamFilter: (column, teamId) => condition("team", column, teamId) },
});
mock.module("./interviewerAccounts", {
  namedExports: { normalizeInterviewerName: (value) => value.trim().replace(/\s+/g, " ").toLowerCase() },
});
mock.module("./workspaceUsageTracking", {
  namedExports: { closeWorkspaceUsageVisit: async () => {} },
});

const { resolvePresenceUser, formatPresenceStats } = await import("./assistantPresenceStats.ts");
const { getAccountStats } = await import("./presence.ts");

test.after(() => mock.restoreAll());

test("presence person lookup resolves account ids and names only inside the active team", async () => {
  assert.deepEqual(await resolvePresenceUser("account-team-a", "team-a"), {
    account: { id: "account-team-a", displayName: "Alex Smith" },
  });
  assert.deepEqual(await resolvePresenceUser("Alex Smith", "team-a"), {
    account: { id: "account-team-a", displayName: "Alex Smith" },
  });
  assert.match((await resolvePresenceUser("account-team-b", "team-a")).error, /Nobody on this team/);
  assert.match((await resolvePresenceUser("   ", "team-a")).error, /No user given/);
});

test("account usage totals exclude the same account's visits from another team", async () => {
  const stats = await getAccountStats("account-team-a", "team-a");
  assert.equal(stats.totalSeconds, 180);
  assert.equal(stats.sessionCount, 2);
  assert.equal(stats.visitCount, 2);
  assert.deepEqual(stats.pages.map(({ page, visits, seconds }) => ({ page, visits, seconds })), [
    { page: "/chat", visits: 1, seconds: 120 },
    { page: "/parts", visits: 1, seconds: 60 },
  ]);
  assert.equal(Object.hasOwn(stats, "ip"), false);
  assert.equal(JSON.stringify(stats).includes("192.0.2."), false);
});

test("zero-visit accounts get a clear no-data response without IP fields", async () => {
  const stats = await getAccountStats("account-no-visits", "team-a");
  const formatted = formatPresenceStats("Jordan Lee", stats);
  assert.deepEqual(
    { totalSeconds: stats.totalSeconds, sessionCount: stats.sessionCount, visitCount: stats.visitCount, firstSeenAt: stats.firstSeenAt },
    { totalSeconds: 0, sessionCount: 0, visitCount: 0, firstSeenAt: null },
  );
  assert.equal(formatted.content, "No recorded visits for Jordan Lee.");
  assert.equal(JSON.stringify(formatted).includes("ip"), false);
});

test("assistant presence tool uses the person argument and account-scoped helper, with no stale IP API", async () => {
  const source = await readFile(new URL("../routes/robotics.ts", import.meta.url), "utf8");
  assert.match(source, /import \{ getAccountStats \} from "\.\.\/lib\/presence"/);
  assert.match(source, /resolvePresenceUser\(rawTarget, team\)/);
  assert.match(source, /getAccountStats\(target\.id, team\)/);
  assert.doesNotMatch(source, /\bgetIpStats\b|\bstats\.ip\b/);
  assert.match(source, /name: "presence_stats"[\s\S]*?user: \{ type: "string"/);
});
