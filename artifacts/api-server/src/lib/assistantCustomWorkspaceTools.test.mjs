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
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const accounts = new Map([
  ["owner", { id: "owner", teamId: "team-a", role: "coordinator" }],
  ["admin", { id: "admin", teamId: "team-a", role: "admin" }],
  ["member", { id: "member", teamId: "team-a", role: "interviewer" }],
  ["other-team", { id: "other-team", teamId: "team-b", role: "coordinator" }],
]);
const workspaces = new Map();
const records = new Map();
const teamSqlCondition = (column, placeholder) => `(${column} = ${placeholder})`;
const pool = {
  async query(statement, values = []) {
    if (statement.includes('from "custom_workspaces"')) {
      const rows = [...workspaces.values()].filter((workspace) => workspace.teamId === values[0]);
      return { rows, rowCount: rows.length };
    }
    if (statement.startsWith('delete from "custom_workspace_data"')) {
      const [id, workspaceId, teamId] = values;
      const current = records.get(id);
      if (!current || current.teamId !== teamId || current.workspaceId !== workspaceId) return { rows: [], rowCount: 0 };
      records.delete(id);
      return { rows: [{ id }], rowCount: 1 };
    }
    if (statement.includes('from "custom_workspace_data"')) {
      if (statement.includes('where "id" = $1')) {
        const [id, workspaceId, teamId] = values;
        const record = records.get(id);
        const rows = record && record.teamId === teamId && record.workspaceId === workspaceId ? [record] : [];
        return { rows, rowCount: rows.length };
      }
      const [workspaceId, teamId, limit] = values;
      const matching = [...records.values()].filter((record) =>
        record.teamId === teamId && record.workspaceId === workspaceId,
      );
      return { rows: matching.slice(0, limit ?? 50), rowCount: matching.length };
    }
    if (statement.startsWith('insert into "custom_workspace_data"')) {
      const [id, teamId, workspaceId, encoded] = values;
      const now = new Date().toISOString();
      const record = { id, teamId, workspaceId, value: JSON.parse(encoded), createdAt: now, updatedAt: now };
      records.set(id, record);
      return { rows: [record], rowCount: 1 };
    }
    if (statement.startsWith('update "custom_workspace_data"')) {
      const [id, workspaceId, encoded, teamId] = values;
      const current = records.get(id);
      if (!current || current.teamId !== teamId || current.workspaceId !== workspaceId) return { rows: [], rowCount: 0 };
      const updated = { ...current, value: JSON.parse(encoded), updatedAt: new Date().toISOString() };
      records.set(id, updated);
      return { rows: [updated], rowCount: 1 };
    }
    if (statement.startsWith('delete from "custom_workspace_data"')) {
      const [id, workspaceId, teamId] = values;
      const current = records.get(id);
      if (!current || current.teamId !== teamId || current.workspaceId !== workspaceId) return { rows: [], rowCount: 0 };
      records.delete(id);
      return { rows: [{ id }], rowCount: 1 };
    }
    throw new Error(`Unexpected custom workspace tool query: ${statement}`);
  },
};

mock.module("@workspace/db", { namedExports: { DEFAULT_TEAM_ID: "default", pool } });
mock.module("./interviewerAccounts", { namedExports: { accountById: async (id) => accounts.get(id) } });
mock.module("./teams", { namedExports: { teamSqlCondition } });

const {
  CUSTOM_WORKSPACE_TOOL_NAME_PATTERN,
  listAssistantCustomWorkspaceTools,
  runAssistantCustomWorkspaceTool,
  validateWorkspaceToolDeclarations,
  workspaceAssistantToolName,
} = await import("./assistantCustomWorkspaceTools.ts");

const readAction = {
  id: "read-action",
  name: "find_by_status",
  description: "Find records by their status.",
  enabled: true,
  intent: "read",
  operation: "get",
  inputSchema: {
    type: "object",
    properties: { recordId: { type: "string", maxLength: 64 } },
    required: ["recordId"],
    additionalProperties: false,
  },
  recordIdArgument: "recordId",
};
const writeAction = {
  id: "write-action",
  name: "save_item",
  description: "Save a record with a name and priority.",
  enabled: true,
  intent: "write",
  operation: "create",
  inputSchema: {
    type: "object",
    properties: {
      name: { type: "string", minLength: 1, maxLength: 60 },
      priority: { type: "integer", minimum: 1, maximum: 5 },
    },
    required: ["name", "priority"],
    additionalProperties: false,
  },
  fields: { name: "name", priority: "priority" },
};
const workspace = (overrides = {}) => ({
  id: "workspace-a",
  title: "Team tracker",
  status: "published",
  capabilities: ["data"],
  createdBy: "owner",
  accessMode: "team",
  allowedInterviewerIds: [],
  teamId: "team-a",
  assistantTools: validateWorkspaceToolDeclarations([readAction, writeAction]),
  ...overrides,
});

test("workspace action declarations enforce bounded schemas and operation mappings", () => {
  const valid = validateWorkspaceToolDeclarations([readAction, writeAction]);
  assert.equal(valid.length, 2);
  assert.equal(valid[0].enabled, true);
  assert.throws(() => validateWorkspaceToolDeclarations([{ ...writeAction, intent: "read" }]), /marked write/);
  assert.throws(() => validateWorkspaceToolDeclarations([{ ...readAction, inputSchema: {
    ...readAction.inputSchema,
    properties: { query: { type: "object", properties: {} } },
  } }]), /contains an unsupported setting/);
  assert.throws(() => validateWorkspaceToolDeclarations([{ ...writeAction, fields: { name: "name" } }]), /map every non-ID input/);
  assert.throws(() => validateWorkspaceToolDeclarations({}), /Provide at most/);
  assert.throws(() => validateWorkspaceToolDeclarations([{
    ...readAction,
    description: "x".repeat(241),
  }]), /description of 1–240/);
  assert.throws(() => validateWorkspaceToolDeclarations([{
    ...readAction,
    inputSchema: {
      type: "object",
      properties: Object.fromEntries(Array.from({ length: 13 }, (_, index) => [`field${index}`, { type: "string" }])),
      required: [],
      additionalProperties: false,
    },
  }]), /at most 12 input fields/);
});

test("names are stable, bounded, and tied to the workspace", () => {
  const one = workspaceAssistantToolName("workspace-a", "save_item");
  assert.equal(one, workspaceAssistantToolName("workspace-a", "save_item"));
  assert.notEqual(one, workspaceAssistantToolName("workspace-b", "save_item"));
  assert.match(one, CUSTOM_WORKSPACE_TOOL_NAME_PATTERN);
  assert.equal(CUSTOM_WORKSPACE_TOOL_NAME_PATTERN.test("cw_not-a-workspace_save_item"), false);
});

test("catalog exposes standard data actions and only enabled actions for accessible published apps", async () => {
  workspaces.clear();
  workspaces.set("workspace-a", workspace());
  workspaces.set("workspace-private", workspace({ id: "workspace-private", accessMode: "owner", createdBy: "other-team" }));
  workspaces.set("workspace-selected", workspace({ id: "workspace-selected", accessMode: "selected", allowedInterviewerIds: ["owner"] }));
  workspaces.set("workspace-no-data", workspace({ id: "workspace-no-data", capabilities: [] }));
  workspaces.set("workspace-draft", workspace({ id: "workspace-draft", status: "draft" }));
  const tools = await listAssistantCustomWorkspaceTools("owner", "team-a");
  const names = tools.map((tool) => tool.function.name);
  assert.equal(names.length, 16, "the coordinator can use only accessible published data workspaces");
  assert.ok(names.includes(workspaceAssistantToolName("workspace-a", "save_item")));
  assert.ok(names.includes(workspaceAssistantToolName("workspace-selected", "find_by_status")));
  assert.equal(names.some((name) => name.includes("workspace-private")), false);
  assert.deepEqual(await listAssistantCustomWorkspaceTools("member", "team-a"), []);
  assert.deepEqual(await listAssistantCustomWorkspaceTools("admin", "team-a"), []);
  assert.deepEqual(await listAssistantCustomWorkspaceTools("other-team", "team-a"), []);
});

test("standard CRUD and declared writes stay scoped to the published workspace and team", async () => {
  workspaces.clear();
  records.clear();
  workspaces.set("workspace-a", workspace());
  const prefix = workspaceAssistantToolName("workspace-a", "list_records").slice(0, 20);
  const created = await runAssistantCustomWorkspaceTool(`${prefix}create_record`, { record: { item: "gearbox" } }, {
    accountId: "owner", teamId: "team-a",
  });
  const createdRecord = JSON.parse(created.content);
  assert.equal(createdRecord.value.item, "gearbox");
  const updated = await runAssistantCustomWorkspaceTool(`${prefix}update_record`, {
    recordId: createdRecord.id, record: { item: "motor" },
  }, { accountId: "owner", teamId: "team-a" });
  assert.equal(JSON.parse(updated.content).value.item, "motor");
  const read = await runAssistantCustomWorkspaceTool(`${prefix}get_record`, {
    recordId: createdRecord.id,
  }, { accountId: "owner", teamId: "team-a" });
  assert.equal(JSON.parse(read.content).value.item, "motor");
  const named = await runAssistantCustomWorkspaceTool(
    workspaceAssistantToolName("workspace-a", "save_item"),
    { name: "starter kit", priority: 3 },
    { accountId: "owner", teamId: "team-a" },
  );
  assert.equal(JSON.parse(named.content).value.priority, 3);
  assert.match((await runAssistantCustomWorkspaceTool(`${prefix}list_records`, {}, {
    accountId: "owner", teamId: "team-a",
  })).content, /starter kit/);

  const forbidden = await runAssistantCustomWorkspaceTool(`${prefix}get_record`, {
    recordId: createdRecord.id,
  }, { accountId: "other-team", teamId: "team-a" });
  assert.match(forbidden.content, /no longer available/i);
  const deleted = await runAssistantCustomWorkspaceTool(`${prefix}delete_record`, {
    recordId: createdRecord.id,
  }, { accountId: "owner", teamId: "team-a" });
  assert.equal(JSON.parse(deleted.content).deleted, true);
});

test("malformed inputs, disabled actions, and changed access are rejected before writes", async () => {
  workspaces.clear();
  records.clear();
  workspaces.set("workspace-a", workspace());
  const name = workspaceAssistantToolName("workspace-a", "save_item");
  assert.match((await runAssistantCustomWorkspaceTool(name, { name: "missing priority" }, {
    accountId: "owner", teamId: "team-a",
  })).content, /required input "priority"/i);
  assert.match((await runAssistantCustomWorkspaceTool(name, {
    name: "bad priority", priority: 8,
  }, { accountId: "owner", teamId: "team-a" })).content, /above its maximum/i);
  assert.equal(records.size, 0);

  workspaces.set("workspace-a", workspace({
    assistantTools: validateWorkspaceToolDeclarations([{ ...writeAction, enabled: false }]),
  }));
  assert.match((await runAssistantCustomWorkspaceTool(name, {
    name: "not saved", priority: 2,
  }, { accountId: "owner", teamId: "team-a" })).content, /disabled or no longer exists/i);
  workspaces.set("workspace-a", workspace({ accessMode: "selected", allowedInterviewerIds: ["member"] }));
  assert.match((await runAssistantCustomWorkspaceTool(name, {
    name: "not allowed", priority: 2,
  }, { accountId: "owner", teamId: "team-a" })).content, /no longer have access/i);
  assert.equal(records.size, 0);
});

test("both assistant request paths discover workspace tools and dispatch through the scoped executor", () => {
  const source = readFileSync(new URL("../routes/robotics.ts", import.meta.url), "utf8");
  const nonStreamingStart = source.indexOf("async function generateAssistantAnswer(");
  const nonStreamingEnd = source.indexOf('router.post("/assistant/ask"', nonStreamingStart);
  assert.ok(nonStreamingStart >= 0 && nonStreamingEnd > nonStreamingStart);
  const nonStreaming = source.slice(nonStreamingStart, nonStreamingEnd);
  assert.match(nonStreaming, /listAssistantCustomWorkspaceTools\(options\.accountId, teamId\)/);
  assert.match(nonStreaming, /assistantToolsForRequest\([\s\S]*?customWorkspaceTools/);

  const streamingStart = source.indexOf('router.post("/assistant/ask/stream"');
  const toolCatalogEnd = source.indexOf('router.get("/assistant/tools"', streamingStart);
  assert.ok(streamingStart >= 0 && toolCatalogEnd > streamingStart);
  const streaming = source.slice(streamingStart, toolCatalogEnd);
  assert.match(streaming, /listAssistantCustomWorkspaceTools\(account\.id, teamId\)/);
  assert.match(streaming, /assistantToolsForRequest\([\s\S]*?customWorkspaceTools/);
  assert.match(source, /runAssistantCustomWorkspaceTool\(name, args,/);
});
