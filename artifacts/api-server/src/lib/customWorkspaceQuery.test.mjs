import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});

mock.module("@workspace/db", {
  namedExports: {
    DEFAULT_TEAM_ID: "default",
    db: {},
    codeFilesTable: { id: "id" },
    currentInstance: () => "primary",
    interviewerAccountsTable: { id: "id", teamId: "teamId", role: "role", passwordHash: "passwordHash" },
    revokedSessionsTable: { tokenHash: "tokenHash", expiresAt: "expiresAt" },
    runWithInstance: (_instance, callback) => callback(),
    pool: { query: async () => ({ rows: [], rowCount: 0 }) },
  },
});
mock.module("./interviewerAccounts", { namedExports: { accountById: async () => null } });
  mock.module("./teams", {
    namedExports: {
      teamSqlCondition: (column, placeholder) => `(${column} = ${placeholder})`,
      findAccountAnywhere: async () => null,
    },
  });

const {
  parseRecordQuery,
  buildRecordQuerySql,
  listAssistantCustomWorkspaceTools,
} = await import("./assistantCustomWorkspaceTools.ts");

const { pathInScope, REAL_APP_DATA_RULE } = await import("./assistantWorkspaceTools.ts").catch(async () => {
  mock.module("@workspace/integrations-openai-ai-server", {
    namedExports: { openai: { chat: { completions: { create: async () => ({ choices: [{ message: { content: "{}" } }] }) } } } },
  });
  mock.module("./codeCollaboration", { namedExports: { applyCodeFileContent: async () => {} } });
  mock.module("./realtime", { namedExports: { pushRealtimeHint() {} } });
  mock.module("./workspaceAccess", { namedExports: { readWorkspaceVisibility: async () => ({}) } });
  mock.module("./workspaceVisibility", { namedExports: { userCanSeeWorkspace: () => true } });
  mock.module("./assistantModel", { namedExports: { getAssistantModel: async () => "test-model" } });
  mock.module("./assistantSchedule", { namedExports: { nextAssistantTaskOccurrence: async () => null, validateAssistantTaskSchedule: () => null } });
  mock.module("./customWorkspaceDeletion", { namedExports: { deleteCustomWorkspace: async () => null } });
  return import("./assistantWorkspaceTools.ts");
});

test("parseRecordQuery normalizes defaults and rejects hostile input", () => {
  const defaults = parseRecordQuery({});
  assert.deepEqual(defaults, { limit: 50, offset: 0, search: null, filters: {}, sortBy: null, sortDir: "desc" });
  assert.match(parseRecordQuery({ sortBy: "status; DROP TABLE x" }).error, /sortBy/);
  assert.match(parseRecordQuery({ filters: { "a; drop": 1 } }).error, /filter field/);
  assert.match(parseRecordQuery({ limit: 999 }).error, /limit/);
  const parsed = parseRecordQuery({ limit: 10, offset: 20, filters: { status: "open", qty: 2 }, sortBy: "name", sortDir: "asc" });
  assert.equal(parsed.limit, 10);
  assert.equal(parsed.sortDir, "asc");
});

test("buildRecordQuerySql binds values and orders by record fields", () => {
  const query = parseRecordQuery({ filters: { status: "open" }, search: "bolt", sortBy: "name", sortDir: "asc" });
  const { clauses, values, orderBy } = buildRecordQuerySql(query, { workspaceId: "w", teamId: "t" });
  assert.match(clauses.join(" "), /"value" -> "status"/);
  assert.match(clauses.join(" "), /ilike/);
  assert.match(orderBy, /\("value" ->> "name"\) ASC/);
  assert.deepEqual(values, ["w", "t", '"open"', "%bolt%"]);
  assert.ok(!clauses.join(" ").includes("DROP"));
});

test("pathInScope enforces disjoint file ownership", () => {
  assert.equal(pathInScope("assets/icon.svg", ["assets/"]), true);
  assert.equal(pathInScope("app.js", ["assets/"]), false);
  assert.equal(pathInScope("index.html", undefined), true);
});

test("strict no-mock rule is present in builder prompts", () => {
  const toolsSource = readFileSync(new URL("./assistantWorkspaceTools.ts", import.meta.url), "utf8");
  assert.match(toolsSource, /NEVER seed, invent, or display mock/);
  assert.match(REAL_APP_DATA_RULE, /real tool, not a mock visual/);
  const jobsSource = readFileSync(new URL("./assistantBuilderJobs.ts", import.meta.url), "utf8");
  assert.match(jobsSource, /NEVER seed, invent, or display mock/);
  const roboticsSource = readFileSync(new URL("../routes/robotics.ts", import.meta.url), "utf8");
  assert.match(roboticsSource, /spawn_workspace_subagent_team/);
  assert.ok(typeof listAssistantCustomWorkspaceTools === "function");
});
