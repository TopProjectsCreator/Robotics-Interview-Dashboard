export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

export type WebSearchOutcome = {
  results: WebSearchResult[];
  provider: string;
};

const FETCH_TIMEOUT_MS = 12000;
const MAX_SNIPPET = 300;

function cleanSnippet(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET);
}

async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

function okStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

// Firecrawl is currently usable without an API key (anonymous trial quota).
// A FIRECRAWL_API_KEY, when set, raises the limits.
export async function searchFirecrawl(query: string): Promise<WebSearchOutcome | null> {
  try {
    const key = process.env.FIRECRAWL_API_KEY;
    const response = await postJson(
      "https://api.firecrawl.dev/v1/search",
      key ? { Authorization: `Bearer ${key}` } : {},
      { query, limit: 5 },
    );
    if (!okStatus(response.status)) return null;
    const data = (await response.json()) as {
      success?: boolean;
      data?: { url?: string; title?: string; description?: string }[];
    };
    if (!data.success || !Array.isArray(data.data)) return null;
    const results = data.data
      .filter((item) => item.url)
      .slice(0, 5)
      .map((item) => ({
        title: item.title || item.url || "",
        url: item.url || "",
        snippet: cleanSnippet(item.description),
      }));
    return results.length > 0 ? { results, provider: "firecrawl" } : null;
  } catch {
    return null;
  }
}

export async function searchTavily(query: string): Promise<WebSearchOutcome | null> {
  // Keyless: X-Tavily-Access-Mode header (search+extract, rate-limited).
  // A TAVILY_API_KEY, when set, raises limits and unlocks all endpoints.
  try {
    const key = process.env.TAVILY_API_KEY;
    const response = await postJson(
      "https://api.tavily.com/search",
      key ? { Authorization: `Bearer ${key}` } : { "X-Tavily-Access-Mode": "keyless" },
      { query, max_results: 5, include_answer: false },
    );
    if (!okStatus(response.status)) return null;
    const data = (await response.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    const results = (data.results ?? [])
      .filter((item) => item.url)
      .slice(0, 5)
      .map((item) => ({
        title: item.title || item.url || "",
        url: item.url || "",
        snippet: cleanSnippet(item.content),
      }));
    return results.length > 0 ? { results, provider: key ? "tavily" : "tavily-keyless" } : null;
  } catch {
    return null;
  }
}

type McpTextContent = { type?: string; text?: string };

function parseMcpPayload(raw: string): {
  result?: { content?: McpTextContent[]; isError?: boolean };
  error?: unknown;
} | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as { result?: { content?: McpTextContent[]; isError?: boolean }; error?: unknown };
  } catch {
    const line = text.split("\n").find((entry) => entry.startsWith("data:"));
    if (!line) return null;
    try {
      return JSON.parse(line.slice(5).trim()) as {
        result?: { content?: McpTextContent[]; isError?: boolean };
        error?: unknown;
      };
    } catch {
      return null;
    }
  }
}

const mcpSessions = new Map<string, { session: string; at: number }>();
const MCP_SESSION_TTL_MS = 4 * 60 * 1000;

async function mcpInit(base: string, auth: Record<string, string>): Promise<string | null> {
  const cached = mcpSessions.get(base);
  if (cached && Date.now() - cached.at < MCP_SESSION_TTL_MS) return cached.session;
  try {
    const response = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...auth },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "robotics-interview", version: "1.0" } },
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!okStatus(response.status)) return null;
    await response.text();
    const session = response.headers.get("mcp-session-id");
    if (!session) return null;
    try {
      await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "Mcp-Session-Id": session, ...auth },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        signal: AbortSignal.timeout(15000),
      });
    } catch {
      // Notification is best-effort.
    }
    mcpSessions.set(base, { session, at: Date.now() });
    return session;
  } catch {
    return null;
  }
}

async function mcpCall(
  base: string,
  auth: Record<string, string>,
  tool: string,
  args: Record<string, unknown>,
): Promise<McpTextContent[] | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) mcpSessions.delete(base);
    const session = await mcpInit(base, auth);
    if (!session) return null;
    try {
      const response = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream", "Mcp-Session-Id": session, ...auth },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: tool, arguments: args } }),
        signal: AbortSignal.timeout(60000),
      });
      if (response.status === 404 || response.status === 410) continue;
      if (!okStatus(response.status)) return null;
      const parsed = parseMcpPayload(await response.text());
      if (!parsed || parsed.error || parsed.result?.isError) return null;
      const content = parsed.result?.content ?? [];
      return content.length > 0 ? content : null;
    } catch {
      return null;
    }
  }
  return null;
}

function parseExaText(text: string): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  for (const block of text.split(/\n(?=Title:\s)/)) {
    const title = block.match(/Title:\s*(.+)/)?.[1]?.trim() ?? "";
    const url = block.match(/URL:\s*(\S+)/)?.[1]?.trim() ?? "";
    if (!url) continue;
    const highlights = block.split(/Highlights:\s*/)[1] ?? "";
    results.push({ title: title || url, url, snippet: cleanSnippet(highlights) });
    if (results.length >= 5) break;
  }
  return results;
}

export async function searchExa(query: string): Promise<WebSearchOutcome | null> {
  // Keyless: hosted MCP works anonymously (rate-limited). EXA_API_KEY raises limits.
  const key = process.env.EXA_API_KEY;
  const content = await mcpCall(
    "https://mcp.exa.ai/mcp",
    key ? { "x-api-key": key } : {},
    "web_search_exa",
    { query },
  );
  if (!content) return null;
  const combined = content.map((item) => item.text ?? "").join("\n");
  const results = parseExaText(combined);
  return results.length > 0 ? { results, provider: key ? "exa" : "exa-keyless" } : null;
}

export async function searchParallel(query: string): Promise<WebSearchOutcome | null> {
  // Keyless: hosted Search MCP is free anonymously. PARALLEL_API_KEY raises limits.
  const key = process.env.PARALLEL_API_KEY;
  const content = await mcpCall(
    "https://search.parallel.ai/mcp",
    key ? { Authorization: `Bearer ${key}` } : {},
    "web_search",
    { objective: query, search_queries: [query] },
  );
  if (!content) return null;
  try {
    const combined = content.map((item) => item.text ?? "").join("\n");
    const data = JSON.parse(combined) as {
      results?: { title?: string; url?: string; excerpts?: string[] }[];
    };
    const results = (data.results ?? [])
      .filter((item) => item.url)
      .slice(0, 5)
      .map((item) => ({
        title: (item.title || item.url || "").trim().slice(0, 120),
        url: item.url || "",
        snippet: cleanSnippet((item.excerpts ?? []).join(" ")),
      }));
    return results.length > 0 ? { results, provider: key ? "parallel" : "parallel-keyless" } : null;
  } catch {
    return null;
  }
}

async function searchWikipedia(query: string): Promise<WebSearchOutcome | null> {
  try {
    const url =
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}` +
      `&format=json&srlimit=5&origin=*`;
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!okStatus(response.status)) return null;
    const data = (await response.json()) as {
      query?: { search?: { title?: string; snippet?: string }[] };
    };
    const hits = data.query?.search ?? [];
    const results = hits.slice(0, 5).map((hit) => ({
      title: hit.title || "",
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent((hit.title || "").replace(/ /g, "_"))}`,
      snippet: cleanSnippet(hit.snippet),
    }));
    return results.length > 0 ? { results, provider: "wikipedia" } : null;
  } catch {
    return null;
  }
}

async function searchDuckDuckGo(query: string): Promise<WebSearchOutcome | null> {
  try {
    const url =
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!okStatus(response.status)) return null;
    const data = (await response.json()) as {
      AbstractText?: string;
      AbstractURL?: string;
      Results?: { Text?: string; FirstURL?: string }[];
      RelatedTopics?: { Text?: string; FirstURL?: string }[];
    };
    const results: WebSearchResult[] = [];
    if (data.AbstractURL) {
      results.push({
        title: "Instant answer",
        url: data.AbstractURL,
        snippet: cleanSnippet(data.AbstractText),
      });
    }
    for (const item of [...(data.Results ?? []), ...(data.RelatedTopics ?? [])]) {
      if (results.length >= 5) break;
      if (item.FirstURL && item.Text) {
        results.push({ title: item.Text.slice(0, 80), url: item.FirstURL, snippet: cleanSnippet(item.Text) });
      }
    }
    return results.length > 0 ? { results, provider: "duckduckgo" } : null;
  } catch {
    return null;
  }
}

/**
 * Keyless-first web search across four providers plus backstops.
 * Tavily works keyless via header; Firecrawl works keyless today; Exa and
 * Parallel work keyless through their hosted MCP servers. Optional API keys
 * (TAVILY_API_KEY, FIRECRAWL_API_KEY, EXA_API_KEY, PARALLEL_API_KEY) raise
 * limits. Wikipedia and DuckDuckGo are the keyless backstops. Any provider
 * failure (401/402/429/5xx/timeout) falls through to the next one. Returns
 * null when every provider fails.
 */
export async function searchWebFallback(query: string): Promise<WebSearchOutcome | null> {
  const clean = query.trim().slice(0, 300);
  if (!clean) return null;
  const chain = [searchTavily, searchFirecrawl, searchExa, searchParallel, searchWikipedia, searchDuckDuckGo];
  for (const provider of chain) {
    const outcome = await provider(clean);
    if (outcome) return outcome;
  }
  return null;
}

export function formatSearchResults(outcome: WebSearchOutcome): string {
  const lines = outcome.results.map(
    (result, index) => `[${index + 1}] ${result.title}\n${result.url}\n${result.snippet}`,
  );
  return `Web results (via ${outcome.provider}):\n${lines.join("\n\n")}`;
}

function isBlockedFetchUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return true;
    if (url.username || url.password) return true;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost")) return true;
    const v4 = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
    if (v4) {
      const octets = v4.slice(1, 5).map(Number);
      if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
      const [a, b] = octets;
      if (a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return true;
      return false;
    }
    // Non-standard numeric spellings (single long integer, leading-zero
    // octal, 0x hex, IPv6 incl. ::1): block them all rather than parse.
    if (/^[\dxabcdef.:]+$/i.test(host)) return true;
    if (host.includes(":")) return true;
    return false;
  } catch {
    return true;
  }
}

const FETCH_MAX_BYTES = 32768;
const FETCH_MAX_HOPS = 3;

import { promises as dns } from "node:dns";

function ipv4OctetsBlocked(octets: number[]): boolean {
  const [a, b] = octets;
  return a === 10 || a === 127 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

// DNS names that resolve to non-public addresses (lvh.me, nip.io, …) must
// not slip past the literal-IP checks. No pinning: a rebinding race between
// this check and connect remains (accepted residual — needs DNS control plus
// prompt injection, and no secrets are file- or net-reachable).
async function resolvesToBlockedIp(raw: string): Promise<boolean> {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    if (/^[\dxabcdef.:]+$/i.test(host)) return false;
    const addresses = await dns.resolve4(host);
    return addresses.some((ip) => {
      const octets = ip.split(".").map(Number);
      return octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255) || ipv4OctetsBlocked(octets);
    });
  } catch {
    return false;
  }
}

/** Fetch a model-requested URL as capped plain text. SSRF-guarded. */
export async function fetchUrlText(rawUrl: string): Promise<string | null> {
  if (isBlockedFetchUrl(rawUrl)) return null;
  if (await resolvesToBlockedIp(rawUrl)) return null;
  try {
    let current = rawUrl;
    let response: Response | null = null;
    for (let hop = 0; hop <= FETCH_MAX_HOPS; hop += 1) {
      const attempt = await fetch(current, {
        headers: { Accept: "text/html,text/plain", "User-Agent": "RoboticsInterviewDashboard/1.0" },
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      });
      if (attempt.status >= 300 && attempt.status < 400) {
        const location = attempt.headers.get("location");
        await attempt.body?.cancel().catch(() => undefined);
        if (!location) return null;
        const next = new URL(location, current).toString();
        if (isBlockedFetchUrl(next)) return null;
        current = next;
        continue;
      }
      response = attempt;
      break;
    }
    if (!response || !okStatus(response.status)) {
      await response?.body?.cancel().catch(() => undefined);
      return null;
    }
    const contentType = response.headers.get("content-type") ?? "";
    if (!/text|html|json/i.test(contentType)) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > FETCH_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        break;
      }
      chunks.push(value);
    }
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = cleanSnippet(new TextDecoder().decode(merged).slice(0, 8000));
    return text || null;
  } catch {
    return null;
  }
}
