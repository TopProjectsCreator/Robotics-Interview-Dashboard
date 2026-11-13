import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, describe, it, mock } from "node:test";

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

mock.module("@workspace/db", {
  namedExports: {
    DEFAULT_TEAM_ID: "default",
    chatSettingsTable: {},
    teamNameRulesTable: {},
    teamsTable: {},
    db: {},
  },
});
mock.module("drizzle-orm", { namedExports: { and: (...conditions) => conditions, eq: (field, value) => ({ field, value }) } });
mock.module("./maildrop", {
  namedExports: {
    getTeamMailboxSettings: async () => ({}),
    forwardingAddress: (mailbox) => mailbox,
    saveTeamMailboxSettings: async () => ({}),
  },
});
mock.module("./teams", { namedExports: { teamFilter: (field, teamId) => ({ field, teamId }) } });
mock.module("./realtime", { namedExports: { pushRealtimeHint() {} } });
mock.module("./assistantModel", { namedExports: { getAssistantModel: async () => "test-model" } });
mock.module("./teamAssistantAi", {
  namedExports: { teamAssistantAI: () => ({ chat: { completions: { create: async () => finalAnswer() } } }) },
});

const { runSettingsAgent, settingsAgentTools } = await import("./assistantSettingsAgent.ts");
const { validateSettingsCapabilityValue } = await import("./settingsCapabilityOperations.ts");

const originalSecret = process.env.SESSION_SECRET;
process.env.SESSION_SECRET = "settings-agent-tests-only";
after(() => {
  if (originalSecret === undefined) delete process.env.SESSION_SECRET;
  else process.env.SESSION_SECRET = originalSecret;
});

const coordinator = {
  accountId: "account-a",
  teamId: "team-a",
  role: "coordinator",
  permissions: ["chat.manage", "team.mailbox.manage", "team.nameRules.manage", "team.branding.manage"],
};

function call(name, args, id = `call-${name}`) {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

function withCalls(...toolCalls) {
  return { choices: [{ message: { role: "assistant", tool_calls: toolCalls } }] };
}

function finalAnswer(content = "Done.") {
  return { choices: [{ message: { role: "assistant", content } }] };
}

function adapter({ current = { slowmodeSeconds: 10 }, events = [] } = {}) {
  let stored = structuredClone(current);
  return {
    events,
    get stored() { return stored; },
    validate(settingId, value) {
      events.push(`validate:${settingId}`);
      return structuredClone(value);
    },
    async read(settingId, identity) {
      events.push(`read:${settingId}:${identity.teamId}`);
      return structuredClone(stored);
    },
    async update(settingId, value, identity) {
      events.push(`write:${settingId}:${identity.teamId}`);
      stored = structuredClone(value);
      return structuredClone(stored);
    },
  };
}

describe("settings-only assistant execution", () => {
  it("exposes only visible settings tools and no generic assistant tools or secret inputs", () => {
    const tools = settingsAgentTools(coordinator);
    assert.deepEqual(tools.map((tool) => tool.function.name), [
      "read_setting",
      "propose_setting_change",
      "update_setting",
    ]);
    const text = JSON.stringify(tools);
    assert.match(text, /team\.inbox/);
    assert.match(text, /applicants\.defaultSort/);
    assert.doesNotMatch(text, /apiKey|password|web_search|list_team_chat_messages|search_applicants|applicantId/);

    const memberTools = settingsAgentTools({
      accountId: "member-a",
      teamId: "team-a",
      role: "interviewer",
      permissions: [],
    });
    assert.deepEqual(memberTools, []);
  });

  it("requires a successful read in the same turn before applying an update", async () => {
    const api = adapter();
    const replies = [
      withCalls(call("read_setting", { settingId: "team.chat.slowmode" })),
      withCalls(call("update_setting", { settingId: "team.chat.slowmode", value: { slowmodeSeconds: 30 } })),
      finalAnswer("Slow mode is now 30 seconds."),
    ];
    const result = await runSettingsAgent({
      question: "Set chat slow mode to 30 seconds.",
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => replies.shift(),
    });
    assert.equal(result.answer, "Slow mode is now 30 seconds.");
    assert.deepEqual(api.events.filter((event) => event.startsWith("read:") || event.startsWith("write:")), [
      "read:team.chat.slowmode:team-a",
      "read:team.chat.slowmode:team-a",
      "write:team.chat.slowmode:team-a",
    ]);
    assert.deepEqual(api.stored, { slowmodeSeconds: 30 });
  });

  it("reads browser-local settings first, streams progress, and returns only scoped updates", async () => {
    let stored = "light";
    const replies = [
      withCalls(call("read_setting", { settingId: "appearance.theme" })),
      withCalls(call("update_setting", { settingId: "appearance.theme", value: "dark" })),
      finalAnswer("Your theme is now dark."),
    ];
    const progress = [];
    const inputs = [];
    const result = await runSettingsAgent({
      question: "Change it to dark.",
      history: [
        { role: "user", content: "What theme am I using?" },
        { role: "assistant", content: "Your theme is light." },
      ],
      identity: coordinator,
      adapter: {
        validate(settingId, value) {
          assert.equal(settingId, "appearance.theme");
          assert.ok(value === "light" || value === "dark");
          return value;
        },
        async read(settingId, identity) {
          assert.equal(identity.accountId, "account-a");
          assert.equal(identity.teamId, "team-a");
          return stored;
        },
        async update(_settingId, value) {
          stored = value;
          return stored;
        },
      },
      model: "test-model",
      complete: async (input) => {
        inputs.push(structuredClone(input));
        return replies.shift();
      },
      onProgress: (activity) => progress.push(activity),
    });
    assert.equal(stored, "dark");
    assert.deepEqual(result.localUpdates, { "appearance.theme": "dark" });
    assert.deepEqual(result.changes, [{ settingId: "appearance.theme", value: "dark" }]);
    assert.deepEqual(progress.map(({ action, status }) => `${action}:${status}`), [
      "read_setting:started",
      "read_setting:complete",
      "update_setting:started",
      "update_setting:saved",
    ]);
    assert.deepEqual(inputs[0].messages.slice(-3), [
      { role: "user", content: "What theme am I using?" },
      { role: "assistant", content: "Your theme is light." },
      { role: "user", content: "Change it to dark." },
    ]);
  });

  it("refuses a write if the model skips the required read", async () => {
    const api = adapter();
    const replies = [
      withCalls(call("update_setting", { settingId: "team.chat.slowmode", value: { slowmodeSeconds: 30 } })),
      finalAnswer("I couldn't update that without reading its current value first."),
    ];
    await runSettingsAgent({
      question: "Set chat slow mode to 30 seconds.",
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => replies.shift(),
    });
    assert.equal(api.events.some((event) => event.startsWith("write:")), false);
    assert.equal(api.events.some((event) => event.startsWith("read:")), false);
  });

  it("rejects caller-selected teams in tool arguments", async () => {
    const api = adapter();
    const replies = [
      withCalls(call("read_setting", { settingId: "team.chat.slowmode", teamId: "team-b" })),
      finalAnswer("That request used unsupported settings arguments."),
    ];
    await runSettingsAgent({
      question: "Read the chat setting.",
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => replies.shift(),
    });
    assert.deepEqual(api.events, []);
  });

  it("does not read a setting outside the signed-in user's permissions", async () => {
    const api = adapter();
    const replies = [
      withCalls(call("read_setting", { settingId: "team.inbox" })),
      finalAnswer("You don't have access to that setting."),
    ];
    await runSettingsAgent({
      question: "What is our inbox address?",
      identity: {
        accountId: "member-a",
        teamId: "team-a",
        role: "interviewer",
        permissions: [],
      },
      adapter: api,
      model: "test-model",
      complete: async () => replies.shift(),
    });
    assert.deepEqual(api.events, []);
  });

  it("asks for clarification without touching settings when the request is ambiguous", async () => {
    const api = adapter();
    const result = await runSettingsAgent({
      question: "Change the team appearance.",
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => finalAnswer("Which appearance setting should I change?"),
    });
    assert.equal(result.answer, "Which appearance setting should I change?");
    assert.deepEqual(api.events, []);
  });

  it("gates inbox changes behind an account- and team-bound explicit confirmation", async () => {
    const api = adapter({ current: { enabled: false, apiKeyConfigured: true, allowedSenders: ["robotics.example"] } });
    const replies = [
      withCalls(call("read_setting", { settingId: "team.inbox" })),
      withCalls(call("update_setting", {
        settingId: "team.inbox",
        value: { enabled: true, allowedSenders: ["robotics.example"] },
      })),
      finalAnswer("This inbox change needs confirmation."),
    ];
    const pending = await runSettingsAgent({
      question: "Enable the team inbox.",
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => replies.shift(),
    });
    assert.equal(pending.confirmations.length, 1);
    assert.equal(api.events.some((event) => event.startsWith("write:")), false);

    await assert.rejects(runSettingsAgent({
      question: "confirm",
      confirmationToken: pending.confirmations[0].token,
      identity: { ...coordinator, teamId: "team-b" },
      adapter: api,
      model: "test-model",
      complete: async () => finalAnswer(),
    }), /invalid or expired/);
    assert.equal(api.events.some((event) => event.startsWith("write:")), false);

    await assert.rejects(runSettingsAgent({
      question: "yes",
      confirmationToken: pending.confirmations[0].token,
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => finalAnswer(),
    }), /send "confirm"/);
    assert.equal(api.events.some((event) => event.startsWith("write:")), false);

    const confirmed = await runSettingsAgent({
      question: "confirm",
      confirmationToken: pending.confirmations[0].token,
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => finalAnswer("The inbox is enabled."),
    });
    assert.equal(confirmed.answer, "The inbox is enabled.");
    assert.deepEqual(api.events.filter((event) => event.startsWith("read:") || event.startsWith("write:")).slice(-2), [
      "read:team.inbox:team-a",
      "write:team.inbox:team-a",
    ]);
    assert.equal(api.stored.enabled, true);
  });

  it("does not apply a confirmation if the setting changed after the user reviewed it", async () => {
    const api = adapter({ current: { enabled: false, apiKeyConfigured: true, allowedSenders: [] } });
    const replies = [
      withCalls(call("read_setting", { settingId: "team.inbox" })),
      withCalls(call("update_setting", {
        settingId: "team.inbox",
        value: { enabled: false, allowedSenders: ["robotics.example"] },
      })),
      finalAnswer("Please review the changed inbox setting."),
    ];
    const pending = await runSettingsAgent({
      question: "Add robotics.example as an approved sender.",
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => replies.shift(),
    });
    api.stored.enabled = true;
    await assert.rejects(runSettingsAgent({
      question: "confirm",
      confirmationToken: pending.confirmations[0].token,
      identity: coordinator,
      adapter: api,
      model: "test-model",
      complete: async () => finalAnswer(),
    }), /changed since you reviewed/);
    assert.equal(api.events.some((event) => event.startsWith("write:")), false);
  });

  it("validates catalog values and rejects secret fields and caller-selected teams", () => {
    assert.deepEqual(
      validateSettingsCapabilityValue("team.chat.slowmode", { slowmodeSeconds: 30 }),
      { slowmodeSeconds: 30 },
    );
    assert.throws(
      () => validateSettingsCapabilityValue("team.chat.slowmode", { slowmodeSeconds: 7 }),
      /interval shown/,
    );
    assert.throws(
      () => validateSettingsCapabilityValue("team.inbox", {
        enabled: false,
        allowedSenders: [],
        apiKey: "must-not-enter-the-agent",
      }),
      /settings agent cannot change/,
    );
    assert.throws(
      () => validateSettingsCapabilityValue("team.inbox", {
        enabled: false,
        allowedSenders: [],
        teamId: "team-b",
      }),
      /cannot change/,
    );
    assert.throws(
      () => validateSettingsCapabilityValue("team.branding.backgroundOptions", {
        backgroundMode: "cover",
        backgroundOverlay: 13,
      }),
      /steps of 5/,
    );
  });
});
