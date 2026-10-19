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
};

function parseJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

const pool = {
  async query(statement, values = []) {
    if (statement.includes("insert into custom_mcp_oauth_states")) {
      const [id, stateHash, accountId, teamId, endpointUrl, resourceUri, clientId, tokenEndpoint,
        authorizationEndpoint, redirectUri, codeVerifier] = values;
      state.oauthStates.set(stateHash, {
        id, account_id: accountId, team_id: teamId, endpoint_url: endpointUrl, resource_uri: resourceUri,
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
      const [accountId, teamId, endpointUrl] = values;
      if (statement.includes("api_key")) {
        const [, , , apiKey, apiKeyHeader, apiKeyPrefix] = values;
        state.connections.set(accountId, {
          account_id: accountId, team_id: teamId, endpoint_url: endpointUrl,
          access_token: null, api_key: parseJson(apiKey), api_key_header: apiKeyHeader, api_key_prefix: apiKeyPrefix,
        });
      } else {
        const [, , , accessToken, refreshToken, clientId, tokenEndpoint, expiresIn] = values;
        state.connections.set(accountId, {
          account_id: accountId, team_id: teamId, endpoint_url: endpointUrl,
          access_token: parseJson(accessToken), refresh_token: refreshToken ? parseJson(refreshToken) : null,
          api_key: null, api_key_header: null, api_key_prefix: null, client_id: clientId,
          token_endpoint: tokenEndpoint, expires_at: Date.now() + Number(expiresIn) * 1000,
        });
      }
      return { rows: [], rowCount: 1 };
    }
    if (statement.includes("select endpoint_url, access_token")) {
      const [accountId, teamId] = values;
      const row = state.connections.get(accountId);
      return { rows: row?.team_id === teamId ? [{ ...row }] : [], rowCount: row?.team_id === teamId ? 1 : 0 };
    }
    if (statement.startsWith("delete from custom_mcp_connections")) {
      const [accountId, teamId] = values;
      const row = state.connections.get(accountId);
      if (row?.team_id === teamId) state.connections.delete(accountId);
      return { rows: [], rowCount: row?.team_id === teamId ? 1 : 0 };
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

  if (url === "https://example.com/apikey") {
    if (headers.get("x-api-key") !== "private-api-key") {
      return new Response("Unauthorized", { status: 401 });
    }
    if (body.method === "initialize") {
      return Response.json({ jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-03-26" } });
    }
    if (body.method === "tools/list") {
      return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: [{ name: "account_tool", inputSchema: { type: "object" } }] } });
    }
    if (body.method === "tools/call") {
      return Response.json({ jsonrpc: "2.0", id: body.id, result: { content: [{ type: "text", text: "account-specific result" }] } });
    }
    return new Response(null, { status: 202 });
  }

  if (url === "https://example.com/oauth") {
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
  await startCustomMcpConnection({
    accountId: "member-a",
    teamId: "team-a",
    endpointUrl: "https://example.com/apikey",
    redirectUri: "https://robotics.test/api/assistant/custom-mcp/callback",
    apiKey: "private-api-key",
    apiKeyHeader: "X-API-Key",
  });

  const stored = state.connections.get("member-a");
  assert.equal(stored.team_id, "team-a");
  assert.equal(JSON.stringify(stored.api_key).includes("private-api-key"), false, "API keys are encrypted at rest");
  assert.deepEqual(await customMcpStatus("member-a", "team-a"), {
    connected: true,
    endpointUrl: "https://example.com/apikey",
  });
  assert.deepEqual(await customMcpStatus("member-b", "team-a"), { connected: false, endpointUrl: "" });
  assert.deepEqual(await customMcpStatus("member-a", "team-b"), { connected: false, endpointUrl: "" });

  const memberTools = await listCustomMcpTools("member-a", "team-a");
  assert.deepEqual(memberTools.tools.map((tool) => tool.function.name), ["custom_mcp_account_tool"]);
  assert.deepEqual((await listCustomMcpTools("member-b", "team-a")).tools, []);
  assert.deepEqual((await listCustomMcpTools("member-a", "team-b")).tools, []);
  assert.equal(await callCustomMcpTool("member-a", "team-a", "account_tool", {}), "account-specific result");
  await assert.rejects(callCustomMcpTool("member-b", "team-a", "account_tool", {}), /not connected/);
  await assert.rejects(callCustomMcpTool("member-a", "team-b", "account_tool", {}), /not connected/);

  await disconnectCustomMcp("member-a", "team-b");
  assert.equal((await customMcpStatus("member-a", "team-a")).connected, true);
  await disconnectCustomMcp("member-a", "team-a");
  assert.equal((await customMcpStatus("member-a", "team-a")).connected, false);
});

test("custom MCP OAuth state keeps the initiating account and team as callback owner", async () => {
  state.connections.clear();
  state.oauthStates.clear();
  const result = await startCustomMcpConnection({
    accountId: "member-oauth",
    teamId: "team-oauth",
    endpointUrl: "https://example.com/oauth",
    redirectUri: "https://robotics.test/api/assistant/custom-mcp/callback",
  });
  assert.ok(result.authorizationUrl);
  const authorizationUrl = new URL(result.authorizationUrl);
  const returnedState = authorizationUrl.searchParams.get("state");
  assert.ok(returnedState);

  const completed = await finishCustomMcpAuthorization({ state: returnedState, code: "oauth-code" });
  assert.deepEqual(completed, {
    accountId: "member-oauth",
    teamId: "team-oauth",
    endpointUrl: "https://example.com/oauth",
    toolCount: 1,
  });
  assert.equal(state.connections.get("member-oauth").team_id, "team-oauth");
  assert.equal(JSON.stringify(state.connections.get("member-oauth").access_token).includes("oauth-private-token"), false);
  assert.deepEqual(await customMcpStatus("other-member", "team-oauth"), { connected: false, endpointUrl: "" });
  await assert.rejects(finishCustomMcpAuthorization({ state: returnedState, code: "replay" }), /expired or was already used/);
});
