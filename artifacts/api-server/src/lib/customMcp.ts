import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { pool } from "@workspace/db";

const FETCH_TIMEOUT_MS = 20_000;
const MAX_RESULT_CHARS = 18_000;
const PROTOCOL_VERSION = "2025-03-26";
type EncryptedValue = { ciphertext: string; iv: string; tag: string };
type OAuthMetadata = {
  issuer?: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
};
class McpAuthenticationRequiredError extends Error {
  constructor(readonly resourceMetadataUrl?: string, readonly challenge = "") {
    super("This MCP endpoint requires sign-in.");
  }
}
type RpcResult = { response: Response; payload: McpPayload };
type McpTool = { name?: unknown; description?: unknown; inputSchema?: unknown };
type McpPayload = Record<string, unknown>;

export function quotedParameter(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = header.match(new RegExp(`(?:^|,)\\s*${escaped}="([^"]+)"`, "i"));
  return match?.[1];
}

export function parseRpcPayload(raw: string, expectedId?: string | number): McpPayload {
  try {
    return JSON.parse(raw) as McpPayload;
  } catch {
    const events = raw.split(/\r?\n\r?\n/);
    const payloads: McpPayload[] = [];
    for (const event of events) {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim()).join("\n");
      if (!data || data === "[DONE]") continue;
      try {
        const value = JSON.parse(data) as McpPayload;
        if (value && typeof value === "object") payloads.push(value);
      } catch { /* Ignore SSE comments and non-JSON events. */ }
    }
    const matching = expectedId === undefined ? undefined : payloads.find((value) => value.id === expectedId);
    return matching ?? payloads.find((value) => value.result !== undefined || value.error !== undefined) ?? {};
  }
}

export function resourceMetadataCandidates(endpoint: string, challengeUrl?: string): string[] {
  if (challengeUrl) return [new URL(challengeUrl, endpoint).toString()];
  const parsed = new URL(endpoint);
  return [
    new URL("/.well-known/oauth-protected-resource", parsed.origin).toString(),
    new URL(`${parsed.pathname.replace(/\/$/, "")}/.well-known/oauth-protected-resource`, parsed.origin).toString(),
  ];
}

export function authorizationMetadataCandidates(issuer: string): string[] {
  const parsed = new URL(issuer);
  const issuerPath = parsed.pathname.replace(/\/$/, "");
  return [
    new URL(`/.well-known/oauth-authorization-server${issuerPath}`, parsed.origin).toString(),
    new URL(`${issuerPath}/.well-known/oauth-authorization-server`, parsed.origin).toString(),
    new URL("/.well-known/oauth-authorization-server", parsed.origin).toString(),
  ];
}

export type CustomMcpTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};
export type CustomMcpToolBinding = { serverName: string };

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("MCP connection encryption is not configured.");
  return createHash("sha256").update(`robotics-custom-mcp-v1:${secret}`).digest();
}

function encrypt(value: string): EncryptedValue {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  return {
    ciphertext: Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(value: EncryptedValue): string {
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(value.iv, "base64"));
  decipher.setAuthTag(Buffer.from(value.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext, "base64")), decipher.final()]).toString("utf8");
}

function ipv4IsPublic(address: string): boolean {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19)));
}

export async function validateCustomMcpEndpoint(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Enter a valid MCP endpoint URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.hash) {
    throw new Error("MCP endpoints must use HTTPS and cannot include credentials or a fragment.");
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".localhost") || url.hostname.endsWith(".local")) {
    throw new Error("Private and local MCP endpoints are not allowed.");
  }
  const ipVersion = isIP(url.hostname);
  if (ipVersion === 4 && !ipv4IsPublic(url.hostname)) throw new Error("Private and local MCP endpoints are not allowed.");
  if (ipVersion === 6 && !url.hostname.toLowerCase().startsWith("2")) {
    throw new Error("Private and local MCP endpoints are not allowed.");
  }
  if (!ipVersion) {
    const addresses = await lookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(({ address, family }) => family === 4 ? !ipv4IsPublic(address) : !address.toLowerCase().startsWith("2"))) {
      throw new Error("The MCP endpoint must resolve only to public addresses.");
    }
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  return url.toString();
}

async function request(
  endpoint: string,
  token: string | undefined,
  session: string | undefined,
  body: McpPayload,
  protocolVersion = PROTOCOL_VERSION,
  extraHeaders?: Record<string, string>,
): Promise<RpcResult> {
  const response = await fetch(endpoint, {
    method: "POST",
    redirect: "error",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(session ? { "Mcp-Session-Id": session } : {}),
      ...(body.method === "initialize" ? {} : { "MCP-Protocol-Version": protocolVersion }),
      ...extraHeaders,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const raw = await response.text();
  const payload = parseRpcPayload(raw, typeof body.id === "string" || typeof body.id === "number" ? body.id : undefined);
  return { response, payload };
}

type McpRequest = (body: McpPayload) => Promise<RpcResult>;

function parseSseEvent(raw: string): { event: string; data: string } {
  let event = "message";
  const data: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  return { event, data: data.join("\n") };
}

class LegacySseReader {
  private buffer = "";
  private readonly decoder = new TextDecoder();
  constructor(private readonly reader: ReadableStreamDefaultReader<Uint8Array>) {}

  async nextEvent(): Promise<{ event: string; data: string }> {
    while (true) {
      const boundary = this.buffer.match(/\r?\n\r?\n/);
      if (boundary && boundary.index !== undefined) {
        const raw = this.buffer.slice(0, boundary.index);
        this.buffer = this.buffer.slice(boundary.index + boundary[0].length);
        const event = parseSseEvent(raw);
        if (event.data || event.event !== "message") return event;
        continue;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("MCP SSE response timed out.")), FETCH_TIMEOUT_MS);
      });
      let chunk;
      try {
        chunk = await Promise.race([this.reader.read(), timeout]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      if (chunk.done) throw new Error("The MCP SSE connection closed unexpectedly.");
      this.buffer += this.decoder.decode(chunk.value, { stream: true });
    }
  }

  async close(): Promise<void> {
    await this.reader.cancel().catch(() => undefined);
  }
}

async function legacySseSession<T>(
  endpoint: string,
  token: string | undefined,
  extraHeaders: Record<string, string> | undefined,
  action: (send: McpRequest) => Promise<T>,
): Promise<T | null> {
  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      redirect: "error",
      headers: { Accept: "text/event-stream", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extraHeaders },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(connectTimer);
  }
  if (response.status === 401) {
    throw new McpAuthenticationRequiredError(
      quotedParameter(response.headers.get("www-authenticate"), "resource_metadata"),
      response.headers.get("www-authenticate") ?? "",
    );
  }
  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }
  const stream = new LegacySseReader(response.body.getReader());
  try {
    const endpointEvent = await stream.nextEvent();
    if (endpointEvent.event !== "endpoint" || !endpointEvent.data) return null;
    const postUrl = new URL(endpointEvent.data, endpoint);
    if (postUrl.origin !== new URL(endpoint).origin) {
      throw new Error("The MCP SSE message endpoint must use the same origin.");
    }
    const sessionId = response.headers.get("mcp-session-id");
    const send: McpRequest = async (body) => {
      const posted = await fetch(postUrl, {
        method: "POST",
        redirect: "error",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}),
          ...extraHeaders,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!posted.ok) return { response: posted, payload: {} };
      const raw = await posted.text();
      if (raw.trim()) {
        const directPayload = parseRpcPayload(raw, body.id as string | number | undefined);
        if (directPayload.id !== undefined || body.id === undefined) return { response: posted, payload: directPayload };
      }
      if (body.id === undefined) return { response: posted, payload: {} };
      const event = await stream.nextEvent();
      return { response: posted, payload: parseRpcPayload(`data: ${event.data}`, body.id as string | number | undefined) };
    };
    const initialized = await send({
      jsonrpc: "2.0", id: 1, method: "initialize",
      params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "robotics-assistant", version: "1.0.0" } },
    });
    if (!initialized.response.ok) {
      if (initialized.response.status === 401) {
        throw new McpAuthenticationRequiredError(
          quotedParameter(initialized.response.headers.get("www-authenticate"), "resource_metadata"),
          initialized.response.headers.get("www-authenticate") ?? "",
        );
      }
      return null;
    }
    if (initialized.payload.error) throw new Error("The MCP endpoint rejected initialization.");
    await send({ jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => undefined);
    return await action(send);
  } finally {
    await stream.close();
  }
}

export async function session<T>(
  endpoint: string, token: string | undefined, action: (send: McpRequest) => Promise<T>,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const { response, payload } = await request(endpoint, token, undefined, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "robotics-assistant", version: "1.0.0" } },
  }, PROTOCOL_VERSION, extraHeaders);
  if (!response.ok) {
    if (response.status === 401) {
      throw new McpAuthenticationRequiredError(
        quotedParameter(response.headers.get("www-authenticate"), "resource_metadata"),
        response.headers.get("www-authenticate") ?? "",
      );
    }
    if ([400, 404, 405, 406].includes(response.status)) {
      const legacy = await legacySseSession(endpoint, token, extraHeaders, action);
      if (legacy !== null) return legacy;
    }
    throw new Error(`MCP initialization returned ${response.status}.`);
  }
  if (payload.error) throw new Error("The MCP endpoint rejected initialization.");
  const sessionId = response.headers.get("mcp-session-id") ?? undefined;
  const result = payload.result as { protocolVersion?: unknown } | undefined;
  const protocolVersion = typeof result?.protocolVersion === "string" ? result.protocolVersion : PROTOCOL_VERSION;
  await request(endpoint, token, sessionId, { jsonrpc: "2.0", method: "notifications/initialized" }, protocolVersion, extraHeaders).catch(() => undefined);
  return action((body) => request(endpoint, token, sessionId, body, protocolVersion, extraHeaders));
}

async function listAt(endpoint: string, token: string | undefined, extraHeaders?: Record<string, string>) {
  return session(endpoint, token, async (send) => {
    const { response, payload } = await send({
      jsonrpc: "2.0", id: 2, method: "tools/list", params: {},
    });
    if (!response.ok) throw new Error(`MCP tools/list returned ${response.status}.`);
    const result = payload.result as { tools?: McpTool[] } | undefined;
    if (!result || !Array.isArray(result.tools)) throw new Error("The endpoint did not return an MCP tools list.");
    return result.tools;
  }, extraHeaders);
}

type ConnectionRow = {
  endpoint_url: string;
  access_token: EncryptedValue | string | null;
  api_key: EncryptedValue | string | null;
  api_key_header: string | null;
  api_key_prefix: string | null;
  refresh_token: EncryptedValue | string | null;
  client_id: string | null;
  token_endpoint: string | null;
  expires_at: Date | string | null;
};
async function connection(accountId: string, teamId: string): Promise<ConnectionRow | undefined> {
  const result = await pool.query(
    `select endpoint_url, access_token, api_key, api_key_header, api_key_prefix, refresh_token, client_id, token_endpoint, expires_at
       from custom_mcp_connections where account_id = $1 and team_id = $2`,
    [accountId, teamId],
  );
  return result.rows[0] as ConnectionRow | undefined;
}

function decryptValue(value: EncryptedValue | string): string {
  return decrypt(typeof value === "string" ? JSON.parse(value) as EncryptedValue : value);
}

async function tokenFor(accountId: string, teamId: string, row: ConnectionRow): Promise<string | undefined> {
  if (!row.access_token) return undefined;
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : Number.POSITIVE_INFINITY;
  if (expiresAt > Date.now() + 60_000) {
    return decryptValue(row.access_token);
  }
  if (!row.refresh_token || !row.client_id || !row.token_endpoint) {
    throw new Error("MCP authorization expired. Reconnect this server in assistant settings.");
  }
  const response = await fetch(row.token_endpoint, {
    method: "POST", redirect: "error",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "refresh_token", client_id: row.client_id, refresh_token: decryptValue(row.refresh_token) }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const token = await response.json() as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
  if (!response.ok || typeof token.access_token !== "string") {
    throw new Error("MCP authorization expired. Reconnect this server in assistant settings.");
  }
  const expiresIn = typeof token.expires_in === "number" ? Math.max(60, token.expires_in) : 3600;
  await pool.query(
    `update custom_mcp_connections set access_token = $3::jsonb, refresh_token = $4::jsonb,
       expires_at = now() + ($5 * interval '1 second'), updated_at = now()
     where account_id = $1 and team_id = $2`,
    [accountId, teamId, JSON.stringify(encrypt(token.access_token)),
      typeof token.refresh_token === "string" ? JSON.stringify(encrypt(token.refresh_token)) : JSON.stringify(row.refresh_token),
      expiresIn],
  );
  return token.access_token;
}

export async function customMcpStatus(accountId: string, teamId: string) {
  const row = await connection(accountId, teamId);
  return row ? { connected: true, endpointUrl: row.endpoint_url } : { connected: false, endpointUrl: "" };
}

export async function startCustomMcpConnection(input: {
  accountId: string; teamId: string; endpointUrl: string; redirectUri: string;
  apiKey?: string; apiKeyHeader?: string; apiKeyPrefix?: string;
}) {
  const endpointUrl = await validateCustomMcpEndpoint(input.endpointUrl.trim());
  const apiKeyHeader = input.apiKeyHeader?.trim() || "X-API-Key";
  const apiKeyPrefix = input.apiKeyPrefix?.trim() || "";
  if (input.apiKey !== undefined && (!input.apiKey.trim() || input.apiKey.length > 8192 ||
      !/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(apiKeyHeader) ||
      /[\r\n]/.test(input.apiKey) || /[\r\n]/.test(apiKeyPrefix))) {
    throw new Error("Enter a valid API key and HTTP header.");
  }
  const apiKeyHeaders = input.apiKey ? {
    [apiKeyHeader]: apiKeyPrefix ? `${apiKeyPrefix} ${input.apiKey}` : input.apiKey,
  } : undefined;
  let requiredMetadataUrl: string | undefined;
  let authChallenge = "";
  try {
    const tools = await listAt(endpointUrl, undefined, apiKeyHeaders);
    await pool.query(
      `insert into custom_mcp_connections (account_id, team_id, endpoint_url, access_token, api_key, api_key_header, api_key_prefix, updated_at)
       values ($1, $2, $3, null, $4::jsonb, $5, $6, now())
       on conflict (account_id) do update set team_id = excluded.team_id, endpoint_url = excluded.endpoint_url,
         access_token = null, api_key = excluded.api_key, api_key_header = excluded.api_key_header,
         api_key_prefix = excluded.api_key_prefix, refresh_token = null, client_id = null, token_endpoint = null, expires_at = null,
         updated_at = now()`,
      [input.accountId, input.teamId, endpointUrl, input.apiKey ? JSON.stringify(encrypt(input.apiKey)) : null,
        input.apiKey ? apiKeyHeader : null, input.apiKey ? apiKeyPrefix : null],
    );
    return { connected: true as const, endpointUrl, toolCount: tools.length };
  } catch (error) {
    if (!(error instanceof McpAuthenticationRequiredError)) throw error;
    if (input.apiKey) throw new Error("The API key was rejected. Check the key, header name, and prefix.");
    requiredMetadataUrl = error.resourceMetadataUrl;
    authChallenge = error.challenge;
  }

  let resource: { authorization_servers?: unknown; resource?: unknown } | undefined;
  for (const candidate of resourceMetadataCandidates(endpointUrl, requiredMetadataUrl)) {
    const metadataUrl = await validateCustomMcpEndpoint(candidate);
    const resourceResponse = await fetch(metadataUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!resourceResponse.ok) continue;
    resource = await resourceResponse.json() as { authorization_servers?: unknown; resource?: unknown };
    break;
  }
  if (!resource) {
    const bearer = /^Bearer\b/i.test(authChallenge);
    return {
      connected: false as const,
      apiKeyRequired: true as const,
      endpointUrl,
      apiKeyHeader: bearer ? "Authorization" : "X-API-Key",
      apiKeyPrefix: bearer ? "Bearer" : "",
    };
  }
  const authorizationServer = Array.isArray(resource.authorization_servers) ? resource.authorization_servers[0] : undefined;
  if (typeof authorizationServer !== "string") throw new Error("MCP OAuth metadata did not identify an authorization server.");
  const authUrl = await validateCustomMcpEndpoint(authorizationServer);
  let metadata: OAuthMetadata | undefined;
  for (const candidate of authorizationMetadataCandidates(authUrl)) {
    const metadataUrl = await validateCustomMcpEndpoint(candidate);
    const metadataResponse = await fetch(metadataUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!metadataResponse.ok) continue;
    const discovered = await metadataResponse.json() as OAuthMetadata;
    if (discovered.authorization_endpoint && discovered.token_endpoint) {
      metadata = discovered;
      break;
    }
  }
  if (!metadata) throw new Error("Could not load MCP authorization server metadata.");
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.registration_endpoint) {
    throw new Error("MCP authorization metadata does not support dynamic client registration.");
  }
  const authorizationEndpoint = await validateCustomMcpEndpoint(metadata.authorization_endpoint);
  const tokenEndpoint = await validateCustomMcpEndpoint(metadata.token_endpoint);
  const registrationEndpoint = await validateCustomMcpEndpoint(metadata.registration_endpoint);
  const resourceUri = typeof resource.resource === "string" ? resource.resource : endpointUrl;
  const registrationResponse = await fetch(registrationEndpoint, {
    method: "POST",
    redirect: "error",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: "Robotics Interview Assistant",
      redirect_uris: [input.redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!registrationResponse.ok) throw new Error("MCP OAuth client registration failed.");
  const registration = await registrationResponse.json() as { client_id?: unknown };
  if (typeof registration.client_id !== "string") throw new Error("MCP OAuth registration returned no client id.");
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const oauthState = randomUUID();
  await pool.query(
    `insert into custom_mcp_oauth_states
      (id, state_hash, account_id, team_id, endpoint_url, resource_uri, client_id, token_endpoint, authorization_endpoint,
       redirect_uri, code_verifier, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, now())`,
    [oauthState, createHash("sha256").update(state).digest("hex"), input.accountId, input.teamId, endpointUrl, resourceUri,
      registration.client_id, tokenEndpoint, authorizationEndpoint, input.redirectUri, JSON.stringify(encrypt(verifier))],
  );
  const authorization = new URL(authorizationEndpoint);
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("client_id", registration.client_id);
  authorization.searchParams.set("redirect_uri", input.redirectUri);
  authorization.searchParams.set("code_challenge", challenge);
  authorization.searchParams.set("code_challenge_method", "S256");
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("resource", resourceUri);
  return { connected: false as const, authorizationUrl: authorization.toString(), endpointUrl };
}

export async function finishCustomMcpAuthorization(input: { state: string; code: string }) {
  const stateHash = createHash("sha256").update(input.state).digest("hex");
  const result = await pool.query(
    `delete from custom_mcp_oauth_states where state_hash = $1 and created_at > now() - interval '15 minutes'
     returning account_id, team_id, endpoint_url, resource_uri, client_id, token_endpoint, redirect_uri, code_verifier`,
    [stateHash],
  );
  const row = result.rows[0] as {
    account_id: string; team_id: string; endpoint_url: string; resource_uri: string; client_id: string; token_endpoint: string;
    redirect_uri: string; code_verifier: EncryptedValue | string;
  } | undefined;
  if (!row) throw new Error("The MCP sign-in request expired or was already used.");
  const verifier = decrypt(typeof row.code_verifier === "string" ? JSON.parse(row.code_verifier) as EncryptedValue : row.code_verifier);
  const response = await fetch(row.token_endpoint, {
    method: "POST", redirect: "error",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code: input.code, client_id: row.client_id,
      redirect_uri: row.redirect_uri, code_verifier: verifier, resource: row.resource_uri,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const token = await response.json() as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
  if (!response.ok || typeof token.access_token !== "string") throw new Error("MCP sign-in could not be completed.");
  const tools = await listAt(row.endpoint_url, token.access_token);
  await pool.query(
    `insert into custom_mcp_connections
       (account_id, team_id, endpoint_url, access_token, refresh_token, client_id, token_endpoint, expires_at, updated_at)
     values ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, now() + ($8 * interval '1 second'), now())
     on conflict (account_id) do update set team_id = excluded.team_id, endpoint_url = excluded.endpoint_url,
       access_token = excluded.access_token, refresh_token = excluded.refresh_token, client_id = excluded.client_id,
        token_endpoint = excluded.token_endpoint, expires_at = excluded.expires_at,
        api_key = null, api_key_header = null, api_key_prefix = null, updated_at = now()`,
    [row.account_id, row.team_id, row.endpoint_url, JSON.stringify(encrypt(token.access_token)),
      typeof token.refresh_token === "string" ? JSON.stringify(encrypt(token.refresh_token)) : null,
      row.client_id, row.token_endpoint, typeof token.expires_in === "number" ? Math.max(60, token.expires_in) : 3600],
  );
  return { accountId: row.account_id, teamId: row.team_id, endpointUrl: row.endpoint_url, toolCount: tools.length };
}

export async function disconnectCustomMcp(accountId: string, teamId: string) {
  await pool.query(`delete from custom_mcp_connections where account_id = $1 and team_id = $2`, [accountId, teamId]);
}

export async function listCustomMcpTools(accountId: string, teamId: string): Promise<{
  tools: CustomMcpTool[]; bindings: Map<string, CustomMcpToolBinding>;
}> {
  const row = await connection(accountId, teamId);
  if (!row) return { tools: [], bindings: new Map() };
  const endpoint = await validateCustomMcpEndpoint(row.endpoint_url);
  const accessToken = await tokenFor(accountId, teamId, row);
  const apiKey = row.api_key ? decryptValue(row.api_key) : undefined;
  const apiKeyHeaders = apiKey ? {
    [row.api_key_header || "X-API-Key"]: row.api_key_prefix ? `${row.api_key_prefix} ${apiKey}` : apiKey,
  } : undefined;
  const serverTools = await listAt(endpoint, accessToken, apiKeyHeaders);
  const tools: CustomMcpTool[] = [];
  const bindings = new Map<string, CustomMcpToolBinding>();
  for (const tool of serverTools) {
    if (typeof tool.name !== "string" || !tool.name.trim()) continue;
    const name = `custom_mcp_${tool.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`.slice(0, 64);
    if (bindings.has(name)) continue;
    const parameters = tool.inputSchema && typeof tool.inputSchema === "object"
      ? tool.inputSchema as Record<string, unknown>
      : { type: "object", properties: {} };
    bindings.set(name, { serverName: tool.name });
    tools.push({ type: "function", function: {
      name,
      description: typeof tool.description === "string" ? tool.description.slice(0, 1000) : `Call MCP tool ${tool.name}.`,
      parameters,
    } });
  }
  return { tools, bindings };
}

export async function callCustomMcpTool(
  accountId: string, teamId: string, toolName: string, args: Record<string, unknown>,
): Promise<string> {
  const row = await connection(accountId, teamId);
  if (!row) throw new Error("Custom MCP is not connected.");
  const endpoint = await validateCustomMcpEndpoint(row.endpoint_url);
  const accessToken = await tokenFor(accountId, teamId, row);
  const apiKey = row.api_key ? decryptValue(row.api_key) : undefined;
  const apiKeyHeaders = apiKey ? {
    [row.api_key_header || "X-API-Key"]: row.api_key_prefix ? `${row.api_key_prefix} ${apiKey}` : apiKey,
  } : undefined;
  return session(endpoint, accessToken, async (send) => {
    const { response, payload } = await send({
      jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: toolName, arguments: args },
    });
    if (!response.ok) throw new Error(`MCP tool call returned ${response.status}.`);
    const result = payload.result as { content?: { type?: string; text?: string }[]; isError?: boolean } | undefined;
    if (!result) throw new Error("The MCP endpoint returned an invalid tool response.");
    const text = (result.content ?? []).map((entry) => entry.text ?? "").filter(Boolean).join("\n");
    if (result.isError) throw new Error(text.slice(0, MAX_RESULT_CHARS) || "MCP tool call failed.");
    return text.slice(0, MAX_RESULT_CHARS);
  }, apiKeyHeaders);
}
