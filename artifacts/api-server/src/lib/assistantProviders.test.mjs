import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { after, before, mock, test } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          try {
            return nextResolve(`${specifier}/index.ts`, context);
          } catch {
            throw error;
          }
        }
      }
      throw error;
    }
  },
});

const statusByTeam = new Map();
const calls = { providers: [], models: [], validations: [], saves: [], removals: [], logs: [] };
const provider = {
  id: "anthropic",
  name: "Anthropic",
  protocol: "anthropic-messages",
  website: "https://anthropic.com",
};
const model = {
  id: "claude-test",
  name: "Claude test model",
  description: "Test model",
  contextLength: 32000,
  inputModalities: ["text", "image"],
  outputModalities: ["text"],
  toolCalling: true,
  reasoning: false,
};
const safeStatus = (teamId) => statusByTeam.get(teamId) ?? {
  configured: false,
  providerId: null,
  providerName: null,
  modelId: null,
  protocol: null,
  endpointUrl: null,
  updatedAt: null,
};

mock.module("../lib/assistantProviderCatalog", {
  namedExports: {
    getAssistantProvider: async (id) => id === provider.id ? provider : undefined,
    listAssistantProviders: async (search, refresh) => {
      calls.providers.push({ search, refresh });
      return { items: [{ ...provider, modelCount: 1 }], refreshedAt: new Date() };
    },
    listProviderModels: async (providerId, search) => {
      calls.models.push({ providerId, search });
      return providerId === provider.id ? [model] : undefined;
    },
  },
});
mock.module("../lib/assistantProviderConfiguration", {
  namedExports: {
    getSafeTeamAssistantProviderStatus: async (teamId) => safeStatus(teamId),
    resolveAssistantProviderInput: async () => ({ provider, endpointUrl: undefined }),
    saveTeamAssistantProvider: async (...args) => {
      calls.saves.push(args);
      const [teamId, input, selectedProvider, selectedModel, endpointUrl] = args;
      statusByTeam.set(teamId, {
        configured: true,
        providerId: selectedProvider.id,
        providerName: selectedProvider.name,
        modelId: selectedModel.id,
        protocol: selectedProvider.protocol,
        endpointUrl: endpointUrl ?? null,
        updatedAt: new Date(),
      });
    },
    removeTeamAssistantProvider: async (teamId) => {
      calls.removals.push(teamId);
      statusByTeam.delete(teamId);
    },
  },
});
mock.module("../lib/assistantProviderAdapters", {
  namedExports: {
    AssistantProviderRequestError: class AssistantProviderRequestError extends Error {
      constructor(message, status = 503) { super(message); this.status = status; }
    },
    validateAssistantProviderConnection: async (active) => {
      calls.validations.push(active);
    },
  },
});
mock.module("../middlewares/adminAuth", {
  namedExports: {
    requireCoordinator(req, res, next) {
      if (req.get("x-test-role") !== "coordinator") {
        res.status(req.get("x-test-role") ? 403 : 401).json({ error: "Coordinator access required" });
        return;
      }
      next();
    },
    requestTeamId: async (req) => req.get("x-session-team") || "session-team",
  },
});

let baseUrl;
let server;
before(async () => {
  const [{ default: express }, { default: router }] = await Promise.all([
    import("express"),
    import("../routes/assistantProviders.ts"),
  ]);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = {
      warn: (...args) => calls.logs.push(args),
      error: (...args) => calls.logs.push(args),
    };
    next();
  });
  app.use("/api", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  mock.restoreAll();
});

async function request(path, { role = "coordinator", team = "team-a", ...init } = {}) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(role ? { "x-test-role": role } : {}),
      ...(team ? { "x-session-team": team } : {}),
      ...init.headers,
    },
  });
}

test("provider catalog and model search are coordinator-only and never accept credential fields", async () => {
  const denied = await request("/assistant/providers?search=anthropic", { role: "interviewer" });
  assert.equal(denied.status, 403);
  assert.equal(calls.providers.length, 0);

  const providers = await request("/assistant/providers?search=anthropic&refresh=true");
  assert.equal(providers.status, 200);
  assert.deepEqual((await providers.json()).items.map((item) => item.id), ["anthropic"]);
  assert.deepEqual(calls.providers.at(-1), { search: "anthropic", refresh: true });

  const models = await request("/assistant/providers/anthropic/models?search=claude");
  assert.equal(models.status, 200);
  assert.deepEqual((await models.json()).items.map((item) => item.id), ["claude-test"]);
  assert.deepEqual(calls.models.at(-1), { providerId: "anthropic", search: "claude" });
});

test("safe status, validation, save, and remove stay scoped to the session team and never return keys", async () => {
  statusByTeam.set("team-a", {
    configured: true,
    providerId: provider.id,
    providerName: provider.name,
    modelId: model.id,
    protocol: provider.protocol,
    endpointUrl: null,
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  const denied = await request("/assistant/provider-config", { role: "interviewer" });
  assert.equal(denied.status, 403);

  const statusA = await request("/assistant/provider-config", { team: "team-a" });
  const statusB = await request("/assistant/provider-config", { team: "team-b" });
  const safeA = await statusA.json();
  const safeB = await statusB.json();
  assert.equal(safeA.configured, true);
  assert.equal(safeB.configured, false);
  assert.equal(JSON.stringify(safeA).includes("apiKey"), false);
  assert.equal(JSON.stringify(safeA).includes("secret"), false);

  const payload = {
    providerId: provider.id,
    modelId: model.id,
    apiKey: "one-time-team-key",
    teamId: "attacker-selected-team",
  };
  const validation = await request("/assistant/provider-config/validate", {
    team: "team-b",
    method: "POST",
    body: JSON.stringify(payload),
  });
  assert.equal(validation.status, 200);
  assert.equal((await validation.json()).valid, true);
  assert.equal(calls.saves.length, 0);

  const saved = await request("/assistant/provider-config", {
    team: "team-b",
    method: "PUT",
    body: JSON.stringify(payload),
  });
  assert.equal(saved.status, 200);
  const safeSaved = await saved.json();
  assert.equal(safeSaved.configured, true);
  assert.equal(JSON.stringify(safeSaved).includes("one-time-team-key"), false);
  assert.equal(calls.saves.length, 1);
  assert.equal(calls.saves[0][0], "team-b");
  assert.equal(calls.saves[0][1].apiKey, "one-time-team-key");
  assert.equal(calls.validations.length, 2);
  assert.equal(calls.validations[0].teamId, "configuration-test");

  const removed = await request("/assistant/provider-config", { team: "team-a", method: "DELETE" });
  assert.equal(removed.status, 204);
  assert.deepEqual(calls.removals, ["team-a"]);
  const retainedB = await request("/assistant/provider-config", { team: "team-b" });
  assert.equal((await retainedB.json()).configured, true);
});
