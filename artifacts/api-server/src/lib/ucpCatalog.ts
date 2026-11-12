/**
 * Client for a supplier's UCP (Universal Commerce Protocol) catalog API.
 *
 * WestCoast Products publishes `agents.md` and a full UCP profile at
 * `https://wcproducts.com/.well-known/ucp`, including
 * `dev.ucp.shopping.catalog.search`. Unlike the store's public products.json,
 * which stays online while its payload drifts out of date (verified: the
 * limelight-vision-camera listing ships one stale "Default Title" variant at
 * $399.99 while the live page sells three named variants with availability),
 * the UCP catalog API is the supplier-sanctioned, real-time source of truth.
 *
 * The sync browses the catalog with a price floor (query is optional when a
 * filter is supplied, so this is a "browse" operation), follows the cursor
 * until `has_next_page` is false, and maps each variant to a catalog record.
 * Variants carry their own price (in minor ISO 4217 units) and availability,
 * so both come in per sellable option instead of per stale listing.
 */

/** Well-known variant availability states, matching the UCP availability schema. */
export const UCP_STOCK_STATUSES = [
  "in_stock",
  "backorder",
  "preorder",
  "out_of_stock",
  "discontinued",
] as const;

export type UcpStockStatus = (typeof UCP_STOCK_STATUSES)[number];
const KNOWN_STOCK_STATUSES = new Set<string>(UCP_STOCK_STATUSES);

export type UcpCatalogVariant = {
  /** Variant GID, e.g. gid://shopify/ProductVariant/36124521758880. */
  id: string;
  sku: string | null;
  title: string;
  /** Major-unit decimal string ("399.99"), or null when unparsable. */
  price: string | null;
  currency: string | null;
  stockStatus: UcpStockStatus | null;
  imageUrl: string | null;
  url: string | null;
};

export type UcpCatalogProduct = {
  /** Product GID, e.g. gid://shopify/Product/5604572889248. */
  id: string;
  handle: string | null;
  title: string;
  description: string | null;
  url: string | null;
  imageUrl: string | null;
  category: string | null;
  variants: UcpCatalogVariant[];
};

export type UcpSearchPage = {
  products: UcpCatalogProduct[];
  hasNextPage: boolean;
  cursor: string | null;
  totalCount: number | null;
};

export type UcpCatalogSnapshot = {
  products: UcpCatalogProduct[];
  /** True when the page cap was reached before the supplier signalled the end. */
  truncated: boolean;
  totalCount: number | null;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimmedString(value: unknown, max = 2000): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * UCP prices are integer minor units. Only non-negative integers within the
 * parts_catalog_items supplier_price ceiling (99,999,999.99) are accepted;
 * anything else is dropped rather than guessed.
 */
export function parseUcpAmount(value: unknown): string | null {
  const amount = typeof value === "string" && /^\d+$/.test(value.trim())
    ? Number(value.trim())
    : typeof value === "number" && Number.isFinite(value)
      ? value
      : NaN;
  if (!Number.isInteger(amount) || amount < 0 || amount > 9_999_999_999) return null;
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}

export function parseUcpCurrency(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z]{3}$/.test(value.trim())
    ? value.trim().toUpperCase()
    : null;
}

/** variant.availability = { available: bool, status: well-known fulfillment state }. */
export function parseUcpAvailability(value: unknown): UcpStockStatus | null {
  if (!isRecord(value)) return null;
  const status = typeof value.status === "string" ? value.status.toLowerCase() : null;
  if (status && KNOWN_STOCK_STATUSES.has(status)) return status as UcpStockStatus;
  if (value.available === false) return "out_of_stock";
  if (value.available === true) return "in_stock";
  return null;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function stripHtml(value: string): string {
  return decodeEntities(
    value
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

/** The UCP description is one or more formats; prefer plain text. */
export function normalizeUcpDescription(description: unknown): string | null {
  const pick = (record: JsonRecord): unknown =>
    record.plain ?? record.markdown ?? record.html ?? record.text;
  let raw: unknown = description;
  if (isRecord(description)) raw = pick(description);
  if (typeof raw !== "string") return null;
  const text = stripHtml(raw).trim();
  return text ? text.slice(0, 1200) : null;
}

function firstImageUrl(media: unknown): string | null {
  if (!Array.isArray(media)) return null;
  for (const item of media) {
    if (!isRecord(item)) continue;
    const type = typeof item.type === "string" ? item.type.toLowerCase() : null;
    const url = trimmedString(item.url, 2000);
    // Prefer images; fall through to any HTTPS media for a thumbnail.
    if (url && url.startsWith("https://") && (type === null || type === "image")) return url;
  }
  for (const item of media) {
    const url = isRecord(item) ? trimmedString(item.url, 2000) : null;
    if (url && url.startsWith("https://")) return url;
  }
  return null;
}

/** Numeric id at the end of a Shopify GID (used for ?variant= deep links). */
export function gidNumericId(gid: string | null | undefined): string | null {
  const match = typeof gid === "string" ? /\/(\d+)\/?$/.exec(gid.trim()) : null;
  return match?.[1] ?? null;
}

function firstCategoryValue(categories: unknown): string | null {
  if (!Array.isArray(categories) || categories.length === 0) return null;
  for (const entry of categories) {
    if (!isRecord(entry)) continue;
    const value = trimmedString(entry.value, 200);
    // Shopify taxonomy categories arrive as GIDs; keep anything with real words.
    if (value && !value.startsWith("gid://")) return value;
  }
  return null;
}

export function mapUcpVariant(variant: unknown): UcpCatalogVariant | null {
  if (!isRecord(variant)) return null;
  const id = trimmedString(variant.id, 500);
  const title = trimmedString(variant.title, 250);
  if (!id || !title) return null;
  const price = isRecord(variant.price) ? variant.price : null;
  const priceAmount = price ? parseUcpAmount(price.amount) : null;
  const currency = price ? parseUcpCurrency(price.currency) : null;
  return {
    id,
    sku: trimmedString(variant.sku, 200),
    title,
    price: priceAmount,
    currency: priceAmount ? currency : null,
    stockStatus: parseUcpAvailability(variant.availability),
    imageUrl: firstImageUrl(variant.media),
    url: trimmedString(variant.url, 2000),
  };
}

export function mapUcpProduct(product: unknown): UcpCatalogProduct | null {
  if (!isRecord(product)) return null;
  const id = trimmedString(product.id, 500);
  const title = trimmedString(product.title, 250);
  if (!id || !title) return null;
  const ownUrl = trimmedString(product.url, 2000);
  const description = normalizeUcpDescription(product.description);
  const variants = (Array.isArray(product.variants) ? product.variants : [])
    .map(mapUcpVariant)
    .filter((variant): variant is UcpCatalogVariant => variant !== null);
  if (variants.length === 0) return null;
  const tagsSlice = Array.isArray(product.tags)
    ? trimmedString(
        product.tags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0).slice(0, 3).join(" / "),
        200,
      )
    : null;
  return {
    id,
    handle: trimmedString(product.handle, 300),
    title,
    description,
    url: ownUrl ?? variants[0]?.url ?? null,
    imageUrl: firstImageUrl(product.media) ?? variants[0]?.imageUrl ?? null,
    category: tagsSlice ?? firstCategoryValue(product.categories),
    variants,
  };
}

export function parseUcpSearchResponse(payload: unknown): UcpSearchPage {
  if (!isRecord(payload)) {
    throw new Error("UCP catalog search did not return a product list payload.");
  }
  const rawProducts = Array.isArray(payload.products) ? payload.products : null;
  if (!rawProducts) {
    throw new Error("UCP catalog search returned no products list.");
  }
  const products = rawProducts
    .map(mapUcpProduct)
    .filter((product): product is UcpCatalogProduct => product !== null);
  const pagination = isRecord(payload.pagination) ? payload.pagination : {};
  return {
    products,
    hasNextPage: pagination.has_next_page === true,
    cursor: trimmedString(pagination.cursor, 2000),
    totalCount: typeof pagination.total_count === "number" && Number.isFinite(pagination.total_count)
      ? Math.max(0, Math.floor(pagination.total_count))
      : null,
  };
}

export type UcpMcpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Calls one tool on the supplier's UCP MCP endpoint and returns the decoded
 * tool result. Handles both plain JSON-RPC responses and SSE-framed ones, and
 * both {structuredContent} and {content: [{type:"text",text}]} tool envelopes.
 */
export async function callUcpMcpTool(
  endpoint: string,
  profileUrl: string,
  toolName: string,
  args: Record<string, unknown>,
  timeoutMs: number,
  fetchImpl: UcpMcpFetch = fetch as unknown as UcpMcpFetch,
): Promise<unknown> {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    throw new Error("The UCP catalog endpoint must use HTTPS.");
  }
  const response = await fetchImpl(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "accept": "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: toolName,
        arguments: {
          meta: { "ucp-agent": { profile: profileUrl } },
          ...args,
        },
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`UCP MCP endpoint returned HTTP ${response.status}.`);
  }
  const body = await response.text();
  const parsed = parseJsonRpcEnvelope(body);
  if (isRecord(parsed) && isRecord(parsed.error)) {
    const message = trimmedString(parsed.error.message, 300) ?? "unknown error";
    throw new Error(`UCP MCP error from ${toolName}: ${message}`);
  }
  const result = isRecord(parsed) && isRecord(parsed.result) ? parsed.result : null;
  if (!result) {
    throw new Error(`UCP MCP ${toolName} returned no result object.`);
  }
  if (result.isError === true) {
    const contents = Array.isArray(result.content) ? result.content : [];
    const text = contents
      .map((item) => (isRecord(item) && typeof item.text === "string" ? item.text : ""))
      .join(" ")
      .trim();
    throw new Error(`UCP MCP tool ${toolName} failed: ${text.slice(0, 300) || "unknown error"}`);
  }
  if (isRecord(result.structuredContent)) return result.structuredContent;
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (!isRecord(item) || item.type !== "text" || typeof item.text !== "string") continue;
      try {
        return JSON.parse(item.text) as unknown;
      } catch {
        continue;
      }
    }
  }
  if ("products" in result) return result;
  throw new Error(`UCP MCP tool ${toolName} returned an unrecognised result shape.`);
}

/** Accepts raw JSON or SSE-framed JSON-RPC messages; takes the last complete one. */
function parseJsonRpcEnvelope(body: string): unknown {
  const trimmed = body.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return JSON.parse(trimmed);
  const dataLines = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^data:\s?/, "").trim())
    .filter((line) => line.startsWith("{") || line.startsWith("["));
  for (let index = dataLines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(dataLines[index]);
    } catch {
      continue;
    }
  }
  throw new Error("UCP MCP response could not be decoded.");
}

export const UCP_CATALOG_PAGE_SIZE = 100;
export const UCP_CATALOG_MAX_PAGES = 40;

/**
 * Browses the supplier's full catalog in two passes: one for purchasable items
 * and one for the rest (out of stock, discontinued — the store hides these
 * from the default browse but keeps them listable for the agent catalog: the
 * union matches the supplier's live product sitemap). Query is optional when
 * filters are supplied, so both passes use a price floor instead of a text
 * search to avoid relevance ranking.
 */
export async function fetchUcpCatalogSnapshot(
  endpoint: string,
  profileUrl: string,
  options: {
    maxPages?: number;
    pageSize?: number;
    timeoutMs?: number;
    fetchImpl?: UcpMcpFetch;
  } = {},
): Promise<UcpCatalogSnapshot> {
  const maxPages = options.maxPages ?? UCP_CATALOG_MAX_PAGES;
  const pageSize = options.pageSize ?? UCP_CATALOG_PAGE_SIZE;
  const timeoutMs = options.timeoutMs ?? 60_000;
  const byId = new Map<string, UcpCatalogProduct>();
  let truncated = false;
  let totalCount: number | null = null;

  for (const filters of [{ price: { min: 0 } }, { price: { min: 0 }, available: false }] as const) {
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page += 1) {
      const payload = await callUcpMcpTool(
        endpoint,
        profileUrl,
        "search_catalog",
        {
          catalog: {
            filters,
            pagination: { ...(cursor ? { cursor } : {}), limit: pageSize },
          },
        },
        timeoutMs,
        options.fetchImpl,
      );
      const parsed = parseUcpSearchResponse(payload);
      for (const product of parsed.products) {
        if (!byId.has(product.id)) byId.set(product.id, product);
      }
      if (parsed.totalCount !== null) totalCount = parsed.totalCount;
      if (!parsed.hasNextPage) {
        cursor = null;
        break;
      }
      if (!parsed.cursor) {
        truncated = true; // supplier signalled more pages but no cursor — stop honestly
        break;
      }
      cursor = parsed.cursor;
      if (page === maxPages - 1) truncated = true;
    }
  }

  return {
    products: [...byId.values()],
    truncated,
    totalCount,
  };
}
