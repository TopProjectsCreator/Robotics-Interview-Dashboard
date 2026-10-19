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
const poolQueries = [];
let poolRows = [];
mock.module("@workspace/db", {
  namedExports: {
    pool: {
      query: async (text, params = []) => {
        poolQueries.push({ text: String(text), params });
        return { rows: poolRows };
      },
    },
  },
});
const {
  authorizationMetadataCandidates,
  customMcpStatus,
  parseRpcPayload,
  quotedParameter,
  resourceMetadataCandidates,
  session,
  startCustomMcpConnection,
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

test("sends configured API-key headers on MCP initialize and tool requests", async () => {
  const originalFetch = globalThis.fetch;
  const seenHeaders = [];
  globalThis.fetch = async (_input, init = {}) => {
    seenHeaders.push(new Headers(init.headers).get("x-api-key"));
    const message = JSON.parse(String(init.body));
    return Response.json({
      jsonrpc: "2.0",
      id: message.id,
      result: message.method === "initialize" ? { protocolVersion: "2025-03-26" } : { tools: [] },
    });
  };
  try {
    await session("https://mcp.example/mcp", undefined, async (send) => {
      const { response } = await send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      assert.equal(response.ok, true);
    }, { "X-API-Key": "test-value" });
    assert.deepEqual(seenHeaders, ["test-value", "test-value", "test-value"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("API-key challenge can be retried with the explicit key and remains account/team scoped", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.SESSION_SECRET;
  const endpointUrl = "https://8.8.8.8/mcp";
  process.env.SESSION_SECRET = "test-session-secret-for-custom-mcp-encryption";
  poolQueries.length = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const headers = new Headers(init.headers);
    if (url.pathname === "/mcp") {
      const apiKey = headers.get("x-api-key");
      if (apiKey !== "correct-test-key") {
        return new Response("Unauthorized", {
          status: 401,
          headers: { "www-authenticate": 'Bearer realm="mcp"' },
        });
      }
      const body = JSON.parse(String(init.body));
      return Response.json({
        jsonrpc: "2.0",
        ...(body.id !== undefined ? { id: body.id } : {}),
        result: body.method === "initialize" ? { protocolVersion: "2025-03-26" } : { tools: [] },
      });
    }
    return new Response("", { status: 404 });
  };
  try {
    const challenged = await startCustomMcpConnection({
      accountId: "account-a",
      teamId: "team-a",
      endpointUrl,
      redirectUri: "https://app.example/api/assistant/custom-mcp/callback",
    });
    assert.equal(challenged.apiKeyRequired, true);
    assert.equal(challenged.endpointUrl, endpointUrl);

    const connected = await startCustomMcpConnection({
      accountId: "account-a",
      teamId: "team-a",
      endpointUrl,
      redirectUri: "https://app.example/api/assistant/custom-mcp/callback",
      apiKey: "correct-test-key",
      apiKeyHeader: "X-API-Key",
    });
    assert.deepEqual(connected, { connected: true, endpointUrl, toolCount: 0 });
    const saved = poolQueries.find(({ text }) => text.includes("insert into custom_mcp_connections"));
    assert.deepEqual(saved.params.slice(0, 2), ["account-a", "team-a"]);
    assert.equal(JSON.stringify(poolQueries).includes("correct-test-key"), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  }
});

test("OAuth discovery returns an authorization URL and stores its state for the signed-in account and team", async () => {
  const originalFetch = globalThis.fetch;
  const originalSecret = process.env.SESSION_SECRET;
  const endpointUrl = "https://8.8.8.8/mcp";
  process.env.SESSION_SECRET = "test-session-secret-for-custom-mcp-encryption";
  poolQueries.length = 0;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    if (url.pathname === "/mcp" && init.method === "POST") {
      return new Response("Unauthorized", {
        status: 401,
        headers: {
          "www-authenticate": 'Bearer realm="mcp", resource_metadata="https://8.8.8.8/.well-known/oauth-protected-resource"',
        },
      });
    }
    if (url.pathname.includes("oauth-protected-resource")) {
      return Response.json({
        resource: endpointUrl,
        authorization_servers: ["https://8.8.8.8"],
      });
    }
    if (url.pathname.includes("oauth-authorization-server")) {
      return Response.json({
        authorization_endpoint: "https://8.8.8.8/oauth/authorize",
        token_endpoint: "https://8.8.8.8/oauth/token",
        registration_endpoint: "https://8.8.8.8/oauth/register",
      });
    }
    if (url.pathname === "/oauth/register") return Response.json({ client_id: "test-client" });
    return new Response("", { status: 404 });
  };
  try {
    const result = await startCustomMcpConnection({
      accountId: "account-b",
      teamId: "team-b",
      endpointUrl,
      redirectUri: "https://app.example/api/assistant/custom-mcp/callback",
    });
    assert.equal(result.connected, false);
    assert.match(result.authorizationUrl, /^https:\/\/8\.8\.8\.8\/oauth\/authorize\?/);
    assert.equal(new URL(result.authorizationUrl).searchParams.get("client_id"), "test-client");
    assert.ok(new URL(result.authorizationUrl).searchParams.get("state"));
    const savedState = poolQueries.find(({ text }) => text.includes("insert into custom_mcp_oauth_states"));
    assert.deepEqual(savedState.params.slice(2, 4), ["account-b", "team-b"]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSecret;
  }
});

test("custom MCP status lookup is isolated by both signed-in account and active team", async () => {
  poolRows = [{ endpoint_url: "https://tools.example/mcp" }];
  poolQueries.length = 0;
  try {
    const status = await customMcpStatus("account-c", "team-c");
    assert.deepEqual(status, { connected: true, endpointUrl: "https://tools.example/mcp" });
    assert.deepEqual(poolQueries.at(-1).params, ["account-c", "team-c"]);
    assert.match(poolQueries.at(-1).text, /where account_id = \$1 and team_id = \$2/);
  } finally {
    poolRows = [];
  }
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
      assert.equal(new Headers(init.headers).get("x-api-key"), "test-value");
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
      assert.equal(new Headers(init.headers).get("x-api-key"), "test-value");
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
    }, { "X-API-Key": "test-value" });
    assert.deepEqual(tools, [{ name: "sample" }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
