import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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
  ["member-a", { id: "member-a", teamId: "team-a", role: "interviewer", displayName: "Member A" }],
  ["member-b", { id: "member-b", teamId: "team-a", role: "interviewer", displayName: "Member B" }],
  ["coordinator-a", { id: "coordinator-a", teamId: "team-a", role: "coordinator", displayName: "Coordinator A" }],
  ["other-team", { id: "other-team", teamId: "team-b", role: "coordinator", displayName: "Other Team" }],
]);
const tasks = new Map();
const queries = [];
let channelMembers = [];
let channelMessages = [];
const pool = {
  async connect() {
    return { query: (...args) => pool.query(...args), release() {} };
  },
  async query(statement, values = []) {
    queries.push({ statement, values });
    if (["begin", "commit", "rollback"].includes(statement)) return { rows: [], rowCount: 0 };
    if (statement.includes('count(*)::int as "count"')) {
      const count = [...tasks.values()].filter((task) =>
        task.team_id === values[0] && task.owner_id === values[1] && task.status !== "cancelled",
      ).length;
      return { rows: [{ count }], rowCount: 1 };
    }
    if (statement.includes('from "chat_channels" c')) {
      const role = values[1];
      const accountId = values[2];
      const rows = role === "coordinator" || accountId === "member-a"
        ? [{ id: "build-channel", name: "Builds" }]
        : [];
      return { rows, rowCount: rows.length };
    }
    if (statement.startsWith('insert into "assistant_scheduled_tasks"')) {
      const [id, teamId, ownerId, prompt, recurrence, timeZone, destinationChannel, activationCode, allowedTools, disabledTools] = values;
      tasks.set(id, {
        id, team_id: teamId, owner_id: ownerId, prompt, status: "draft",
        recurrence: JSON.parse(recurrence), time_zone: timeZone,
        destination_channel: destinationChannel, activation_code: activationCode,
        allowed_tools: JSON.parse(allowedTools), disabled_tools: JSON.parse(disabledTools),
        next_run_at: null, last_run_at: null, last_error: null, created_at: new Date(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (statement.includes('from "assistant_scheduled_tasks"') && statement.includes('"owner_id" = $3')) {
      const row = tasks.get(values[0]);
      const rows = row && row.team_id === values[1] && row.owner_id === values[2] ? [row] : [];
      return { rows, rowCount: rows.length };
    }
    if (statement.includes('from "assistant_scheduled_tasks"') && statement.includes('order by "created_at" desc')) {
      const rows = [...tasks.values()].filter((row) => row.team_id === values[0] && row.owner_id === values[1]);
      return { rows, rowCount: rows.length };
    }
    if (statement.includes('from "assistant_scheduled_task_runs"')) return { rows: [], rowCount: 0 };
    if (statement.startsWith('update "assistant_scheduled_tasks"')) {
      const row = tasks.get(values[0]);
      if (row && row.team_id === values[1] && row.owner_id === values[2]) {
        if (statement.includes('"status" = \'active\'')) {
          row.status = "active";
          row.activation_code = null;
          row.next_run_at = values[3];
        }
        return { rows: [{ id: row.id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (statement.startsWith('insert into "chat_channels"')) return { rows: [], rowCount: 1 };
    if (statement.includes('from "interviewer_accounts"')) {
      return {
        rows: [...accounts.values()].filter((account) => account.teamId === values[0])
          .map(({ id, displayName }) => ({ id, display_name: displayName })),
        rowCount: 3,
      };
    }
    if (statement.startsWith('insert into "chat_channel_members"')) {
      channelMembers.push(values);
      return { rows: [], rowCount: 1 };
    }
    if (statement.includes('from "interview_chat_messages"') && statement.includes('"conversation_scope" = \'channel\'')) {
      channelMessages = [{
        id: "message-1", author: "AI assistant", message: "Build update",
        createdAt: new Date("2026-10-20T15:00:00Z"), deletedAt: null,
      }];
      return { rows: channelMessages, rowCount: channelMessages.length };
    }
    throw new Error(`Unexpected assistant task query: ${statement}`);
  },
};

mock.module("@workspace/db", { namedExports: { DEFAULT_TEAM_ID: "default", pool } });
mock.module("@workspace/integrations-openai-ai-server", { namedExports: { openai: {} } });
mock.module("./codeCollaboration", { namedExports: { applyCodeFileContent: async () => {} } });
mock.module("./realtime", { namedExports: { pushRealtimeHint: () => {} } });
mock.module("./teams", {
  namedExports: { teamSqlCondition: (column, placeholder) => `(${column} = ${placeholder})` },
});
mock.module("./interviewerAccounts", {
  namedExports: { accountById: async (id) => accounts.get(id) },
});
mock.module("./workspaceAccess", { namedExports: { readWorkspaceVisibility: async () => ({}) } });
mock.module("./workspaceVisibility", { namedExports: { userCanSeeWorkspace: () => true } });
mock.module("./assistantModel", { namedExports: { getAssistantModel: async () => "test-model" } });

const { runAssistantWorkspaceTool, ASSISTANT_WORKSPACE_TOOLS } =
  await import("./assistantWorkspaceTools.ts");

const baseContext = {
  accountId: "member-a",
  teamId: "team-a",
  authorName: "Member A",
  role: "interviewer",
};

test("creates an owner-scoped draft and saves only enabled, supported task tools", async () => {
  const result = await runAssistantWorkspaceTool("create_scheduled_assistant_task", {
    prompt: "Search for weekly competition updates and post a summary.",
    frequency: "weekly",
    hour: 9,
    minute: 30,
    daysOfWeek: [1],
    timeZone: "America/Los_Angeles",
    channelName: "Builds",
  }, {
    ...baseContext,
    allowedToolNames: ["web_search", "send_team_chat_message", "create_applicant", "create_team_chat_channel"],
    disabledTools: ["web_search"],
  });
  const created = JSON.parse(result.content);
  const task = tasks.get(created.id);
  assert.equal(task.status, "draft");
  assert.equal(task.team_id, "team-a");
  assert.equal(task.owner_id, "member-a");
  assert.deepEqual(task.allowed_tools, ["send_team_chat_message"]);
  assert.deepEqual(task.disabled_tools, ["web_search"]);
  assert.equal(task.destination_channel, "Builds");
  assert.equal(task.next_run_at, null);
  assert.match(created.nextStep, /activate/);
});

test("coordinators can schedule channel creation while other roles cannot", async () => {
  const created = await runAssistantWorkspaceTool("create_scheduled_assistant_task", {
    prompt: "Create the Robotics Weekly channel and invite the team, then post a summary.",
    frequency: "weekly",
    hour: 10,
    minute: 0,
    daysOfWeek: [1],
    timeZone: "UTC",
  }, {
    ...baseContext,
    accountId: "coordinator-a",
    authorName: "Coordinator A",
    role: "coordinator",
    allowedToolNames: ["create_team_chat_channel", "send_team_chat_message"],
  });
  const task = tasks.get(JSON.parse(created.content).id);
  assert.deepEqual(task.allowed_tools, ["create_team_chat_channel", "send_team_chat_message"]);
});

test("activation requires a later user message with the exact draft code", async () => {
  const draft = await runAssistantWorkspaceTool("create_scheduled_assistant_task", {
    prompt: "Read recent updates.",
    frequency: "weekly",
    hour: 9,
    minute: 0,
    daysOfWeek: [2],
    timeZone: "UTC",
  }, { ...baseContext, allowedToolNames: ["list_team_chat_messages"] });
  const created = JSON.parse(draft.content);
  const activation = { taskId: created.id, confirmationCode: created.activationCode };
  const sameTurn = await runAssistantWorkspaceTool("activate_scheduled_assistant_task", activation, {
    ...baseContext,
    confirmationText: "Please set up that task.",
  });
  assert.equal(sameTurn.detail, "activation confirmation mismatch");
  assert.equal(tasks.get(created.id).status, "draft");

  const confirmed = await runAssistantWorkspaceTool("activate_scheduled_assistant_task", activation, {
    ...baseContext,
    confirmationText: `activate ${created.activationCode}`,
  });
  assert.equal(tasks.get(created.id).status, "active");
  assert.equal(tasks.get(created.id).activation_code, null);
  assert.match(confirmed.content, /"nextRunAt"/);
});

test("another team cannot inspect a task and team members cannot create channels", async () => {
  const createdTask = [...tasks.values()][0];
  const leaked = await runAssistantWorkspaceTool("pause_scheduled_assistant_task", {
    taskId: createdTask.id,
  }, { ...baseContext, accountId: "other-team", teamId: "team-b", role: "coordinator" });
  assert.equal(leaked.detail, "task not found");

  const denied = await runAssistantWorkspaceTool("create_team_chat_channel", {
    name: "Private Planning",
    inviteAllTeamMembers: true,
  }, baseContext);
  assert.equal(denied.detail, "access denied");
  assert.equal(channelMembers.length, 0);
});

test("coordinator channel creation can invite only members of the current team", async () => {
  const created = await runAssistantWorkspaceTool("create_team_chat_channel", {
    name: "Planning",
    inviteAllTeamMembers: true,
  }, {
    ...baseContext,
    accountId: "coordinator-a",
    authorName: "Coordinator A",
    role: "coordinator",
  });
  const result = JSON.parse(created.content);
  assert.equal(result.name, "Planning");
  assert.deepEqual(result.invitedMembers.sort(), ["Coordinator A", "Member A", "Member B"]);
  assert.equal(channelMembers.length, 3);
  assert.ok(channelMembers.every((values) => values[1] === "team-a"));
});

test("channel history is date-bounded and the tool never reads direct messages", async () => {
  const result = await runAssistantWorkspaceTool("read_team_chat_channel_history", {
    channelName: "Builds",
    startDate: "2026-10-20",
    endDate: "2026-10-20",
  }, baseContext);
  assert.equal(JSON.parse(result.content)[0].message, "Build update");
  const query = queries.at(-1);
  assert.match(query.statement, /"conversation_scope" = 'channel'/);
  assert.doesNotMatch(query.statement, /'direct'/);
  assert.equal(query.values[1], "build-channel");
  assert.equal(query.values[2].toISOString(), "2026-10-20T00:00:00.000Z");
  assert.equal(query.values[3].toISOString(), "2026-10-21T00:00:00.000Z");
});

test("assistant tool catalogs expose scheduling controls and channel history", () => {
  const names = new Set(ASSISTANT_WORKSPACE_TOOLS.map((item) => item.function.name));
  for (const name of [
    "create_scheduled_assistant_task",
    "activate_scheduled_assistant_task",
    "list_scheduled_assistant_tasks",
    "update_scheduled_assistant_task",
    "pause_scheduled_assistant_task",
    "resume_scheduled_assistant_task",
    "cancel_scheduled_assistant_task",
    "read_team_chat_channel_history",
    "create_team_chat_channel",
  ]) assert.ok(names.has(name), `expected ${name} in assistant tool catalog`);
});

test("shared and @ai surfaces expose scheduled tools and carry the same disabled-tool setting", async () => {
  const appSource = await readFile(new URL("../../../robotics-interview-dashboard/src/App.tsx", import.meta.url), "utf8");
  const settingsSource = await readFile(new URL("../../../robotics-interview-dashboard/src/components/assistantTools.ts", import.meta.url), "utf8");
  const routeSource = await readFile(new URL("../routes/robotics.ts", import.meta.url), "utf8");
  assert.match(appSource, /disabledTools: chatAssistantDisabledTools/);
  assert.match(settingsSource, /name: "create_scheduled_assistant_task"/);
  assert.match(settingsSource, /name: "cancel_scheduled_assistant_task"/);
  assert.match(routeSource, /ASSISTANT_AUTOMATION_TOOL_NAMES\.has\(tool\.function\.name\)/);
  assert.match(routeSource, /scheduledAllowedToolNames/);
  assert.match(routeSource, /conversationOwnerId: owner\.id/);
  assert.match(routeSource, /for update skip locked/i);
  assert.match(routeSource, /on conflict \("idempotency_key"\) do nothing/i);
  assert.match(routeSource, /onScheduledSideEffect/);
});

test.after(() => mock.restoreAll());
