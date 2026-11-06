import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  clearAssistantProviderCatalogCacheForTests,
  getAssistantProvider,
  listAssistantProviders,
  listProviderModels,
} from "./assistantProviderCatalog.ts";

const fixture = {
  anthropic: {
    name: "Anthropic",
    models: {
      "claude-demo": {
        id: "claude-demo",
        name: "Claude Demo",
        modalities: { input: ["text", "image"], output: ["text"] },
        tool_call: true,
        reasoning: true,
        limit: { context: 128000 },
      },
    },
  },
  google: {
    name: "Google",
    models: {
      "gemini-demo": {
        id: "gemini-demo",
        name: "Gemini Demo",
        modalities: { input: ["text", "audio"], output: ["text", "audio"] },
        tool_call: true,
      },
    },
  },
  openai: {
    name: "OpenAI",
    models: {
      "gpt-demo": {
        id: "gpt-demo",
        name: "GPT Demo",
        modalities: { input: ["text", "image"], output: ["text", "image"] },
        tool_call: true,
      },
    },
  },
};

test("models.dev provider and model metadata is normalized, searchable, and cached without credentials", async () => {
  clearAssistantProviderCatalogCacheForTests();
  const requests = [];
  const fetchMock = mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: String(url), options });
    return Response.json(fixture);
  });
  try {
    const listed = await listAssistantProviders("google");
    assert.deepEqual(listed.items.map((item) => item.id), ["google"]);
    assert.equal(listed.items[0].modelCount, 1);
    const models = await listProviderModels("google", "demo");
    assert.equal(models[0].id, "gemini-demo");
    assert.deepEqual(models[0].inputModalities, ["text", "audio"]);
    assert.equal(models[0].toolCalling, true);

    await listAssistantProviders();
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, "https://models.dev/api.json");
    assert.equal(JSON.stringify(requests[0]).includes("apiKey"), false);

    const responses = await getAssistantProvider("openai-responses");
    assert.equal(responses.protocol, "openai-responses");
    assert.equal(responses.models[0].id, "gpt-demo");
    assert.equal((await getAssistantProvider("custom-openai-compatible")).models.length, 0);
  } finally {
    fetchMock.mock.restore();
    clearAssistantProviderCatalogCacheForTests();
  }
});

test("stale provider catalog stays usable when models.dev refresh fails", async () => {
  clearAssistantProviderCatalogCacheForTests();
  const fetchMock = mock.method(globalThis, "fetch", async () => Response.json(fixture));
  try {
    await listAssistantProviders();
  } finally {
    fetchMock.mock.restore();
  }
  const failedRefresh = mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
  try {
    const stale = await listAssistantProviders("anthropic", true);
    assert.equal(stale.items[0].id, "anthropic");
  } finally {
    failedRefresh.mock.restore();
    clearAssistantProviderCatalogCacheForTests();
  }
});

