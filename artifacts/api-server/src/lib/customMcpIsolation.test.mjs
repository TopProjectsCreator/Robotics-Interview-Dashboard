import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

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

process.env.SESSION_SECRET = "custom-mcp-isolation-test-secret-at-least-32";

const state = {
  connections: new Map(),
  oauthStates: new Map(),
  requests: [],
  tokenUpdates: [],
};

function parseJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

const pool = {
  async query(statement, values = []) {
    if (statement.includes("insert into custom_mcp_oauth_states")) {
      const [id, connectionId, stateHash, accountId, teamId, endpointUrl, resourceUri, clientId, tokenEndpoint,
        authorizationEndpoint, redirectUri, codeVerifier] = values;
      state.oauthStates.set(stateHash, {
        id, connection_id: connectionId, account_id: accountId, team_id: teamId, endpoint_url: endpointUrl, resource_uri: resourceUri,
        client_id: clientId, token_endpoint: tokenEndpoint, authorization_endpoint: authorizationEndpoint,
        redirect_uri: redirectUri, code_verifier: parseJson(codeVerifier), created_at: Date.now(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (statement.includes("delete from custom_mcp_oauth_states") && statement.includes("returning")) {
      const [stateHash] = values;
      const row = state.oauthStates.get(stateHash);
      if (!row) return { rows: [], rowCount: 0 };
      state.oauthStates.delete(stateHash);
      return { rows: [row], rowCount: 1 };
    }
    if (statement.includes("insert into custom_mcp_connections")) {
      const [id, accountId, teamId, endpointUrl] = values;
      if (values.length === 7) {
        const [, , , , apiKey, apiKeyHeader, apiKeyPrefix] = values;
        state.connections.set(id, {
          id, account_id: accountId, team_id: teamId, endpoint_url: endpointUrl,
          access_token: null, api_key: parseJson(apiKey), api_key_header: apiKeyHeader, api_key_prefix: apiKeyPrefix,
        });
      } else {
        const [, , , , accessToken, refreshToken, clientId, tokenEndpoint, expiresIn] = values;
        state.connections.set(id, {
          id, account_id: accountId, team_id: teamId, endpoint_url: endpointUrl,
          access_token: parseJson(accessToken), refresh_token: refreshToken ? parseJson(refreshToken) : null,
          api_key: null, api_key_header: null, api_key_prefix: null, client_id: clientId,
          token_endpoint: tokenEndpoint, expires_at: Date.now() + Number(expiresIn) * 1000,
        });
      }
      return { rows: [], rowCount: 1 };
    }
    if (statement.startsWith("select") && statement.includes("from custom_mcp_connections")) {
      if (statement.includes("where id = $1")) {
        const [id, accountId, teamId] = values;
        const row = state.connections.get(id);
        return { rows: row?.account_id === accountId && row?.team_id === teamId ? [{ ...row }] : [], rowCount: 1 };
      }
      const [accountId, teamId] = values;
      const rows = [...state.connections.values()].filter((row) => row.account_id === accountId && row.team_id === teamId);
      return { rows: rows.map((row) => ({ ...row })), rowCount: rows.length };
    }
    if (statement.startsWith("delete from custom_mcp_connections")) {
      const [id, accountId, teamId] = values;
      const row = state.connections.get(id);
      if (row?.account_id === accountId && row?.team_id === teamId) state.connections.delete(id);
      return { rows: [], rowCount: row?.account_id === accountId && row?.team_id === teamId ? 1 : 0 };
    }
    if (statement.startsWith("update custom_mcp_connections")) {
      const [id, accountId, teamId, accessToken, refreshToken, expiresIn] = values;
      const row = state.connections.get(id);
      if (row?.account_id === accountId && row?.team_id === teamId) {
        row.access_token = parseJson(accessToken);
        row.refresh_token = parseJson(refreshToken);
        row.expires_at = Date.now() + Number(expiresIn) * 1000;
        state.tokenUpdates.push(id);
      }
      return { rows: [], rowCount: row?.account_id === accountId && row?.team_id === teamId ? 1 : 0 };
    }
    throw new Error(`Unexpected custom MCP test query: ${statement}`);
  },
};

mock.module("@workspace/db", { namedExports: { pool } });
mock.module("node:dns/promises", {
  namedExports: { lookup: async () => [{ address: "93.184.216.34", family: 4 }] },
});

const {
  callCustomMcpTool,
  customMcpStatus,
  disconnectCustomMcp,
  finishCustomMcpAuthorization,
  listCustomMcpTools,
  startCustomMcpConnection,
} = await import("./customMcp.ts");

const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = String(input);
  const headers = new Headers(init.headers);
  const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
  state.requests.push({ url, headers, body });

  if (url === "https://example.com/apikey" || url === "https://example.com/apikey-alt") {
    const isAlt = url.endsWith("apikey-alt");
    const expectedKey = isAlt ? "private-alt-api-key" : "private-api-key";
    if (headers.get("x-api-key") !== expectedKey) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (body.method === "initialize") {
      return Response.json({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-03-26" } });
    }
    if (body.method === "tools/list") {
      return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "shared_tool", inputSchema: { type: "object" } }] } });
    }
    if (body.method === "tools/call") {
      return Response.json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: isAlt ? "second-server result" : "first-server result" }] } });
    }
    return new Response(null, { status: 202 });
  }

  if (url === "https://example.com/oauth" || url === "https://example.com/oauth-alt") {
    if (!headers.get("authorization")) {
      return new Response("Sign in required", {
        status: 401,
        headers: { "www-authenticate": 'Bearer resource_metadata="https://example.com/.well-known/oauth-protected-resource"' },
      });
    }
    if (body.method === "initialize") {
      return Response.json({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-03-26" } });
    }
    if (body.method === "tools/list") {
      return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "oauth_tool", inputSchema: { type: "object" } }] } });
    }
    return new Response(null, { status: 202 });
  }

  if (url === "https://example.com/.well-known/oauth-protected-resource") {
    return Response.json({ resource: "https://example.com/oauth", authorization_servers: ["https://example.com/auth/v1"] });
  }
  if (url === "https://example.com/.well-known/oauth-authorization-server/auth/v1") {
    return Response.json({
      authorization_endpoint: "https://example.com/authorize",
      token_endpoint: "https://example.com/token",
      registration_endpoint: "https://example.com/register",
    });
  }
  if (url === "https://example.com/register") {
    return Response.json({ client_id: "test-client" }, { status: 201 });
  }
  if (url === "https://example.com/token") {
    const form = new URLSearchParams(String(init.body));
    if (form.get("grant_type") === "refresh_token") {
      return Response.json({ access_token: "oauth-refreshed-token", refresh_token: "oauth-private-refresh", expires_in: 3600 });
    }
    return Response.json({ access_token: "oauth-private-token", refresh_token: "oauth-private-refresh", expires_in: 3600 });
  }
  throw new Error(`Unexpected custom MCP HTTP request: ${url}`);
};

test.after(() => {
  globalThis.fetch = originalFetch;
  mock.restoreAll();
});

test("API-key connections and tool calls remain private to the signed-in account and active team", async () => {
  state.connections.clear();
  state.requests.length = 0;
  const firstConnection = await startCustomMcpConnection({
    accountId: "member-a",
    teamId: "team-a",
    endpointUrl: "https://example.com/apikey",
    redirectUri: "https://robotics.test/api/assistant/custom-mcp/callback",
    apiKey: "private-api-key",
    apiKeyHeader: "X-API-Key",
  });
  const secondConnection = await startCustomMcpConnection({
    accountId: "member-a",
    teamId: "team-a",
    endpointUrl: "https://example.com/apikey-alt",
    redirectUri: "https://robotics.test/api/assistant/custom-mcp/callback",
    apiKey: "private-alt-api-key",
    apiKeyHeader: "X-API-Key",
  });

  const stored = state.connections.get(firstConnection.connectionId);
  assert.equal(stored.team_id, "team-a");
  assert.equal(JSON.stringify(stored.api_key).includes("private-api-key"), false, "API keys are encrypted at rest");
  assert.equal(state.connections.get(secondConnection.connectionId).team_id, "team-a");
  assert.equal((await customMcpStatus("member-a", "team-a")).connections.length, 2);
  assert.deepEqual(await customMcpStatus("member-b", "team-a"), { connections: [] });
  assert.deepEqual(await customMcpStatus("member-a", "team-b"), { connections: [] });

  const memberTools = await listCustomMcpTools("member-a", "team-a");
  assert.equal(memberTools.tools.length, 2);
  assert.equal(new Set(memberTools.tools.map((tool) => tool.function.name)).size, 2);
  assert.ok(memberTools.tools.every((tool) => tool.function.name.startsWith("custom_mcp_")));
  const [firstTool, secondTool] = [...memberTools.bindings.entries()];
  assert.equal(await callCustomMcpTool("member-a", "team-a", firstTool[1].connectionId, firstTool[1].toolName, {}), "first-server result");
  assert.equal(await callCustomMcpTool("member-a", "team-a", secondTool[1].connectionId, secondTool[1].toolName, {}), "second-server result");
  assert.deepEqual((await listCustomMcpTools("member-b", "team-a")).tools, []);
  assert.deepEqual((await listCustomMcpTools("member-a", "team-b")).tools, []);
  await assert.rejects(callCustomMcpTool("member-b", "team-a", firstTool[1].connectionId, firstTool[1].toolName, {}), /not connected/);
  await assert.rejects(callCustomMcpTool("member-a", "team-b", firstTool[1].connectionId, firstTool[1].toolName, {}), /not connected/);

  await disconnectCustomMcp("member-a", "team-a", "wrong-connection-id");
  assert.equal((await customMcpStatus("member-a", "team-a")).connections.length, 2);
  await disconnectCustomMcp("member-a", "team-a", firstConnection.connectionId);
  assert.deepEqual((await customMcpStatus("member-a", "team-a")).connections.map((item) => item.id), [secondConnection.connectionId]);
  assert.deepEqual(
    (await listCustomMcpTools("member-a", "team-a")).tools.map((tool) => tool.function.name),
    ["custom_mcp_shared_tool"],
    "unique tools keep their existing names for saved assistant settings",
  );
  await disconnectCustomMcp("member-a", "team-a", secondConnection.connectionId);
  assert.deepEqual((await customMcpStatus("member-a", "team-a")).connections, []);
});

test("custom MCP OAuth state keeps the initiating account and team as callback owner", async () => {
  state.connections.clear();
  state.oauthStates.clear();
  state.tokenUpdates.length = 0;
  const result = await startCustomMcpConnection({
    accountId: "member-oauth",
    teamId: "team-oauth",
    endpointUrl: "https://example.com/oauth",
    redirectUri: "https://robotics.test/api/assistant/custom-mcp/callback",
  });
  const second = await startCustomMcpConnection({
    accountId: "member-oauth",
    teamId: "team-oauth",
    endpointUrl: "https://example.com/oauth-alt",
    redirectUri: "https://robotics.test/api/assistant/custom-mcp/callback",
  });
  assert.ok(result.authorizationUrl);
  const authorizationUrl = new URL(result.authorizationUrl);
  const returnedState = authorizationUrl.searchParams.get("state");
  assert.ok(returnedState);
  const secondState = new URL(second.authorizationUrl).searchParams.get("state");
  assert.ok(secondState);

  const completedSecond = await finishCustomMcpAuthorization({ state: secondState, code: "oauth-code-2" });
  assert.equal(completedSecond.endpointUrl, "https://example.com/oauth-alt");
  const completed = await finishCustomMcpAuthorization({ state: returnedState, code: "oauth-code" });
  assert.equal(completed.endpointUrl, "https://example.com/oauth");
  const oauthConnections = (await customMcpStatus("member-oauth", "team-oauth")).connections;
  assert.equal(oauthConnections.length, 2, "completing two OAuth flows retains both connections");
  for (const oauthConnection of oauthConnections) {
    assert.equal(state.connections.get(oauthConnection.id).team_id, "team-oauth");
    assert.equal(JSON.stringify(state.connections.get(oauthConnection.id).access_token).includes("oauth-private-token"), false);
  }
  const expiring = state.connections.get(oauthConnections[0].id);
  expiring.expires_at = new Date(1);
  await listCustomMcpTools("member-oauth", "team-oauth");
  assert.deepEqual(state.tokenUpdates, [expiring.id], "refresh updates only the matching connection row");
  assert.deepEqual(await customMcpStatus("other-member", "team-oauth"), { connections: [] });
  await assert.rejects(finishCustomMcpAuthorization({ state: returnedState, code: "replay" }), /expired or was already used/);
});
