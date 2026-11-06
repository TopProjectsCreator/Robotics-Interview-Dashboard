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

let activeProvider;
let sharedCalls = 0;
const adapterCalls = [];
const model = {
  id: "byok-model",
  name: "BYOK model",
  contextLength: 32000,
  inputModalities: ["text"],
  outputModalities: ["text"],
  toolCalling: true,
  reasoning: false,
};
const defaultClient = {
  chat: {
    completions: {
      async create(request) {
        sharedCalls += 1;
        return { choices: [{ message: { content: "server default" } }], request };
      },
    },
  },
};
mock.module("@workspace/integrations-openai-ai-server", {
  namedExports: { openai: defaultClient },
});
mock.module("./assistantProviderConfiguration", {
  namedExports: {
    getTeamAssistantProvider: async (teamId) => activeProvider?.teamId === teamId ? activeProvider : undefined,
  },
});
mock.module("./assistantProviderSecurity", {
  namedExports: { validateCompatibleEndpoint: async (url) => url },
});
mock.module("./assistantProviderAdapters", {
  namedExports: {
    invokeAssistantProvider: async (...args) => {
      adapterCalls.push(args);
      throw new Error("Configured provider is unavailable");
    },
  },
});

const { teamAssistantAI } = await import("./teamAssistantAi.ts");

test("teams without an opt-in configuration retain the server provider, while BYOK errors never fall back", async () => {
  activeProvider = undefined;
  sharedCalls = 0;
  adapterCalls.length = 0;
  const defaultResponse = await teamAssistantAI("team-default").chat.completions.create({
    model: "server-model",
    messages: [{ role: "user", content: "hello" }],
  });
  assert.equal(defaultResponse.choices[0].message.content, "server default");
  assert.equal(sharedCalls, 1);
  assert.equal(adapterCalls.length, 0);

  activeProvider = {
    teamId: "team-byok",
    providerId: "anthropic",
    providerName: "Anthropic",
    modelId: "byok-model",
    protocol: "anthropic-messages",
    apiKey: "not-returned",
    model,
  };
  await assert.rejects(
    teamAssistantAI("team-byok").chat.completions.create({
      model: "caller-selected-model",
      messages: [{ role: "user", content: "hello" }],
    }),
    /Configured provider is unavailable/,
  );
  assert.equal(sharedCalls, 1);
  assert.equal(adapterCalls.length, 1);
  assert.equal(adapterCalls[0][0].teamId, "team-byok");
  assert.equal(adapterCalls[0][2].model, "byok-model");
  assert.equal(adapterCalls[0][2].messages[0].content, "hello");
});

