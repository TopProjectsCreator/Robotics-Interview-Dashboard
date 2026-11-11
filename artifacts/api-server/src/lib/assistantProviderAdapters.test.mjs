import assert from "node:assert/strict";
import { mock, test } from "node:test";
import {
  AssistantProviderRequestError,
  assertProviderCapabilities,
  invokeAssistantProvider,
} from "./assistantProviderAdapters.ts";

const model = {
  id: "provider-model",
  name: "Provider model",
  contextLength: 32000,
  inputModalities: ["text", "image", "audio"],
  outputModalities: ["text", "image", "audio"],
  toolCalling: true,
  reasoning: false,
};

function provider(protocol, overrides = {}) {
  return {
    teamId: "team-a",
    providerId: "provider-a",
    providerName: "Provider A",
    modelId: model.id,
    protocol,
    apiKey: "private-key-value",
    ...(protocol === "openai-compatible" ? { endpointUrl: "https://api.example.com/v1" } : {}),
    model,
    ...overrides,
  };
}

test("OpenAI Chat Completions uses the team credential and selected model", async () => {
  let captured;
  const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    captured = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
    return Response.json({
      id: "chat-1",
      model: model.id,
      choices: [{ index: 0, message: { role: "assistant", content: "hello" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    });
  });
  try {
    const response = await invokeAssistantProvider(provider("openai-chat-completions"), model, {
      model: "ignored-model",
      messages: [{ role: "user", content: "hello" }],
      reasoning_effort: "high",
    });
    assert.equal(captured.url, "https://api.openai.com/v1/chat/completions");
    assert.equal(captured.headers.get("authorization"), "Bearer private-key-value");
    assert.equal(captured.body.model, model.id);
    assert.equal(captured.body.reasoning_effort, "high");
    assert.equal("max_tokens" in captured.body, false);
    assert.equal("max_completion_tokens" in captured.body, false);
    assert.equal(response.choices[0].message.content, "hello");
    assert.deepEqual(response.usage, { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 });
  } finally {
    fetchMock.mock.restore();
  }
});

test("custom OpenAI-compatible endpoints receive only the configured key and reject redirects", async () => {
  let captured;
  const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    captured = { url: String(url), headers: new Headers(init.headers), redirect: init.redirect };
    return Response.json({
      id: "custom-1",
      model: model.id,
      choices: [{ index: 0, message: { role: "assistant", content: "custom" }, finish_reason: "stop" }],
    });
  });
  try {
    const response = await invokeAssistantProvider(provider("openai-compatible"), model, {
      model: model.id,
      messages: [{ role: "user", content: "hello" }],
    });
    assert.equal(captured.url, "https://api.example.com/v1/chat/completions");
    assert.equal(captured.headers.get("authorization"), "Bearer private-key-value");
    assert.equal(captured.redirect, "error");
    assert.equal(response.choices[0].message.content, "custom");
  } finally {
    fetchMock.mock.restore();
  }
});

test("OpenAI Responses converts the native output back to the assistant chat contract", async () => {
  let captured;
  const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    captured = { url: String(url), body: JSON.parse(init.body) };
    return Response.json({
      id: "resp-1",
      model: model.id,
      output: [{ type: "message", content: [{ type: "output_text", text: "from responses" }] }],
      usage: { input_tokens: 4, output_tokens: 3 },
    });
  });
  try {
    const response = await invokeAssistantProvider(provider("openai-responses"), model, {
      model: model.id,
      messages: [{ role: "user", content: "hello" }],
      response_format: { type: "json_object" },
      reasoning: { effort: "high" },
    });
    assert.equal(captured.url, "https://api.openai.com/v1/responses");
    assert.equal(captured.body.input[0].role, "user");
    assert.deepEqual(captured.body.text, { format: { type: "json_object" } });
    assert.deepEqual(captured.body.reasoning, { effort: "high" });
    assert.equal("max_output_tokens" in captured.body, false);
    assert.equal(response.choices[0].message.content, "from responses");
    assert.equal(response.usage.prompt_tokens, 4);
    assert.equal(response.usage.completion_tokens, 3);
    assert.equal(response.usage.total_tokens, undefined);
  } finally {
    fetchMock.mock.restore();
  }
});

test("Anthropic Messages maps tools and system content into the native protocol", async () => {
  let captured;
  const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    captured = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
    return Response.json({
      id: "msg-1",
      model: model.id,
      stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "call-1", name: "lookup", input: { q: "x" } }],
      usage: { input_tokens: 6, output_tokens: 2 },
    });
  });
  try {
    const response = await invokeAssistantProvider(provider("anthropic-messages"), model, {
      model: model.id,
      messages: [{ role: "system", content: "rules" }, { role: "user", content: "search" }],
      tools: [{ type: "function", function: { name: "lookup", description: "Lookup", parameters: { type: "object" } } }],
    });
    assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
    assert.equal(captured.headers.get("x-api-key"), "private-key-value");
    assert.equal(captured.body.system, "rules");
    assert.equal(captured.body.tools[0].name, "lookup");
    assert.equal(response.choices[0].message.tool_calls[0].function.name, "lookup");
    assert.equal(response.usage.prompt_tokens, 6);
    assert.equal(response.usage.completion_tokens, 2);
    assert.equal(response.usage.total_tokens, undefined);
  } finally {
    fetchMock.mock.restore();
  }
});

test("Gemini maps generate-content and returns normalized tool and image data", async () => {
  let captured;
  const fetchMock = mock.method(globalThis, "fetch", async (url, init) => {
    captured = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) };
    return Response.json({
      responseId: "gemini-1",
      candidates: [{
        content: {
          role: "model",
          parts: [
            { text: "created" },
            { functionCall: { name: "lookup", args: { q: "x" } } },
            { inlineData: { mimeType: "image/png", data: "aW1hZ2U=" } },
          ],
        },
      }],
      usageMetadata: { promptTokenCount: 8, candidatesTokenCount: 4 },
    });
  });
  try {
    const response = await invokeAssistantProvider(provider("gemini-generate-content"), model, {
      model: model.id,
      messages: [{ role: "user", content: "hello" }],
      tools: [{ type: "function", function: { name: "lookup", parameters: { type: "object" } } }],
    });
    assert.equal(captured.url, `https://generativelanguage.googleapis.com/v1beta/models/${model.id}:generateContent`);
    assert.equal(captured.headers.get("x-goog-api-key"), "private-key-value");
    assert.equal(captured.body.contents[0].parts[0].text, "hello");
    assert.equal(response.choices[0].message.tool_calls[0].function.name, "lookup");
    assert.equal(response.choices[0].message.images[0].image_url.url, "data:image/png;base64,aW1hZ2U=");
    assert.equal(response.usage.prompt_tokens, 8);
    assert.equal(response.usage.completion_tokens, 4);
    assert.equal(response.usage.total_tokens, undefined);
  } finally {
    fetchMock.mock.restore();
  }
});

test("Gemini streaming normalizes server-sent events and stops unsupported modalities before fetch", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => new Response(
    `data: ${JSON.stringify({ responseId: "stream-1", candidates: [{ content: { parts: [{ text: "chunk" }] } }] })}\n\n`,
    { headers: { "content-type": "text/event-stream" } },
  ));
  try {
    const stream = await invokeAssistantProvider(
      provider("gemini-generate-content"),
      model,
      { model: model.id, messages: [{ role: "user", content: "hello" }], stream: true },
    );
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(chunks[0].choices[0].delta.content, "chunk");
    assert.match(fetchMock.mock.calls[0].arguments[0], /streamGenerateContent\?alt=sse$/);

    await assert.rejects(
      Promise.resolve().then(() => assertProviderCapabilities(
        { model: model.id, messages: [{ role: "user", content: "text" }], tools: [{ type: "function" }] },
        { ...model, toolCalling: false },
        "Provider A",
        "gemini-generate-content",
      )),
      AssistantProviderRequestError,
    );
  } finally {
    fetchMock.mock.restore();
  }
});

test("native OpenAI Responses and Anthropic streams normalize into chat deltas", async () => {
  const fixtures = [
    {
      provider: provider("openai-responses"),
      body: [
        `event: response.output_text.delta\ndata: ${JSON.stringify({ type: "response.output_text.delta", delta: "response" })}\n\n`,
        `event: response.completed\ndata: ${JSON.stringify({ type: "response.completed", response: { usage: { input_tokens: 10, output_tokens: 4 } } })}\n\n`,
      ].join(""),
    },
    {
      provider: provider("anthropic-messages"),
      body: [
        `event: message_start\ndata: ${JSON.stringify({ type: "message_start", message: { id: "msg-stream", usage: { input_tokens: 12 } } })}\n\n`,
        `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "anthropic" } })}\n\n`,
        `event: message_delta\ndata: ${JSON.stringify({ type: "message_delta", delta: { stop_reason: "end_turn" }, usage: { output_tokens: 5 } })}\n\n`,
      ].join(""),
    },
  ];
  for (const fixture of fixtures) {
    const fetchMock = mock.method(globalThis, "fetch", async () => new Response(fixture.body, {
      headers: { "content-type": "text/event-stream" },
    }));
    try {
      const stream = await invokeAssistantProvider(fixture.provider, model, {
        model: model.id,
        messages: [{ role: "user", content: "hello" }],
        stream: true,
      });
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      expectStreamDelta(chunks, fixture.provider.protocol === "openai-responses" ? "response" : "anthropic");
      const usageChunks = chunks.flatMap((chunk) => chunk.usage ? [chunk.usage] : []);
      assert.ok(usageChunks.length);
      assert.equal(
        usageChunks.find((usage) => usage.prompt_tokens != null || usage.input_tokens != null)?.prompt_tokens ??
          usageChunks.find((usage) => usage.input_tokens != null)?.input_tokens,
        fixture.provider.protocol === "openai-responses" ? 10 : 12,
      );
      assert.equal(
        usageChunks.find((usage) => usage.completion_tokens != null || usage.output_tokens != null)?.completion_tokens ??
          usageChunks.find((usage) => usage.output_tokens != null)?.output_tokens,
        fixture.provider.protocol === "openai-responses" ? 4 : 5,
      );
    } finally {
      fetchMock.mock.restore();
    }
  }
});

function expectStreamDelta(chunks, expected) {
  const delta = chunks.flatMap((chunk) => chunk.choices ?? [])
    .map((choice) => choice.delta?.content)
    .find((content) => typeof content === "string");
  assert.equal(delta, expected);
}

test("unsupported image and audio combinations fail before contacting a provider", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () => {
    throw new Error("must not reach network");
  });
  try {
    await assert.rejects(
      invokeAssistantProvider(provider("openai-chat-completions"), {
        ...model,
        outputModalities: ["text"],
      }, {
        model: model.id,
        messages: [{ role: "user", content: "draw" }],
        modalities: ["text", "image"],
      }),
      /does not support image generation/,
    );
    await assert.rejects(
      invokeAssistantProvider(provider("openai-responses"), model, {
        model: model.id,
        messages: [{ role: "user", content: "speak" }],
        modalities: ["text", "audio"],
      }),
      /does not support this image or audio workflow/,
    );
    assert.equal(fetchMock.mock.calls.length, 0);
  } finally {
    fetchMock.mock.restore();
  }
});

test("provider failure messages never include response bodies or team credentials", async () => {
  const fetchMock = mock.method(globalThis, "fetch", async () =>
    new Response("private-key-value echoed by provider", { status: 401 }),
  );
  try {
    await assert.rejects(
      invokeAssistantProvider(provider("openai-chat-completions"), model, {
        model: model.id,
        messages: [{ role: "user", content: "hello" }],
      }),
      (error) => error instanceof AssistantProviderRequestError &&
        !error.message.includes("private-key-value"),
    );
  } finally {
    fetchMock.mock.restore();
  }
});

