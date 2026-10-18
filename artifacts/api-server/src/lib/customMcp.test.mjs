import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});
mock.module("@workspace/db", { namedExports: { pool: { query: async () => ({ rows: [] }) } } });
const {
  authorizationMetadataCandidates,
  parseRpcPayload,
  quotedParameter,
  resourceMetadataCandidates,
  session,
  validateCustomMcpEndpoint,
} = await import("./customMcp.ts");

test("rejects non-HTTPS MCP endpoints before making a request", async () => {
  await assert.rejects(validateCustomMcpEndpoint("http://example.com/mcp"), /must use HTTPS/);
});

test("rejects localhost and private-address MCP endpoints", async () => {
  await assert.rejects(validateCustomMcpEndpoint("https://localhost/mcp"), /Private and local/);
  await assert.rejects(validateCustomMcpEndpoint("https://127.0.0.1/mcp"), /Private and local/);
  await assert.rejects(validateCustomMcpEndpoint("https://192.168.1.10/mcp"), /Private and local/);
});

test("rejects endpoint URLs that include embedded credentials", async () => {
  await assert.rejects(validateCustomMcpEndpoint("https://user:pass@example.com/mcp"), /cannot include credentials/);
});

test("uses the protected-resource URL advertised by the MCP challenge", () => {
  const challenge = 'Bearer realm="mcp", resource_metadata="https://project.example/functions/v1/mcp/.well-known/oauth-protected-resource"';
  const advertisedUrl = quotedParameter(challenge, "resource_metadata");
  const candidates = resourceMetadataCandidates(
    "https://project.example/functions/v1/mcp",
    advertisedUrl,
  );
  assert.deepEqual(candidates, ["https://project.example/functions/v1/mcp/.well-known/oauth-protected-resource"]);
});

test("discovers OAuth metadata for issuers with a path prefix", () => {
  assert.equal(
    authorizationMetadataCandidates("https://project.example/auth/v1")[0],
    "https://project.example/.well-known/oauth-authorization-server/auth/v1",
  );
});

test("parses the matching JSON-RPC response from an SSE stream", () => {
  const payload = parseRpcPayload(
    `event: message
data: {"jsonrpc":"2.0","method":"notifications/progress","params":{}}

event: message
data: {"jsonrpc":"2.0","id":7,"result":{"tools":[]}}
`,
    7,
  );
  assert.deepEqual(payload, { jsonrpc: "2.0", id: 7, result: { tools: [] } });
});

test("falls back to the legacy GET-SSE and POST-message transport", async () => {
  const originalFetch = globalThis.fetch;
  let streamController;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    if (url.pathname === "/sse" && method === "POST") {
      return new Response("unsupported", { status: 405 });
    }
    if (url.pathname === "/sse" && method === "GET") {
      const body = new ReadableStream({
        start(controller) {
          streamController = controller;
          controller.enqueue(new TextEncoder().encode("event: endpoint\ndata: /messages?session=abc\n\n"));
        },
        cancel() {},
      });
      return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    if (url.pathname === "/messages" && method === "POST") {
      const message = JSON.parse(String(init.body));
      if (message.id !== undefined) {
        streamController.enqueue(new TextEncoder().encode(
          `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: message.id, result: message.method === "initialize" ? { protocolVersion: "2025-03-26" } : { tools: [{ name: "sample" }] } })}\n\n`,
        ));
      }
      return new Response(null, { status: 202 });
    }
    throw new Error(`Unexpected mock MCP request: ${method} ${url}`);
  };
  try {
    const tools = await session("https://mcp.example/sse", undefined, async (send) => {
      const { response, payload } = await send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      assert.equal(response.status, 202);
      return payload.result.tools;
    });
    assert.deepEqual(tools, [{ name: "sample" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
