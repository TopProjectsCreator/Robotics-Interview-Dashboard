import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { mock, test } from "node:test";

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

const rows = new Map();
const table = {
  teamId: "teamId",
  providerId: "providerId",
  providerName: "providerName",
  modelId: "modelId",
  protocol: "protocol",
  endpointUrl: "endpointUrl",
  modelMetadata: "modelMetadata",
  encryptedCredential: "encryptedCredential",
  updatedAt: "updatedAt",
};
const makeRows = (condition, projection, limit = Infinity) => {
  const teamId = condition?.value;
  const matches = [...rows.values()].filter((row) => !teamId || row.teamId === teamId).slice(0, limit);
  return projection
    ? matches.map((row) => Object.fromEntries(Object.entries(projection).map(([key, column]) => [key, row[column]])))
    : matches;
};
const db = {
  select(projection) {
    return {
      from() {
        return {
          where(condition) {
            return { limit: async (limit) => makeRows(condition, projection, limit) };
          },
        };
      },
    };
  },
  insert() {
    return {
      values(row) {
        return {
          async onConflictDoUpdate({ set }) {
            rows.set(row.teamId, { ...(rows.get(row.teamId) ?? {}), ...row, ...set });
          },
        };
      },
    };
  },
  delete() {
    return {
      where(condition) {
        rows.delete(condition.value);
        return Promise.resolve();
      },
    };
  },
};

mock.module("@workspace/db", { namedExports: { db, teamAssistantProvidersTable: table } });
mock.module("drizzle-orm", { namedExports: { eq: (field, value) => ({ field, value }) } });

const {
  getSafeTeamAssistantProviderStatus,
  getTeamAssistantProvider,
  removeTeamAssistantProvider,
  saveTeamAssistantProvider,
} = await import("./assistantProviderConfiguration.ts");

const model = {
  id: "model-a",
  name: "Model A",
  contextLength: 32000,
  inputModalities: ["text"],
  outputModalities: ["text"],
  toolCalling: true,
  reasoning: false,
};
const provider = {
  id: "openai",
  name: "OpenAI",
  protocol: "openai-chat-completions",
  description: "OpenAI models",
  website: "https://platform.openai.com",
  models: [model],
};
const inputFor = (apiKey) => ({ providerId: "openai", modelId: "model-a", apiKey });

test("provider credentials and saved configuration remain isolated by team and status never returns a key", async () => {
  const previous = process.env.AI_BYOK_ENCRYPTION_KEY;
  process.env.AI_BYOK_ENCRYPTION_KEY = "test-team-key";
  rows.clear();
  try {
    await saveTeamAssistantProvider("team-a", inputFor("secret-a"), provider, model);
    await saveTeamAssistantProvider("team-b", inputFor("secret-b"), provider, model);
    assert.equal(rows.get("team-a").encryptedCredential.includes("secret-a"), false);
    assert.equal(rows.get("team-b").encryptedCredential.includes("secret-b"), false);

    const status = await getSafeTeamAssistantProviderStatus("team-a");
    assert.equal(status.configured, true);
    assert.equal(status.modelId, "model-a");
    assert.equal(JSON.stringify(status).includes("secret-a"), false);
    assert.equal(JSON.stringify(status).includes("encryptedCredential"), false);

    assert.equal((await getTeamAssistantProvider("team-a")).apiKey, "secret-a");
    assert.equal((await getTeamAssistantProvider("team-b")).apiKey, "secret-b");
    await removeTeamAssistantProvider("team-a");
    assert.equal(await getTeamAssistantProvider("team-a"), undefined);
    assert.equal((await getTeamAssistantProvider("team-b")).apiKey, "secret-b");
    assert.equal((await getSafeTeamAssistantProviderStatus("team-a")).configured, false);
  } finally {
    rows.clear();
    if (previous === undefined) delete process.env.AI_BYOK_ENCRYPTION_KEY;
    else process.env.AI_BYOK_ENCRYPTION_KEY = previous;
  }
});
