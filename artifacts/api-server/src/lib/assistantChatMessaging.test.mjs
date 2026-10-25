import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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

const channels = [
  { id: "channel-builds", teamId: "team-a", name: "Builds", members: ["member-a"] },
  { id: "channel-outreach", teamId: "team-a", name: "Outreach", members: [] },
  { id: "channel-other-team", teamId: "team-b", name: "Builds", members: ["member-a"] },
];
const accounts = new Map([
  ["member-a", { id: "member-a", teamId: "team-a", role: "interviewer" }],
  ["coordinator-a", { id: "coordinator-a", teamId: "team-a", role: "coordinator" }],
  ["coordinator-b", { id: "coordinator-b", teamId: "team-b", role: "coordinator" }],
]);
const inserts = [];
const realtimeHints = [];
const teamCondition = (column, placeholder) =>
  `(${column} = ${placeholder} or (${placeholder} = 'default' and ${column} is null))`;

const pool = {
  async query(statement, values = []) {
    if (statement.includes('from "chat_channels" c')) {
      assert.match(statement, /c\."team_id" = \$1/, "channel lookup must use the authenticated team's id");
      assert.match(statement, /m\."member_id" = \$3/, "member access must use the authenticated account id");
      const [teamId, role, accountId] = values;
      const rows = channels
        .filter((channel) =>
          channel.teamId === teamId &&
          (role === "coordinator" || channel.members.includes(accountId)),
        )
        .map(({ id, name }) => ({ id, name }));
      return { rows, rowCount: rows.length };
    }
    if (statement.startsWith('insert into "interview_chat_messages"')) {
      inserts.push({ statement, values });
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected assistant chat query: ${statement}`);
  },
};

mock.module("@workspace/db", { namedExports: { DEFAULT_TEAM_ID: "default", pool } });
mock.module("@workspace/integrations-openai-ai-server", { namedExports: { openai: {} } });
mock.module("./codeCollaboration", { namedExports: { applyCodeFileContent: async () => {} } });
mock.module("./realtime", {
  namedExports: {
    pushRealtimeHint: (...args) => realtimeHints.push(args),
  },
});
mock.module("./teams", { namedExports: { teamSqlCondition: teamCondition } });
mock.module("./interviewerAccounts", {
  namedExports: { accountById: async (id) => accounts.get(id) },
});
mock.module("./workspaceAccess", { namedExports: { readWorkspaceVisibility: async () => ({}) } });
mock.module("./workspaceVisibility", {
  namedExports: { userCanSeeWorkspace: () => true },
});
mock.module("./assistantModel", {
  namedExports: { getAssistantModel: async () => "test-model" },
});

const { ASSISTANT_WORKSPACE_TOOLS, runAssistantWorkspaceTool } =
  await import("./assistantWorkspaceTools.ts");

function context(accountId = "member-a", teamId = "team-a", extra = {}) {
  return { accountId, teamId, authorName: "Signed-in interviewer", ...extra };
}

test("channel discovery returns only names accessible to the signed-in account and team", async () => {
  const result = await runAssistantWorkspaceTool("list_team_chat_channels", {}, context());
  assert.deepEqual(JSON.parse(result.content), ["Builds"]);
  assert.match(result.detail, /1 accessible/);

  const coordinatorResult = await runAssistantWorkspaceTool(
    "list_team_chat_channels",
    {},
    context("coordinator-a"),
  );
  assert.deepEqual(JSON.parse(coordinatorResult.content), ["Builds", "Outreach"]);
  assert.ok(!coordinatorResult.content.includes("channel-builds"), "discovery should expose names, not internal ids");
});

test("unspecified destination posts to the shared main channel as AI assistant", async () => {
  const result = await runAssistantWorkspaceTool(
    "send_team_chat_message",
    { message: "The robot is ready." },
    context(),
  );

  assert.match(result.content, /shared main team Chat channel/);
  assert.deepEqual(inserts.at(-1).values.slice(1), [
    "team-a",
    "The robot is ready.",
    "shared",
    null,
  ]);
  assert.match(inserts.at(-1).statement, /'AI assistant'/);
  assert.deepEqual(realtimeHints.at(-1), ["interview_chat_messages", "INSERT"]);
});

test("explicit channel target overrides the invocation channel without changing the active conversation", async () => {
  const result = await runAssistantWorkspaceTool(
    "send_team_chat_message",
    { message: "Build update", channelName: " builds " },
    context("member-a", "team-a", {
      invocationScope: "channel",
      invocationChannelId: "channel-outreach",
    }),
  );

  assert.match(result.content, /"Builds" channel/);
  assert.deepEqual(inserts.at(-1).values.slice(1), [
    "team-a",
    "Build update",
    "channel",
    "channel-builds",
  ]);
});

test("unknown and inaccessible channel names are rejected without revealing hidden channels", async () => {
  const before = inserts.length;
  const inaccessible = await runAssistantWorkspaceTool(
    "send_team_chat_message",
    { message: "No", channelName: "Outreach" },
    context(),
  );
  const unknown = await runAssistantWorkspaceTool(
    "send_team_chat_message",
    { message: "No", channelName: "Secret channel" },
    context(),
  );
  const overlong = await runAssistantWorkspaceTool(
    "send_team_chat_message",
    { message: "No", channelName: "Builds".padEnd(81, "x") },
    context(),
  );

  assert.match(inaccessible.detail, /not found or access denied/);
  assert.equal(inaccessible.content, unknown.content, "inaccessible and unknown names should not reveal channel existence");
  assert.equal(overlong.detail, "invalid channel name");
  assert.equal(inserts.length, before, "rejected requests must not create chat messages");
});

test("an account from another team cannot list or post to this team's channels", async () => {
  const listed = await runAssistantWorkspaceTool(
    "list_team_chat_channels",
    {},
    context("coordinator-b", "team-a"),
  );
  const sent = await runAssistantWorkspaceTool(
    "send_team_chat_message",
    { message: "No", channelName: "Builds" },
    context("coordinator-b", "team-a"),
  );

  assert.equal(listed.detail, "access denied");
  assert.equal(sent.detail, "access denied");
});

test("ambiguous accessible channel names are rejected and no message is sent", async () => {
  channels.push(
    { id: "duplicate-channel-1", teamId: "team-a", name: "Announcements", members: [] },
    { id: "duplicate-channel-2", teamId: "team-a", name: " announcements ", members: [] },
  );
  const before = inserts.length;
  const result = await runAssistantWorkspaceTool(
    "send_team_chat_message",
    { message: "No", channelName: "Announcements" },
    context("coordinator-a"),
  );
  channels.splice(-2);

  assert.match(result.detail, /ambiguous/);
  assert.equal(inserts.length, before);
});

test("tool catalog and assistant guidance require explicit sharing and keep @ai replies in place", async () => {
  const names = new Set(ASSISTANT_WORKSPACE_TOOLS.map((item) => item.function.name));
  assert.ok(names.has("list_team_chat_channels"));
  const sendTool = ASSISTANT_WORKSPACE_TOOLS.find((item) => item.function.name === "send_team_chat_message");
  assert.deepEqual(sendTool.function.parameters.required, ["message"]);
  assert.match(sendTool.function.description, /only when the user explicitly asks/);

  const prompt = await readFile(new URL("./assistantPrompts.ts", import.meta.url), "utf8");
  assert.match(prompt, /list_team_chat_channels/);
  assert.match(prompt, /Never send a message unless the user explicitly requested/);
  assert.match(prompt, /omit channelName to use the shared main team Chat channel/);
  assert.match(prompt, /an @ai reply always stays in the conversation where it was invoked/);

  const appSource = await readFile(
    fileURLToPath(new URL("../../../robotics-interview-dashboard/src/App.tsx", import.meta.url)),
    "utf8",
  );
  assert.match(appSource, /channelId: conversationChannelId/);
  assert.match(appSource, /\.\.\.conversationTarget/);
});

test("assistant channel tool enable/disable catalog includes channel discovery", async () => {
  const source = await readFile(
    fileURLToPath(new URL("../../../robotics-interview-dashboard/src/components/assistantTools.ts", import.meta.url)),
    "utf8",
  );
  assert.match(source, /name: "list_team_chat_channels"/);
});

test.after(() => mock.restoreAll());
