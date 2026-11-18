import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier);
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

function createHarness(t, scoredMessages = []) {
  const calls = {
    provider: 0,
    snapshots: 0,
    messageQueries: 0,
    contextQueries: 0,
    modelSettings: 0,
  };

  const tables = {
    channels: { id: "channel_id", name: "channel_name", teamId: "channel_team_id" },
    messages: {
      message: "message",
      createdAt: "message_created_at",
      teamId: "message_team_id",
      conversationScope: "message_scope",
      conversationPeer: "message_peer",
      deletedAt: "message_deleted_at",
    },
    settings: { teamId: "settings_team_id", customMessage: "custom_message", enabled: "enabled", lastRunAt: "last_run_at", lastError: "last_error", updatedAt: "updated_at" },
    snapshots: { teamId: "snapshot_team_id" },
    usage: { id: "usage_id" },
  };
  const olderMessages = [{
    message: "Older context only",
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
  }];

  const hasContextCondition = (condition) =>
    Boolean(condition && typeof condition === "object" &&
      (condition.operator === "lt" || condition.conditions?.some(hasContextCondition)));
  const query = (table) => {
    let condition;
    const result = () => {
      if (table === tables.channels) return [];
      if (table === tables.messages) {
        calls.messageQueries += 1;
        if (hasContextCondition(condition)) {
          calls.contextQueries += 1;
          return olderMessages;
        }
        return scoredMessages;
      }
      if (table === tables.settings) {
        calls.modelSettings += 1;
        return [];
      }
      return [];
    };
    const builder = {
      where(value) { condition = value; return this; },
      orderBy() { return this; },
      limit() { return Promise.resolve(result()); },
      then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
    return builder;
  };
  const db = {
    select: () => ({ from: (table) => query(table) }),
    update: () => ({
      set() {
        return {
          where() {
            return { returning: async () => [{ teamId: "team-1" }] };
          },
        };
      },
    }),
    insert: (table) => ({
      values: async () => {
        if (table === tables.snapshots) calls.snapshots += 1;
      },
    }),
  };
  const condition = (operator) => (...conditions) => ({ operator, conditions });
  mock.module("@workspace/db", {
    namedExports: {
      db,
      DEFAULT_TEAM_ID: "default",
      chatChannelsTable: tables.channels,
      chatProductivitySettingsTable: tables.settings,
      chatProductivitySnapshotsTable: tables.snapshots,
      chatProductivityUsageEventsTable: tables.usage,
      interviewChatMessagesTable: tables.messages,
    },
  });
  mock.module("drizzle-orm", {
    namedExports: {
      and: condition("and"),
      or: condition("or"),
      eq: condition("eq"),
      gte: condition("gte"),
      lte: condition("lte"),
      lt: condition("lt"),
      isNull: condition("isNull"),
      desc: (value) => value,
    },
  });
  mock.module("./assistantModel", {
    namedExports: {
      getAssistantModelPolicyWithCatalog: async () => ({ catalog: [] }),
      resolveTeamAssistantModel: async () => {
        calls.modelSettings += 1;
        return "test-model";
      },
    },
  });
  mock.module("./assistantProviderConfiguration", {
    namedExports: { getTeamAssistantProvider: async () => undefined },
  });
  mock.module("./teamAssistantAi", {
    namedExports: {
      teamAssistantAI: () => ({
        chat: {
          completions: {
            create: async () => {
              calls.provider += 1;
              return { choices: [{ message: { content: "{}" } }] };
            },
          },
        },
      }),
    },
  });
  mock.module("./chatProductivityUsage", {
    namedExports: {
      trackProductivityReviewRequest: async ({ request }) => request(),
    },
  });
  mock.module("./logger", {
    namedExports: { logger: { warn() {}, error() {} } },
  });
  t.after(() => mock.restoreAll());

  return calls;
}

test("scheduled review skips AI and snapshots when only older context exists", async (t) => {
  const calls = createHarness(t);
  const { dispatchChatProductivityReviewForTeam } = await import(
    `./chatProductivity.ts?empty-scheduled-${Date.now()}`
  );

  await dispatchChatProductivityReviewForTeam("team-1");

  assert.equal(calls.provider, 0);
  assert.equal(calls.snapshots, 0);
  assert.equal(calls.contextQueries, 0);
  assert.equal(calls.modelSettings, 0);
});

test("selected range returns no assessment when only older context exists", async (t) => {
  const calls = createHarness(t);
  const { reviewChatProductivityRange } = await import(
    `./chatProductivity.ts?empty-selected-${Date.now()}`
  );

  const assessment = await reviewChatProductivityRange(
    "team-1",
    "shared",
    "team",
    "Team conversation",
    "1h",
  );

  assert.equal(assessment, null);
  assert.equal(calls.provider, 0);
  assert.equal(calls.snapshots, 0);
  assert.equal(calls.contextQueries, 0);
  assert.equal(calls.modelSettings, 0);
});
