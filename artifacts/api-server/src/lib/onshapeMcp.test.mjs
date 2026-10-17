import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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

process.env.SESSION_SECRET = "onshape-test-session-secret-with-at-least-32-characters";

const state = {
  oauthStates: new Map(),
  connections: new Map(),
  requests: [],
  tokenResponse: null,
  databaseQueries: [],
  nextClientId: 0,
  onRefreshWrite: null,
  onRefreshResponse: null,
  mcpStatus: 200,
};

function resetState() {
  state.oauthStates.clear();
  state.connections.clear();
  state.requests.length = 0;
  state.tokenResponse = null;
  state.databaseQueries.length = 0;
  state.nextClientId = 0;
  state.onRefreshWrite = null;
  state.onRefreshResponse = null;
  state.mcpStatus = 200;
}

function parseJson(value) {
  return typeof value === "string" ? JSON.parse(value) : value;
}

const pool = {
  async query(statement, values = []) {
    state.databaseQueries.push({ statement, values });
    if (statement.includes("delete from onshape_mcp_oauth_states where created_at <")) {
      return { rows: [], rowCount: 0 };
    }
    if (statement.includes("insert into onshape_mcp_oauth_states")) {
      const [id, stateHash, accountId, teamId, clientId, redirectUri, codeVerifier, returnOrigin] = values;
      state.oauthStates.set(stateHash, {
        id,
        account_id: accountId,
        team_id: teamId,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: parseJson(codeVerifier),
        return_origin: returnOrigin,
        created_at: Date.now(),
      });
      return { rows: [], rowCount: 1 };
    }
    if (statement.includes("delete from onshape_mcp_oauth_states") && statement.includes("returning")) {
      const [stateHash] = values;
      const row = state.oauthStates.get(stateHash);
      if (!row || row.created_at <= Date.now() - 15 * 60 * 1000) {
        return { rows: [], rowCount: 0 };
      }
      state.oauthStates.delete(stateHash);
      return { rows: [row], rowCount: 1 };
    }
    if (statement.includes("insert into onshape_mcp_connections")) {
      const [accountId, teamId, clientId, accessToken, refreshToken, expiresIn, scopes] = values;
      state.connections.set(accountId, {
        account_id: accountId,
        team_id: teamId,
        client_id: clientId,
        access_token: parseJson(accessToken),
        refresh_token: refreshToken ? parseJson(refreshToken) : null,
        expires_at: Date.now() + Number(expiresIn) * 1000,
        scopes,
      });
      return { rows: [], rowCount: 1 };
    }
    if (statement.includes("select account_id, client_id, access_token, refresh_token, expires_at")) {
      const [accountId, teamId] = values;
      const connection = state.connections.get(accountId);
      return {
        rows: connection && (teamId == null || connection.team_id === teamId) ? [{ ...connection }] : [],
        rowCount: connection && (teamId == null || connection.team_id === teamId) ? 1 : 0,
      };
    }
    if (statement.startsWith("update onshape_mcp_connections")) {
      const [accountId, accessToken, refreshToken, expiresIn, teamId] = values;
      const connection = state.connections.get(accountId);
      if (!connection || connection.team_id !== teamId) return { rows: [], rowCount: 0 };
      connection.access_token = parseJson(accessToken);
      connection.refresh_token = parseJson(refreshToken);
      connection.expires_at = Date.now() + Number(expiresIn) * 1000;
      state.onRefreshWrite?.(statement, values, connection);
      return { rows: [{ account_id: accountId }], rowCount: 1 };
    }
    if (statement.startsWith("delete from onshape_mcp_connections")) {
      const [accountId, teamId] = values;
      const connection = state.connections.get(accountId);
      if (!connection || connection.team_id !== teamId) return { rows: [], rowCount: 0 };
      state.connections.delete(accountId);
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Unexpected Onshape test query: ${statement}`);
  },
};

mock.module("@workspace/db", { namedExports: { pool } });

const [{ beginOnshapeAuthorization, finishOnshapeAuthorization, listOnshapeMcpTools, callOnshapeMcpTool, disconnectOnshape, connectionScopeForAccount }] =
  await Promise.all([import("./onshapeMcp.ts")]);

let fetchHandler;
mock.method(globalThis, "fetch", async (input, init) => fetchHandler(input, init));
test.beforeEach(() => {
  resetState();
  fetchHandler = async (input, init = {}) => {
    const url = String(input);
    const request = { url, init };
    state.requests.push(request);
    if (url === "https://mcp-auth.labs.onshape.app/.well-known/oauth-authorization-server") {
      return Response.json({
        authorization_endpoint: "https://onshape.test/authorize",
        token_endpoint: "https://onshape.test/token",
        registration_endpoint: "https://onshape.test/register",
        revocation_endpoint: "https://onshape.test/revoke",
      });
    }
    if (url === "https://onshape.test/register") {
      state.nextClientId += 1;
      return Response.json({ client_id: `client-${state.nextClientId}` }, { status: 201 });
    }
    if (url === "https://onshape.test/token") {
      const body = new URLSearchParams(init.body);
      if (body.get("grant_type") === "refresh_token") {
        state.onRefreshResponse?.();
        return Response.json(state.tokenResponse ?? {
          access_token: "refreshed-access",
          refresh_token: "refreshed-refresh",
          expires_in: 3600,
        }, state.tokenResponse?.error ? { status: 400 } : {});
      }
      state.requests[state.requests.length - 1].tokenRequest = Object.fromEntries(body);
      return Response.json(state.tokenResponse ?? {
        access_token: "issued-access",
        refresh_token: "issued-refresh",
        expires_in: 3600,
        scope: "OAuth2Read OAuth2Write",
      });
    }
    if (url === "https://onshape.test/revoke") {
      state.requests[state.requests.length - 1].revocationBody = Object.fromEntries(new URLSearchParams(init.body));
      return new Response("", { status: 200 });
    }
    if (url === "https://fs-mcp.labs.onshape.app/mcp") {
      const payload = JSON.parse(init.body);
      const token = new Headers(init.headers).get("Authorization")?.replace(/^Bearer /, "");
      request.token = token;
      request.payload = payload;
      if (payload.method === "initialize") {
        return new Response(JSON.stringify({ result: {} }), {
          status: state.mcpStatus,
          headers: { "mcp-session-id": `session-${token}` },
        });
      }
      if (payload.method === "notifications/initialized") return new Response("", { status: 202 });
      if (payload.method === "tools/list") {
        const toolName = token.includes("alpha") ? "alpha_tool" : token.includes("beta") ? "beta_tool" : "issued_tool";
        return Response.json({ result: { tools: [{ name: toolName, description: `${token} tool`, inputSchema: { type: "object" } }] } });
      }
      if (payload.method === "tools/call") {
        return Response.json(
          { result: { content: [{ type: "text", text: `${token}:${payload.params.name}` }] } },
          { status: state.mcpStatus },
        );
      }
    }
    throw new Error(`Unexpected Onshape HTTP request: ${url}`);
  };
});
test.after(() => {
  mock.restoreAll();
});

async function startAuthorization(accountId, teamId, tokenPrefix) {
  state.tokenResponse = {
    access_token: `${tokenPrefix}-access`,
    refresh_token: `${tokenPrefix}-refresh`,
    expires_in: 3600,
    scope: "OAuth2Read OAuth2Write",
  };
  const { authorizationUrl } = await beginOnshapeAuthorization({
    accountId,
    teamId,
    redirectUri: "https://robotics.test/api/onshape-mcp/callback",
    returnOrigin: "https://robotics.test",
  });
  const authorization = new URL(authorizationUrl);
  const tokenState = authorization.searchParams.get("state");
  assert.ok(tokenState);
  return { tokenState, authorization };
}

async function connect(accountId, teamId, tokenPrefix) {
  const authorization = await startAuthorization(accountId, teamId, tokenPrefix);
  await finishOnshapeAuthorization({ state: authorization.tokenState, code: `${tokenPrefix}-code` });
  return authorization;
}

test("OAuth callback state is hashed, encrypted, one-time, and expires after 15 minutes", async () => {
  const { tokenState, authorization } = await startAuthorization("interviewer-a", "team-a", "alpha");
  const stateHash = createHash("sha256").update(tokenState).digest("hex");
  const storedState = state.oauthStates.get(stateHash);
  assert.ok(storedState, "only the state hash is stored");
  assert.equal(JSON.stringify(storedState).includes(tokenState), false);
  assert.equal(storedState.code_verifier.ciphertext.includes(authorization.searchParams.get("code_challenge")), false);
  assert.equal(authorization.searchParams.get("code_challenge_method"), "S256");

  const result = await finishOnshapeAuthorization({ state: tokenState, code: "one-time-code" });
  assert.deepEqual(result, {
    accountId: "interviewer-a",
    teamId: "team-a",
    returnOrigin: "https://robotics.test",
  });
  const inserted = state.connections.get("interviewer-a");
  assert.equal(inserted.team_id, "team-a");
  assert.equal(JSON.stringify(inserted.access_token).includes("alpha-access"), false);
  assert.equal(JSON.stringify(inserted.refresh_token).includes("alpha-refresh"), false);
  const tokenRequest = state.requests.find((request) => request.tokenRequest)?.tokenRequest;
  assert.equal(tokenRequest.code_verifier?.length > 20, true);
  assert.equal(
    createHash("sha256").update(tokenRequest.code_verifier).digest("base64url"),
    authorization.searchParams.get("code_challenge"),
  );
  await assert.rejects(
    finishOnshapeAuthorization({ state: tokenState, code: "replayed-code" }),
    /expired or was already used/,
  );
  assert.equal(state.requests.filter((request) => request.url === "https://onshape.test/token").length, 1);

  const { tokenState: expiredState } = await startAuthorization("interviewer-b", "team-a", "beta");
  const expiredHash = createHash("sha256").update(expiredState).digest("hex");
  state.oauthStates.get(expiredHash).created_at = Date.now() - 16 * 60 * 1000;
  await assert.rejects(
    finishOnshapeAuthorization({ state: expiredState, code: "expired-code" }),
    /expired or was already used/,
  );
  assert.equal(state.connections.has("interviewer-b"), false);
});

test("tool discovery and execution use only the requesting interviewer's connection in the requested team", async () => {
  await connect("interviewer-a", "team-a", "alpha");
  await connect("interviewer-b", "team-a", "beta");

  const alpha = await listOnshapeMcpTools("interviewer-a", "team-a");
  const beta = await listOnshapeMcpTools("interviewer-b", "team-a");
  assert.deepEqual(alpha.tools.map((tool) => tool.function.name), ["onshape_alpha_tool"]);
  assert.deepEqual(beta.tools.map((tool) => tool.function.name), ["onshape_beta_tool"]);
  assert.equal(alpha.tools[0].function.description, "alpha-access tool");

  const alphaResult = await callOnshapeMcpTool("interviewer-a", "team-a", "alpha_tool", { document: "private" });
  const betaResult = await callOnshapeMcpTool("interviewer-b", "team-a", "beta_tool", {});
  assert.equal(alphaResult, "alpha-access:alpha_tool");
  assert.equal(betaResult, "beta-access:beta_tool");
  const wrongAccount = await listOnshapeMcpTools("interviewer-c", "team-a");
  const wrongTeam = await listOnshapeMcpTools("interviewer-a", "team-b");
  assert.deepEqual(wrongAccount.tools, []);
  assert.deepEqual(wrongTeam.tools, []);
  await assert.rejects(callOnshapeMcpTool("interviewer-a", "team-b", "alpha_tool", {}), /not connected/);
  assert.equal(state.requests.filter((request) => request.url === "https://fs-mcp.labs.onshape.app/mcp" && request.token === "alpha-access").length, 6);
  assert.equal(state.requests.some((request) => request.token === "beta-access" && request.payload?.params?.name === "alpha_tool"), false);
});

test("refresh is team-scoped, replaces encrypted tokens, and drops a connection on provider rejection", async () => {
  await connect("interviewer-a", "team-a", "alpha");
  const connection = state.connections.get("interviewer-a");
  connection.expires_at = Date.now() - 1;
  state.tokenResponse = {
    access_token: "alpha-refreshed-access",
    refresh_token: "alpha-rotated-refresh",
    expires_in: 1800,
  };
  let refreshWrite;
  state.onRefreshWrite = (statement, values, updated) => { refreshWrite = { statement, values, updated }; };

  const discovered = await listOnshapeMcpTools("interviewer-a", "team-a");
  assert.deepEqual(discovered.tools.map((tool) => tool.function.name), ["onshape_alpha_tool"]);
  const refreshHttp = state.requests.find((request) => request.url === "https://onshape.test/token" &&
    new URLSearchParams(request.init.body).get("grant_type") === "refresh_token");
  assert.equal(new URLSearchParams(refreshHttp.init.body).get("refresh_token"), "alpha-refresh");
  assert.match(refreshWrite.statement, /where account_id = \$1 and team_id = \$5/);
  assert.deepEqual(refreshWrite.values.slice(0, 1), ["interviewer-a"]);
  assert.equal(refreshWrite.values[4], "team-a");
  assert.equal(JSON.stringify(refreshWrite.updated.access_token).includes("alpha-refreshed-access"), false);
  assert.equal(JSON.stringify(refreshWrite.updated.refresh_token).includes("alpha-rotated-refresh"), false);
  assert.equal(state.requests.some((request) => request.token === "alpha-refreshed-access"), true);

  const failedConnection = state.connections.get("interviewer-a");
  failedConnection.expires_at = Date.now() - 1;
  state.tokenResponse = { error: "invalid_grant" };
  assert.deepEqual((await listOnshapeMcpTools("interviewer-a", "team-a")).tools, []);
  assert.equal(await connectionScopeForAccount("interviewer-a", "team-a"), false);
});

test("removes the scoped connection when Onshape rejects MCP authorization", async () => {
  await connect("interviewer-a", "team-a", "alpha");
  await connect("interviewer-b", "team-a", "beta");
  state.mcpStatus = 401;

  await assert.rejects(listOnshapeMcpTools("interviewer-a", "team-a"), /authorization expired/i);
  assert.equal(await connectionScopeForAccount("interviewer-a", "team-a"), false);
  assert.equal(await connectionScopeForAccount("interviewer-b", "team-a"), true);
  await assert.rejects(callOnshapeMcpTool("interviewer-b", "team-a", "beta_tool", {}), /authorization expired/i);
  assert.equal(await connectionScopeForAccount("interviewer-b", "team-a"), false);
});

test("does not use a refreshed token if the connection changes teams during refresh", async () => {
  await connect("interviewer-a", "team-a", "alpha");
  state.connections.get("interviewer-a").expires_at = Date.now() - 1;
  state.tokenResponse = {
    access_token: "must-not-be-used",
    refresh_token: "rotated-refresh",
    expires_in: 1800,
  };
  state.onRefreshResponse = () => {
    state.connections.get("interviewer-a").team_id = "team-b";
  };

  assert.deepEqual((await listOnshapeMcpTools("interviewer-a", "team-a")).tools, []);
  assert.equal(
    state.requests.some((request) => request.url === "https://fs-mcp.labs.onshape.app/mcp"),
    false,
    "MCP discovery must not proceed after the scoped refresh update affects no row",
  );
  assert.equal(await connectionScopeForAccount("interviewer-a", "team-b"), true);
  const failedScopedWrite = state.databaseQueries.find(({ statement }) =>
    statement.startsWith("update onshape_mcp_connections"));
  assert.match(failedScopedWrite.statement, /where account_id = \$1 and team_id = \$5/);
});

test("disconnect revokes and removes only the current account/team connection", async () => {
  await connect("interviewer-a", "team-a", "alpha");
  await connect("interviewer-b", "team-a", "beta");

  await disconnectOnshape("interviewer-a", "team-b");
  assert.equal(await connectionScopeForAccount("interviewer-a", "team-a"), true);
  assert.equal(state.requests.some((request) => request.url === "https://onshape.test/revoke"), false);

  await disconnectOnshape("interviewer-a", "team-a");
  assert.equal(await connectionScopeForAccount("interviewer-a", "team-a"), false);
  assert.equal(await connectionScopeForAccount("interviewer-b", "team-a"), true);
  const revocation = state.requests.find((request) => request.url === "https://onshape.test/revoke");
  assert.equal(revocation.revocationBody.token, "alpha-refresh");
  assert.equal(state.connections.has("interviewer-a"), false);
  assert.equal(state.connections.has("interviewer-b"), true);
});
