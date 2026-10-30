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
const accounts = new Map([
  ["member", { id: "member", role: "interviewer", passwordHash: "configured" }],
  ["coordinator", { id: "coordinator", role: "coordinator", passwordHash: "configured" }],
]);
const assistantModelPoliciesTable = { teamId: "teamId" };
const interviewerAccountsTable = { id: "id", role: "role", passwordHash: "passwordHash", teamId: "teamId" };
const revokedSessionsTable = { tokenHash: "tokenHash", expiresAt: "expiresAt" };
const catalog = [
  { id: DEFAULT_MODEL, name: "Default", isFree: true },
  { id: TEXT_MODEL, name: "Text", isFree: true },
  { id: VISION_MODEL, name: "Vision", isFree: true, architecture: { input_modalities: ["text", "image"] } },
  { id: SECOND_VISION_MODEL, name: "Vision fallback", isFree: true, input_modalities: ["text", "image"] },
];
const db = {
  select() {
    return {
      from(table) {
        return {
          where(condition) {
            const rows = table === assistantModelPoliciesTable
              ? (policies.has(condition.value) ? [policies.get(condition.value)] : [])
              : table === revokedSessionsTable
                ? []
                : (accounts.has(condition.value) ? [accounts.get(condition.value)] : []);
            const result = Promise.resolve(rows);
            result.limit = async () => rows;
            return result;
          },
        };
      },
    };
  },
  insert() {
    let nextRow;
    return {
      values(row) {
        nextRow = row;
        return {
          async onConflictDoUpdate() {
            policies.set(nextRow.teamId, nextRow);
          },
        };
      },
    };
  },
};

mock.module("@workspace/db", {
  namedExports: {
    DEFAULT_TEAM_ID: "default",
    assistantModelPoliciesTable,
    interviewerAccountsTable,
    revokedSessionsTable,
    runWithInstance: (_instance, callback) => callback(),
    db,
  },
});
mock.module("drizzle-orm", {
  namedExports: { eq: (field, value) => ({ field, value }), lt: (field, value) => ({ field, value }) },
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
      models: { list: async () => ({ data: catalog }) },
    },
  },
});

const {
  AssistantModelPolicyError,
  DEFAULT_ASSISTANT_MODEL,
  effectiveAssistantModels,
  getAssistantModelPolicyWithCatalog,
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

test("team policy persists across reads and remains isolated by team", async () => {
  const saved = await saveAssistantModelPolicy("team-a", policy({
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

test("allow and block lists are exact and reject disallowed overrides", async () => {
  await saveAssistantModelPolicy("allow-team", policy({
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

  await saveAssistantModelPolicy("block-team", policy({
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
  await saveAssistantModelPolicy("locked-team", policy({ defaultModel: TEXT_MODEL, locked: true }));
  assert.equal(await resolveTeamAssistantModel("locked-team"), TEXT_MODEL);
  await assert.rejects(
    resolveTeamAssistantModel("locked-team", DEFAULT_MODEL),
    (error) => error instanceof AssistantModelPolicyError && /locked/.test(error.message),
  );
});

test("policy saves reject unavailable IDs, conflicts, and malformed lists", async () => {
  await assert.rejects(
    saveAssistantModelPolicy("invalid-team", policy({ defaultModel: "missing/model" })),
    (error) => error instanceof AssistantModelPolicyError && /no longer available/.test(error.message),
  );
  await assert.rejects(
    saveAssistantModelPolicy("invalid-team", policy({
      defaultModel: TEXT_MODEL,
      listMode: "allow",
      modelIds: [VISION_MODEL],
    })),
    (error) => error instanceof AssistantModelPolicyError && /included in the allow list/.test(error.message),
  );
  await assert.rejects(
    saveAssistantModelPolicy("invalid-team", policy({
      defaultModel: TEXT_MODEL,
      listMode: "block",
      modelIds: [TEXT_MODEL],
    })),
    (error) => error instanceof AssistantModelPolicyError && /cannot also appear/.test(error.message),
  );
  await assert.rejects(
    saveAssistantModelPolicy("invalid-team", policy({ modelIds: [TEXT_MODEL, TEXT_MODEL] })),
    (error) => error instanceof AssistantModelPolicyError && /invalid/.test(error.message),
  );
});

test("vision routing only selects permitted image-capable models", async () => {
  await saveAssistantModelPolicy("vision-team", policy({
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

  await saveAssistantModelPolicy("locked-text-team", policy({ defaultModel: TEXT_MODEL, locked: true }));
  assert.equal(await resolveTeamAssistantModel("locked-text-team", VISION_MODEL, "image"), VISION_MODEL);
  await saveAssistantModelPolicy("locked-vision-team", policy({ defaultModel: VISION_MODEL, locked: true }));
  assert.equal(await resolveTeamAssistantModel("locked-vision-team", SECOND_VISION_MODEL, "image"), VISION_MODEL);
  await saveAssistantModelPolicy("locked-text-restricted-team", policy({
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
    listMode: null,
    modelIds: [],
  });
  const result = await getAssistantModelPolicyWithCatalog("stale-team", true);
  assert.equal(result.policy.defaultModel, "provider/removed-model");
  assert.equal(result.effectiveModels.length, 0);
  assert.match(result.policyError, /no longer available/);
  await assert.rejects(
    resolveTeamAssistantModel("stale-team"),
    (error) => error instanceof AssistantModelPolicyError,
  );
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
