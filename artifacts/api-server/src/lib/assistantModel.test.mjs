import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { test, mock } from "node:test";

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

const DEFAULT_MODEL = "minimax/minimax-m3.1-flash:free";
const TEXT_MODEL = "provider/text-model";
const VISION_MODEL = "provider/vision-model";
const SECOND_VISION_MODEL = "provider/vision-fallback";
const policies = new Map();
const policyHistory = [];
const assistantModelPolicyHistoryTable = { teamId: "teamId", createdAt: "createdAt" };
const accounts = new Map([
  ["member", { id: "member", role: "interviewer", passwordHash: "configured" }],
  ["coordinator", { id: "coordinator", role: "coordinator", passwordHash: "configured" }],
]);
const assistantModelPoliciesTable = { teamId: "teamId" };
const interviewerAccountsTable = { id: "id", role: "role", passwordHash: "passwordHash", teamId: "teamId" };
const revokedSessionsTable = { tokenHash: "tokenHash", expiresAt: "expiresAt" };
const queryResult = (rows) => {
  const result = Promise.resolve(rows);
  result.limit = () => result;
  result.for = () => result;
  result.orderBy = () => result;
  return result;
};
const catalog = [
  { id: DEFAULT_MODEL, name: "Default", isFree: true },
  { id: TEXT_MODEL, name: "Text", isFree: true },
  { id: VISION_MODEL, name: "Vision", isFree: true, architecture: { input_modalities: ["text", "image"] } },
  { id: SECOND_VISION_MODEL, name: "Vision fallback", isFree: true, input_modalities: ["text", "image"] },
];
let providerCatalog = catalog;
let providerCatalogFetches = 0;
const db = {
  select() {
    return {
      from(table) {
        return {
          where(condition) {
            const rows = table === assistantModelPoliciesTable
              ? (policies.has(condition.value) ? [policies.get(condition.value)] : [])
              : table === assistantModelPolicyHistoryTable
                ? policyHistory.filter((item) => item.teamId === condition.value).reverse()
                : table === revokedSessionsTable
                  ? []
                  : (accounts.has(condition.value) ? [accounts.get(condition.value)] : []);
            return queryResult(rows);
          },
        };
      },
    };
  },
  insert(table) {
    return {
      values(row) {
        if (table === assistantModelPolicyHistoryTable) {
          policyHistory.push({ ...row, createdAt: new Date("2026-01-01T00:00:00.000Z") });
          return Promise.resolve();
        }
        return {
          async onConflictDoUpdate() {
            policies.set(row.teamId, row);
          },
        };
      },
    };
  },
  async transaction(callback) {
    return callback({
      execute: async () => undefined,
      select: this.select.bind(this),
      insert: this.insert.bind(this),
    });
  },
};

mock.module("@workspace/db", {
  namedExports: {
    DEFAULT_TEAM_ID: "default",
    assistantModelPoliciesTable,
    assistantModelPolicyHistoryTable,
    interviewerAccountsTable,
    revokedSessionsTable,
    runWithInstance: (_instance, callback) => callback(),
    db,
  },
});
mock.module("drizzle-orm", {
  namedExports: {
    eq: (field, value) => ({ field, value }),
    lt: (field, value) => ({ field, value }),
    desc: (field) => field,
    sql: () => ({}),
  },
});
mock.module("../lib/workspaceVisibility", {
  namedExports: { userCanSeeWorkspace: () => true },
});
mock.module("../lib/workspaceAccess", {
  namedExports: { readWorkspaceVisibility: async () => ({}) },
});
mock.module("@workspace/integrations-openai-ai-server", {
  namedExports: {
    openai: {
      models: {
        list: async () => {
          providerCatalogFetches += 1;
          return { data: providerCatalog };
        },
      },
    },
  },
});

const {
  AssistantModelPolicyError,
  DEFAULT_ASSISTANT_MODEL,
  effectiveAssistantModels,
  getAssistantModelPolicyWithCatalog,
  listAssistantModelPolicyHistory,
  resolveTeamAssistantModel,
  saveAssistantModelPolicy,
} = await import("./assistantModel.ts");
const { createInterviewerSession, requireCoordinator } = await import("../middlewares/adminAuth.ts");

const policy = (overrides = {}) => ({
  defaultModel: DEFAULT_ASSISTANT_MODEL,
  locked: false,
  listMode: null,
  modelIds: [],
  ...overrides,
});
const savePolicy = (teamId, input) => saveAssistantModelPolicy(teamId, input, {
  id: "coordinator",
  name: "Team Coordinator",
});

test("team policy persists across reads and remains isolated by team", async () => {
  const saved = await savePolicy("team-a", policy({
    defaultModel: TEXT_MODEL,
    locked: true,
  }));
  assert.deepEqual(saved, policy({ defaultModel: TEXT_MODEL, locked: true }));
  assert.deepEqual(
    (await getAssistantModelPolicyWithCatalog("team-a")).policy,
    saved,
  );
  assert.equal(
    (await getAssistantModelPolicyWithCatalog("team-b")).policy.defaultModel,
    DEFAULT_MODEL,
  );
});

test("policy history captures coordinator, before-and-after values, and stays team-scoped", async () => {
  const first = policy({ defaultModel: TEXT_MODEL, locked: true });
  const changed = policy({ defaultModel: VISION_MODEL, listMode: "allow", modelIds: [VISION_MODEL] });
  await savePolicy("history-team-a", first);
  await savePolicy("history-team-a", changed);
  await savePolicy("history-team-a", changed);
  await savePolicy("history-team-b", policy({ defaultModel: TEXT_MODEL }));

  const historyA = await listAssistantModelPolicyHistory("history-team-a");
  assert.equal(historyA.length, 2);
  assert.equal(historyA[0].coordinatorId, "coordinator");
  assert.equal(historyA[0].coordinatorName, "Team Coordinator");
  assert.deepEqual(historyA[0].previousPolicy, first);
  assert.deepEqual(historyA[0].newPolicy, changed);
  assert.equal(historyA[0].createdAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(historyA[1].previousPolicy.defaultModel, DEFAULT_MODEL);
  assert.deepEqual(await listAssistantModelPolicyHistory("history-team-b").then((items) => items.map(({ teamId }) => teamId)), ["history-team-b"]);
});

test("allow and block lists are exact and reject disallowed overrides", async () => {
  await savePolicy("allow-team", policy({
    defaultModel: TEXT_MODEL,
    listMode: "allow",
    modelIds: [TEXT_MODEL, VISION_MODEL],
  }));
  const allowResult = await getAssistantModelPolicyWithCatalog("allow-team");
  assert.deepEqual(allowResult.effectiveModels.map((model) => model.id), [TEXT_MODEL, VISION_MODEL]);
  assert.equal(await resolveTeamAssistantModel("allow-team"), TEXT_MODEL);
  await assert.rejects(
    resolveTeamAssistantModel("allow-team", DEFAULT_MODEL),
    (error) => error instanceof AssistantModelPolicyError && error.status === 400,
  );

  await savePolicy("block-team", policy({
    defaultModel: TEXT_MODEL,
    listMode: "block",
    modelIds: [VISION_MODEL],
  }));
  assert.equal(
    (await getAssistantModelPolicyWithCatalog("block-team")).effectiveModels.some((model) => model.id === VISION_MODEL),
    false,
  );
  await assert.rejects(
    resolveTeamAssistantModel("block-team", VISION_MODEL),
    (error) => error instanceof AssistantModelPolicyError && /not permitted/.test(error.message),
  );
});

test("a locked policy returns only its default and rejects model changes", async () => {
  await savePolicy("locked-team", policy({ defaultModel: TEXT_MODEL, locked: true }));
  assert.equal(await resolveTeamAssistantModel("locked-team"), TEXT_MODEL);
  await assert.rejects(
    resolveTeamAssistantModel("locked-team", DEFAULT_MODEL),
    (error) => error instanceof AssistantModelPolicyError && /locked/.test(error.message),
  );
});

test("policy saves reject unavailable IDs, conflicts, and malformed lists", async () => {
  await assert.rejects(
    savePolicy("invalid-team", policy({ defaultModel: "missing/model" })),
    (error) => error instanceof AssistantModelPolicyError && /no longer available/.test(error.message),
  );
  await assert.rejects(
    savePolicy("invalid-team", policy({
      defaultModel: TEXT_MODEL,
      listMode: "allow",
      modelIds: [VISION_MODEL],
    })),
    (error) => error instanceof AssistantModelPolicyError && /included in the allow list/.test(error.message),
  );
  await assert.rejects(
    savePolicy("invalid-team", policy({
      defaultModel: TEXT_MODEL,
      listMode: "block",
      modelIds: [TEXT_MODEL],
    })),
    (error) => error instanceof AssistantModelPolicyError && /cannot also appear/.test(error.message),
  );
  await assert.rejects(
    savePolicy("invalid-team", policy({ modelIds: [TEXT_MODEL, TEXT_MODEL] })),
    (error) => error instanceof AssistantModelPolicyError && /invalid/.test(error.message),
  );
});

test("vision routing only selects permitted image-capable models", async () => {
  await savePolicy("vision-team", policy({
    defaultModel: TEXT_MODEL,
    listMode: "allow",
    modelIds: [TEXT_MODEL, VISION_MODEL, SECOND_VISION_MODEL],
  }));
  assert.equal(
    await resolveTeamAssistantModel("vision-team", VISION_MODEL, "image"),
    VISION_MODEL,
  );
  assert.equal(
    await resolveTeamAssistantModel("vision-team", TEXT_MODEL, "image"),
    VISION_MODEL,
  );
  assert.deepEqual(
    effectiveAssistantModels(policy({ defaultModel: TEXT_MODEL, listMode: "allow", modelIds: [TEXT_MODEL] }), catalog)
      .map((model) => model.id),
    [TEXT_MODEL],
  );

  await savePolicy("locked-text-team", policy({ defaultModel: TEXT_MODEL, locked: true }));
  assert.equal(await resolveTeamAssistantModel("locked-text-team", VISION_MODEL, "image"), VISION_MODEL);
  await savePolicy("locked-vision-team", policy({ defaultModel: VISION_MODEL, locked: true }));
  assert.equal(await resolveTeamAssistantModel("locked-vision-team", SECOND_VISION_MODEL, "image"), VISION_MODEL);
  await savePolicy("locked-text-restricted-team", policy({
    defaultModel: TEXT_MODEL,
    locked: true,
    listMode: "allow",
    modelIds: [TEXT_MODEL],
  }));
  await assert.rejects(
    resolveTeamAssistantModel("locked-text-restricted-team", VISION_MODEL, "image"),
    (error) => error instanceof AssistantModelPolicyError && /No image-capable model is permitted/.test(error.message),
  );
});

test("only a signed-in coordinator passes the policy write role gate", async () => {
  async function checkRole(interviewerId) {
    let statusCode = 200;
    let passed = false;
    const session = createInterviewerSession(interviewerId);
    await new Promise((resolve) => {
      const req = {
        cookies: { robotics_admin_session: session },
        query: {},
        get: () => undefined,
        log: { error() {} },
      };
      const res = {
        status(code) { statusCode = code; return this; },
        json() { resolve(); return this; },
      };
      requireCoordinator(req, res, () => { passed = true; resolve(); });
      setTimeout(resolve, 100);
    });
    return { statusCode, passed };
  }
  assert.deepEqual(await checkRole("member"), { statusCode: 403, passed: false });
  assert.deepEqual(await checkRole("coordinator"), { statusCode: 200, passed: true });
});

test("a stale saved default is reported without exposing any models as effective", async () => {
  policies.set("stale-team", {
    teamId: "stale-team",
    defaultModel: "provider/removed-model",
    locked: false,
    listMode: "allow",
    modelIds: ["provider/removed-restriction"],
  });
  const result = await getAssistantModelPolicyWithCatalog("stale-team", true);
  assert.equal(result.policy.defaultModel, "provider/removed-model");
  assert.deepEqual(result.policy.modelIds, ["provider/removed-restriction"]);
  assert.deepEqual(result.unavailableModelIds, ["provider/removed-model", "provider/removed-restriction"]);
  assert.equal(result.effectiveModels.length, 0);
  assert.match(result.policyError, /no longer available/);
  await assert.rejects(
    resolveTeamAssistantModel("stale-team"),
    (error) => error instanceof AssistantModelPolicyError,
  );
});

test("a removed restricted model is surfaced without changing the saved policy", async () => {
  const savedPolicy = {
    teamId: "stale-restriction-team",
    defaultModel: TEXT_MODEL,
    locked: false,
    listMode: "block",
    modelIds: ["provider/removed-restriction"],
  };
  policies.set(savedPolicy.teamId, savedPolicy);

  const result = await getAssistantModelPolicyWithCatalog(savedPolicy.teamId, true);
  assert.deepEqual(result.unavailableModelIds, ["provider/removed-restriction"]);
  assert.deepEqual(result.policy.modelIds, savedPolicy.modelIds);
  assert.equal(result.effectiveModels.length, 0);
  assert.deepEqual(policies.get(savedPolicy.teamId), savedPolicy);
  await assert.rejects(
    resolveTeamAssistantModel(savedPolicy.teamId),
    (error) => error instanceof AssistantModelPolicyError,
  );
});

test("a policy read refreshes the provider catalog before reporting missing IDs", async () => {
  const teamId = "catalog-refresh-team";
  policies.set(teamId, {
    teamId,
    defaultModel: TEXT_MODEL,
    locked: false,
    listMode: "block",
    modelIds: [VISION_MODEL],
  });
  await getAssistantModelPolicyWithCatalog(teamId, true);
  const fetchCountBeforeRefresh = providerCatalogFetches;
  providerCatalog = catalog.filter((model) => model.id !== VISION_MODEL);

  try {
    const result = await getAssistantModelPolicyWithCatalog(teamId, true, true);
    assert.ok(providerCatalogFetches > fetchCountBeforeRefresh);
    assert.deepEqual(result.unavailableModelIds, [VISION_MODEL]);
    assert.deepEqual(result.policy.modelIds, [VISION_MODEL]);
    assert.equal(result.effectiveModels.length, 0);
  } finally {
    providerCatalog = catalog;
    await getAssistantModelPolicyWithCatalog(teamId, true, true);
  }
});

test("a malformed stored policy reports an error and fails closed", async () => {
  policies.set("malformed-team", {
    teamId: "malformed-team",
    defaultModel: DEFAULT_MODEL,
    locked: false,
    listMode: "allow",
    modelIds: "not-an-array",
  });
  const result = await getAssistantModelPolicyWithCatalog("malformed-team", true);
  assert.equal(result.effectiveModels.length, 0);
  assert.match(result.policyError, /invalid/);
  await assert.rejects(
    resolveTeamAssistantModel("malformed-team"),
    (error) => error instanceof AssistantModelPolicyError,
  );
});
