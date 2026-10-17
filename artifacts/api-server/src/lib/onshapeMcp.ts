import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { pool } from "@workspace/db";

const MCP_URL = "https://fs-mcp.labs.onshape.app/mcp";
const AUTH_URL = "https://mcp-auth.labs.onshape.app";
const PROTECTED_RESOURCE_METADATA = "https://fs-mcp.labs.onshape.app/.well-known/oauth-protected-resource";
const OAUTH_METADATA_URL = `${AUTH_URL}/.well-known/oauth-authorization-server`;
const REQUESTED_SCOPES = ["OAuth2Read", "OAuth2Write"];
const MAX_TOOL_RESULT_CHARS = 18_000;
const FETCH_TIMEOUT_MS = 30_000;

type OAuthMetadata = {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  revocation_endpoint?: string;
};

type EncryptedValue = {
  ciphertext: string;
  iv: string;
  tag: string;
};

type ConnectionRow = {
  account_id: string;
  client_id: string;
  access_token: EncryptedValue;
  refresh_token: EncryptedValue | null;
  expires_at: Date | string;
};

export type OnshapeMcpTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OnshapeToolBinding = {
  publicName: string;
  serverName: string;
};

type McpTool = {
  name?: unknown;
  description?: unknown;
  inputSchema?: unknown;
};

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("Onshape connection encryption is unavailable because SESSION_SECRET is not configured.");
  }
  return createHash("sha256").update(`robotics-onshape-mcp-v1:${secret}`).digest();
}

function encrypt(value: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(value: EncryptedValue): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(value.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function oauthMetadata(): Promise<OAuthMetadata> {
  const response = await fetch(OAUTH_METADATA_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Onshape authorization metadata returned ${response.status}.`);
  const metadata = await response.json() as Partial<OAuthMetadata>;
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.registration_endpoint) {
    throw new Error("Onshape authorization metadata is incomplete.");
  }
  return metadata as OAuthMetadata;
}

async function registerClient(redirectUri: string): Promise<string> {
  const metadata = await oauthMetadata();
  const response = await fetch(metadata.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Robotics Interview Assistant",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error_description?: unknown; error?: unknown } | null;
    const detail = typeof body?.error_description === "string"
      ? body.error_description
      : typeof body?.error === "string"
        ? body.error
        : "";
    throw new Error(`Onshape client registration returned ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}.`);
  }
  const client = await response.json() as { client_id?: unknown };
  if (typeof client.client_id !== "string" || !client.client_id) {
    throw new Error("Onshape did not return a client id.");
  }
  return client.client_id;
}

export async function beginOnshapeAuthorization(input: {
  accountId: string;
  teamId: string;
  redirectUri: string;
  returnOrigin: string;
}): Promise<{ authorizationUrl: string }> {
  const metadata = await oauthMetadata();
  const clientId = await registerClient(input.redirectUri);
  await pool.query(`delete from onshape_mcp_oauth_states where created_at < now() - interval '15 minutes'`);
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  await pool.query(
    `insert into onshape_mcp_oauth_states
      (id, state_hash, account_id, team_id, client_id, redirect_uri, code_verifier, return_origin, created_at)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now())`,
    [
      randomUUID(),
      createHash("sha256").update(state).digest("hex"),
      input.accountId,
      input.teamId,
      clientId,
      input.redirectUri,
      JSON.stringify(encrypt(verifier)),
      input.returnOrigin,
    ],
  );
  const authorization = new URL(metadata.authorization_endpoint);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("client_id", clientId);
  authorization.searchParams.set("redirect_uri", input.redirectUri);
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("scope", REQUESTED_SCOPES.join(" "));
  authorization.searchParams.set("resource", "https://fs-mcp.labs.onshape.app");
  return { authorizationUrl: authorization.toString() };
}

export async function finishOnshapeAuthorization(input: {
  state: string;
  code: string;
}): Promise<{ accountId: string; teamId: string; returnOrigin: string }> {
  const stateHash = createHash("sha256").update(input.state).digest("hex");
  const result = await pool.query(
    `delete from onshape_mcp_oauth_states
      where state_hash = $1 and created_at > now() - interval '15 minutes'
      returning account_id, team_id, client_id, redirect_uri, code_verifier, return_origin`,
    [stateHash],
  );
  const row = result.rows[0] as {
    account_id: string;
    team_id: string;
    client_id: string;
    redirect_uri: string;
    code_verifier: EncryptedValue | string;
    return_origin: string;
  } | undefined;
  if (!row) throw new Error("The Onshape sign-in request expired or was already used.");

  const metadata = await oauthMetadata();
  const verifier = typeof row.code_verifier === "string"
    ? decrypt(safeJsonParse<EncryptedValue>(row.code_verifier, { ciphertext: "", iv: "", tag: "" }))
    : decrypt(row.code_verifier);
  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      client_id: row.client_id,
      redirect_uri: row.redirect_uri,
      code_verifier: verifier,
      resource: "https://fs-mcp.labs.onshape.app",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const token = await response.json() as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
    scope?: unknown;
  };
  if (!response.ok || typeof token.access_token !== "string") {
    throw new Error("Onshape authorization could not be completed. Confirm you have subscribed to the FeatureScript MCP app.");
  }
  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : 3600;
  await pool.query(
    `insert into onshape_mcp_connections
      (account_id, team_id, client_id, access_token, refresh_token, expires_at, scopes, updated_at)
     values ($1, $2, $3, $4::jsonb, $5::jsonb, now() + ($6 * interval '1 second'), $7, now())
     on conflict (account_id) do update set
       team_id = excluded.team_id,
       client_id = excluded.client_id,
       access_token = excluded.access_token,
       refresh_token = excluded.refresh_token,
       expires_at = excluded.expires_at,
       scopes = excluded.scopes,
       updated_at = now()`,
    [
      row.account_id,
      row.team_id,
      row.client_id,
      JSON.stringify(encrypt(token.access_token)),
      typeof token.refresh_token === "string" ? JSON.stringify(encrypt(token.refresh_token)) : null,
      Math.max(60, expiresIn),
      typeof token.scope === "string" ? token.scope : REQUESTED_SCOPES.join(" "),
    ],
  );
  return { accountId: row.account_id, teamId: row.team_id, returnOrigin: row.return_origin };
}

async function getConnection(accountId: string, teamId?: string): Promise<ConnectionRow | undefined> {
  const result = await pool.query(
    `select account_id, client_id, access_token, refresh_token, expires_at
       from onshape_mcp_connections
      where account_id = $1 and ($2::text is null or team_id = $2)`,
    [accountId, teamId ?? null],
  );
  return result.rows[0] as ConnectionRow | undefined;
}

async function getAccessToken(accountId: string, teamId: string): Promise<string | undefined> {
  const connection = await getConnection(accountId, teamId);
  if (!connection) return undefined;
  const expiresAt = new Date(connection.expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60_000) {
    return decrypt(connection.access_token);
  }
  if (!connection.refresh_token) {
    await pool.query(`delete from onshape_mcp_connections where account_id = $1 and team_id = $2`, [accountId, teamId]);
    return undefined;
  }
  const metadata = await oauthMetadata();
  const response = await fetch(metadata.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: connection.client_id,
      refresh_token: decrypt(connection.refresh_token),
      resource: "https://fs-mcp.labs.onshape.app",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const token = await response.json() as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  };
  if (!response.ok || typeof token.access_token !== "string") {
    await pool.query(`delete from onshape_mcp_connections where account_id = $1 and team_id = $2`, [accountId, teamId]);
    return undefined;
  }
  const expiresIn = typeof token.expires_in === "number" ? token.expires_in : 3600;
  await pool.query(
    `update onshape_mcp_connections
        set access_token = $2::jsonb,
            refresh_token = $3::jsonb,
            expires_at = now() + ($4 * interval '1 second'),
            updated_at = now()
      where account_id = $1`,
    [
      accountId,
      JSON.stringify(encrypt(token.access_token)),
      typeof token.refresh_token === "string" ? JSON.stringify(encrypt(token.refresh_token)) : JSON.stringify(connection.refresh_token),
      Math.max(60, expiresIn),
    ],
  );
  return token.access_token;
}

async function mcpRequest(
  accessToken: string,
  sessionId: string | undefined,
  body: Record<string, unknown>,
): Promise<{ response: Response; payload: Record<string, unknown> }> {
  const response = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      Authorization: `Bearer ${accessToken}`,
      ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const raw = await response.text();
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const dataLine = raw.split(/\r?\n/).find((line) => line.startsWith("data:"));
    if (dataLine) {
      try { payload = JSON.parse(dataLine.slice(5).trim()) as Record<string, unknown>; } catch { /* checked below */ }
    }
  }
  return { response, payload };
}

async function withMcpSession<T>(accessToken: string, action: (session: string | undefined) => Promise<T>): Promise<T> {
  const { response, payload } = await mcpRequest(accessToken, undefined, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "robotics-interview-assistant", version: "1.0.0" },
    },
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Onshape authorization expired. Reconnect Onshape in the assistant settings.");
    throw new Error(`Onshape MCP initialization returned ${response.status}.`);
  }
  const session = response.headers.get("mcp-session-id") ?? undefined;
  await mcpRequest(accessToken, session, { jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => undefined);
  return action(session);
}

export async function listOnshapeMcpTools(accountId: string, teamId: string): Promise<{
  tools: OnshapeMcpTool[];
  bindings: Map<string, OnshapeToolBinding>;
}> {
  const accessToken = await getAccessToken(accountId, teamId);
  if (!accessToken) return { tools: [], bindings: new Map() };
  return withMcpSession(accessToken, async (session) => {
    const { response, payload } = await mcpRequest(accessToken, session, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });
    if (!response.ok) throw new Error(`Onshape MCP tools/list returned ${response.status}.`);
    const result = payload.result as { tools?: McpTool[] } | undefined;
    const bindings = new Map<string, OnshapeToolBinding>();
    const tools: OnshapeMcpTool[] = [];
    for (const tool of result?.tools ?? []) {
      if (typeof tool.name !== "string" || !/^[a-zA-Z0-9_-]{1,55}$/.test(tool.name)) continue;
      const publicName = `onshape_${tool.name}`;
      if (bindings.has(publicName)) continue;
      const parameters = tool.inputSchema && typeof tool.inputSchema === "object"
        ? tool.inputSchema as Record<string, unknown>
        : { type: "object", properties: {} };
      bindings.set(publicName, { publicName, serverName: tool.name });
      tools.push({
        type: "function",
        function: {
          name: publicName,
          description: typeof tool.description === "string" ? tool.description.slice(0, 1000) : `Call Onshape MCP tool ${tool.name}.`,
          parameters,
        },
      });
    }
    return { tools, bindings };
  });
}

export async function callOnshapeMcpTool(
  accountId: string,
  teamId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  const accessToken = await getAccessToken(accountId, teamId);
  if (!accessToken) throw new Error("Onshape is not connected. Connect Onshape in the assistant first.");
  return withMcpSession(accessToken, async (session) => {
    const { response, payload } = await mcpRequest(accessToken, session, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error("Onshape authorization expired. Reconnect Onshape in the assistant settings.");
      throw new Error(`Onshape MCP tool call returned ${response.status}.`);
    }
    const result = payload.result as { content?: { type?: string; text?: string }[]; isError?: boolean } | undefined;
    if (!result) throw new Error("Onshape MCP returned an invalid tool response.");
    const text = (result.content ?? []).map((entry) => entry.text ?? "").filter(Boolean).join("\n");
    if (result.isError) throw new Error(text.slice(0, MAX_TOOL_RESULT_CHARS) || "Onshape MCP tool failed.");
    return text.slice(0, MAX_TOOL_RESULT_CHARS);
  });
}

export async function disconnectOnshape(accountId: string, teamId: string): Promise<void> {
  const connection = await getConnection(accountId, teamId);
  if (connection?.refresh_token) {
    try {
      const metadata = await oauthMetadata();
      if (metadata.revocation_endpoint) {
        await fetch(metadata.revocation_endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: decrypt(connection.refresh_token), client_id: connection.client_id }),
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        }).catch(() => undefined);
      }
    } catch {
      // Remove the local connection even if provider revocation is unavailable.
    }
  }
  await pool.query(`delete from onshape_mcp_connections where account_id = $1 and team_id = $2`, [accountId, teamId]);
}

export async function connectionScopeForAccount(accountId: string, teamId: string): Promise<boolean> {
  return Boolean(await getConnection(accountId, teamId));
}
