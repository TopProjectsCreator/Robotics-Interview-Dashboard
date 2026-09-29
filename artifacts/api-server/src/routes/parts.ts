import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import {
  CreatePartsCatalogItemBody,
  CreatePartsCatalogItemResponse,
  CreatePartsRobotBody,
  CreatePartsRobotResponse,
  GetPartsDashboardResponse,
  ImportPartsCatalogBody,
  ImportPartsCatalogResponse,
  ListPartsCatalogResponse,
  SearchPartsCatalogResponse,
  SetPartsRobotAllocationBody,
  SetPartsRobotAllocationParams,
  SetPartsRobotAllocationResponse,
  SyncPartsCatalogResponse,
  UpdatePartsCatalogStockBody,
  UpdatePartsCatalogStockParams,
  UpdatePartsCatalogStockResponse,
  UpdatePartsRobotBody,
  UpdatePartsRobotParams,
  UpdatePartsRobotResponse,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();
type PoolClient = {
  query: (
    statement: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, any>[]; rowCount: number | null }>;
  release: () => void;
};

type VendorGroup = "General Parts" | "Specific Parts" | "Machining Companies";
type VendorConfig = {
  key: string;
  name: string;
  group: VendorGroup;
  website: string;
  domain: string;
  catalogMode: "products" | "custom_fabrication";
  publicProductFeedUrl?: string;
};

const VENDORS: VendorConfig[] = [
  { key: "andymark", name: "Andymark", group: "General Parts", website: "https://www.andymark.com/", domain: "andymark.com", catalogMode: "products", publicProductFeedUrl: "https://andymark.com/products.json" },
  { key: "gobilda", name: "goBILDA", group: "General Parts", website: "https://www.gobilda.com/", domain: "gobilda.com", catalogMode: "products" },
  { key: "grainger", name: "Grainger", group: "General Parts", website: "https://www.grainger.com/", domain: "grainger.com", catalogMode: "products" },
  { key: "rev-robotics", name: "REV Robotics", group: "General Parts", website: "https://www.revrobotics.com/", domain: "revrobotics.com", catalogMode: "products" },
  { key: "servocity", name: "ServoCity", group: "General Parts", website: "https://www.servocity.com/", domain: "servocity.com", catalogMode: "products" },
  { key: "studica", name: "Studica", group: "General Parts", website: "https://www.studica.com/", domain: "studica.com", catalogMode: "products" },
  { key: "swyft", name: "Swyft", group: "Specific Parts", website: "https://swyftrobotics.com/", domain: "swyftrobotics.com", catalogMode: "products", publicProductFeedUrl: "https://shop.swyftrobotics.com/products.json" },
  { key: "ferra", name: "Ferra", group: "Specific Parts", website: "https://ferracomponents.com/", domain: "ferracomponents.com", catalogMode: "products", publicProductFeedUrl: "https://ferracomponents.com/products.json" },
  { key: "axon-robotics", name: "Axon Robotics", group: "Specific Parts", website: "https://axon-robotics.com/", domain: "axon-robotics.com", catalogMode: "products" },
  { key: "bwtlink", name: "BWTLink", group: "Specific Parts", website: "https://bwtlink.com/", domain: "bwtlink.com", catalogMode: "products" },
  { key: "melonbotics", name: "Melonbotics", group: "Specific Parts", website: "https://melonbotics.com/", domain: "melonbotics.com", catalogMode: "products", publicProductFeedUrl: "https://www.melonbotics.com/products.json" },
  { key: "misumi", name: "Misumi", group: "Specific Parts", website: "https://us.misumi-ec.com/", domain: "misumi-ec.com", catalogMode: "products" },
  { key: "optii", name: "Optii", group: "Specific Parts", website: "https://optii.com.au/", domain: "optii.com.au", catalogMode: "products", publicProductFeedUrl: "https://optii.com.au/products.json" },
  { key: "offset-robotics", name: "Offset Robotics", group: "Specific Parts", website: "https://offsetrobotics.com/", domain: "offsetrobotics.com", catalogMode: "products" },
  { key: "mcmaster-carr", name: "McMaster-Carr", group: "Specific Parts", website: "https://www.mcmaster.com/", domain: "mcmaster.com", catalogMode: "products" },
  { key: "cncmadness", name: "CNCMadness", group: "Machining Companies", website: "https://cncmadness.com/", domain: "cncmadness.com", catalogMode: "custom_fabrication" },
  { key: "fabworks", name: "Fabworks", group: "Machining Companies", website: "https://fabworks.com/", domain: "fabworks.com", catalogMode: "custom_fabrication" },
  { key: "oshcut", name: "Oshcut", group: "Machining Companies", website: "https://www.oshcut.com/", domain: "oshcut.com", catalogMode: "custom_fabrication" },
  { key: "sendcutsend", name: "SendCutSend", group: "Machining Companies", website: "https://sendcutsend.com/", domain: "sendcutsend.com", catalogMode: "custom_fabrication" },
];

const vendorByKey = new Map(VENDORS.map((vendor) => [vendor.key, vendor]));
const publicVendors = VENDORS.map(({ domain: _domain, ...vendor }) => vendor);

class BadInputError extends Error {}
class StockConflictError extends Error {
  constructor(readonly allocated: number) {
    super("Owned stock cannot be lower than the quantity already assigned.");
  }
}

function cleanText(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function vendorForKey(key: string): VendorConfig {
  const vendor = vendorByKey.get(key);
  if (!vendor) throw new BadInputError("Choose one of the listed vendors.");
  return vendor;
}

function validateVendorUrl(value: unknown, vendor: VendorConfig): string | null {
  const cleaned = cleanText(value, 2000);
  if (!cleaned) return null;
  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    throw new BadInputError("Enter a valid vendor product URL.");
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (
    (parsed.protocol !== "https:" && parsed.protocol !== "http:") ||
    (host !== vendor.domain && !host.endsWith(`.${vendor.domain}`))
  ) {
    throw new BadInputError("Product links must belong to the selected vendor.");
  }
  return parsed.toString();
}

function validateImageUrl(value: unknown): string | null {
  const cleaned = cleanText(value, 2000);
  if (!cleaned) return null;
  try {
    const parsed = new URL(cleaned);
    if (parsed.protocol !== "https:") throw new Error("https required");
    return parsed.toString();
  } catch {
    throw new BadInputError("Image links must be valid HTTPS URLs.");
  }
}

function externalKeyFor(input: {
  externalKey?: unknown;
  sku?: unknown;
  productUrl?: unknown;
  name: string;
}): string {
  const suppliedKey = cleanText(input.externalKey, 500);
  const sku = cleanText(input.sku, 200);
  const productUrl = cleanText(input.productUrl, 2000);
  return (suppliedKey ?? sku ?? productUrl ?? input.name)
    .toLocaleLowerCase()
    .slice(0, 500);
}

async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = (await pool.connect()) as unknown as PoolClient;
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function upsertCatalogRecord(
  client: PoolClient,
  input: {
    vendorKey: string;
    externalKey: string;
    name: string;
    sku: string | null;
    category: string | null;
    description: string | null;
    productUrl: string | null;
    imageUrl: string | null;
  },
): Promise<{ id: string; created: boolean }> {
  const existing = await client.query(
    `select "id" from "parts_catalog_items" where "vendor_key" = $1 and "external_key" = $2`,
    [input.vendorKey, input.externalKey],
  );
  const created = existing.rowCount === 0;
  const id = created ? randomUUID() : String(existing.rows[0].id);
  const saved = await client.query(
    `insert into "parts_catalog_items"
       ("id", "vendor_key", "external_key", "name", "sku", "category", "description", "product_url", "image_url")
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     on conflict ("vendor_key", "external_key") do update set
       "name" = excluded."name",
       "sku" = coalesce(excluded."sku", "parts_catalog_items"."sku"),
       "category" = coalesce(excluded."category", "parts_catalog_items"."category"),
       "description" = coalesce(excluded."description", "parts_catalog_items"."description"),
       "product_url" = coalesce(excluded."product_url", "parts_catalog_items"."product_url"),
       "image_url" = coalesce(excluded."image_url", "parts_catalog_items"."image_url"),
       "updated_at" = now()
     returning "id"`,
    [
      id,
      input.vendorKey,
      input.externalKey,
      input.name,
      input.sku,
      input.category,
      input.description,
      input.productUrl,
      input.imageUrl,
    ],
  );
  const savedId = String(saved.rows[0].id);
  await client.query(
    `insert into "parts_inventory" ("part_id", "quantity_owned")
     values ($1, 0) on conflict ("part_id") do nothing`,
    [savedId],
  );
  return { id: savedId, created };
}

async function setOwnedQuantity(
  client: PoolClient,
  partId: string,
  quantity: number,
): Promise<{ exists: boolean; allocated: number }> {
  const part = await client.query(
    `select "id" from "parts_catalog_items" where "id" = $1 for update`,
    [partId],
  );
  if (part.rowCount === 0) return { exists: false, allocated: 0 };
  const assignedResult = await client.query(
    `select coalesce(sum("quantity"), 0)::int as "assigned"
     from "parts_robot_allocations" where "part_id" = $1`,
    [partId],
  );
  const allocated = Number(assignedResult.rows[0].assigned);
  if (quantity < allocated) throw new StockConflictError(allocated);
  await client.query(
    `insert into "parts_inventory" ("part_id", "quantity_owned", "updated_at")
     values ($1, $2, now())
     on conflict ("part_id") do update set
       "quantity_owned" = excluded."quantity_owned", "updated_at" = now()`,
    [partId, quantity],
  );
  return { exists: true, allocated };
}

function isoDate(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function mapRobot(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    createdAt: isoDate(row.createdAt as Date | string),
    updatedAt: isoDate(row.updatedAt as Date | string),
  };
}

function mapCatalogRow(row: Record<string, unknown>) {
  const quantityOwned = Number(row.quantityOwned ?? 0);
  const quantityAssigned = Number(row.quantityAssigned ?? 0);
  const vendorKey = String(row.vendorKey);
  const vendor = vendorByKey.get(vendorKey);
  let allocations = row.allocations;
  if (typeof allocations === "string") {
    try {
      allocations = JSON.parse(allocations) as unknown;
    } catch {
      allocations = [];
    }
  }
  return {
    id: String(row.id),
    vendorKey,
    vendorName: vendor?.name ?? vendorKey,
    name: String(row.name),
    sku: (row.sku as string | null) ?? null,
    category: (row.category as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    productUrl: (row.productUrl as string | null) ?? null,
    imageUrl: (row.imageUrl as string | null) ?? null,
    quantityOwned,
    quantityAssigned,
    quantityAvailable: Math.max(0, quantityOwned - quantityAssigned),
    allocations: Array.isArray(allocations) ? allocations : [],
    createdAt: isoDate(row.createdAt as Date | string),
    updatedAt: isoDate(row.updatedAt as Date | string),
  };
}

async function queryCatalogRows(
  whereSql: string,
  values: unknown[],
  limit: number,
  offset: number,
): Promise<Record<string, unknown>[]> {
  const result = await pool.query(
    `select c."id", c."vendor_key" as "vendorKey", c."name", c."sku",
            c."category", c."description", c."product_url" as "productUrl",
            c."image_url" as "imageUrl", c."created_at" as "createdAt",
            c."updated_at" as "updatedAt",
            coalesce(i."quantity_owned", 0)::int as "quantityOwned",
            coalesce(sum(a."quantity"), 0)::int as "quantityAssigned",
            coalesce(
              json_agg(json_build_object(
                'robotId', r."id", 'robotName', r."name",
                'partId', c."id", 'quantity', a."quantity"
              ) order by lower(r."name")) filter (where a."id" is not null),
              '[]'::json
            ) as "allocations"
     from "parts_catalog_items" c
     left join "parts_inventory" i on i."part_id" = c."id"
     left join "parts_robot_allocations" a on a."part_id" = c."id"
     left join "parts_robots" r on r."id" = a."robot_id"
     ${whereSql}
     group by c."id", i."quantity_owned"
     order by c."updated_at" desc, lower(c."name")
     limit $${values.length + 1} offset $${values.length + 2}`,
    [...values, limit, offset],
  );
  return result.rows;
}

async function getCatalogItem(partId: string) {
  const rows = await queryCatalogRows(`where c."id" = $1`, [partId], 1, 0);
  return rows[0] ? mapCatalogRow(rows[0]) : null;
}

function parseSseResponse(text: string): unknown {
  const dataLines = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .filter(Boolean);
  const candidate = dataLines.length > 0 ? dataLines[dataLines.length - 1] : text;
  return JSON.parse(candidate);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

type PublicCatalogSearchResult = {
  vendorKey: string;
  vendorName: string;
  title: string;
  url: string;
  description: string;
};

function catalogVendorForUrl(url: URL, allowedVendors: VendorConfig[]) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  return allowedVendors.find(
    (vendor) => hostname === vendor.domain || hostname.endsWith(`.${vendor.domain}`),
  );
}

function toPublicCatalogSearchResult(
  item: Record<string, unknown>,
  allowedVendors: VendorConfig[],
): PublicCatalogSearchResult | null {
  if (typeof item.url !== "string") return null;
  let url: URL;
  try {
    url = new URL(item.url);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const vendor = catalogVendorForUrl(url, allowedVendors);
  if (!vendor) return null;
  return {
    vendorKey: vendor.key,
    vendorName: vendor.name,
    title: typeof item.title === "string" ? item.title.slice(0, 300) : vendor.name,
    url: url.toString(),
    description:
      typeof item.content === "string"
        ? item.content.slice(0, 1200)
        : typeof item.description === "string"
          ? item.description.slice(0, 1200)
          : typeof item.snippet === "string"
            ? item.snippet.slice(0, 1200)
            : "",
  };
}

async function searchWithTavily(
  query: string,
  allowedVendors: VendorConfig[],
): Promise<PublicCatalogSearchResult[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-Tavily-Access-Mode": "keyless",
    },
    body: JSON.stringify({
      query: `Official robotics parts and product pages matching: ${query}`,
      search_depth: "basic",
      max_results: 20,
      include_domains: allowedVendors.map((vendor) => vendor.domain),
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Tavily search returned ${response.status}`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !Array.isArray(payload.results)) {
    throw new Error("Tavily search returned an invalid response");
  }
  return payload.results
    .filter(isRecord)
    .map((item) => toPublicCatalogSearchResult(item, allowedVendors))
    .filter((item): item is PublicCatalogSearchResult => item !== null);
}

function parseExaSearchResults(text: string, allowedVendors: VendorConfig[]) {
  const chunks = text.split(/\n---\n/);
  const results: PublicCatalogSearchResult[] = [];
  for (const chunk of chunks) {
    const title = chunk.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
    const resultUrl = chunk.match(/^URL:\s*(https?:\/\/\S+)$/m)?.[1]?.trim();
    if (!resultUrl) continue;
    const description = chunk.match(/^Highlights:\s*\n([\s\S]*)$/m)?.[1]?.trim() ?? "";
    const parsed = toPublicCatalogSearchResult(
      {
        title,
        url: resultUrl,
        description: description.replace(/^\.\.\.\s*$/gm, "").slice(0, 1200),
      },
      allowedVendors,
    );
    if (parsed) results.push(parsed);
  }
  return results;
}

async function searchWithExa(
  query: string,
  allowedVendors: VendorConfig[],
): Promise<PublicCatalogSearchResult[]> {
  const vendorScope = allowedVendors.map((vendor) => `${vendor.name} (${vendor.domain})`).join("; ");
  const response = await fetch("https://mcp.exa.ai/mcp?tools=web_search_exa", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `parts-${Date.now()}`,
      method: "tools/call",
      params: {
        name: "web_search_exa",
        arguments: {
          query: `Official supplier product pages matching "${query}" from ${vendorScope}`,
          objective:
            "Return relevant product or catalog pages hosted on the listed suppliers' own domains. Exclude third-party stores and unrelated pages.",
          numResults: 20,
        },
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Exa search returned ${response.status}`);
  const envelope = parseSseResponse(await response.text());
  if (!isRecord(envelope) || !isRecord(envelope.result) || envelope.result.isError) {
    throw new Error("Exa search returned an invalid response");
  }
  const content = envelope.result.content;
  if (!Array.isArray(content)) throw new Error("Exa search returned no results");
  const textBlock = content.find(
    (item) => isRecord(item) && item.type === "text" && typeof item.text === "string",
  );
  if (!isRecord(textBlock) || typeof textBlock.text !== "string") {
    throw new Error("Exa search result was empty");
  }
  return parseExaSearchResults(textBlock.text, allowedVendors);
}

async function searchPublicCatalog(query: string, vendor?: VendorConfig) {
  const allowedVendors = vendor ? [vendor] : VENDORS;
  const [tavily, exa] = await Promise.allSettled([
    searchWithTavily(query, allowedVendors),
    searchWithExa(query, allowedVendors),
  ]);
  if (tavily.status === "rejected" && exa.status === "rejected") {
    throw new Error("All keyless catalog search providers are unavailable.");
  }

  const combined = [
    ...(tavily.status === "fulfilled" ? tavily.value : []),
    ...(exa.status === "fulfilled" ? exa.value : []),
  ];
  const seen = new Set<string>();
  return combined.filter((result) => {
    const parsedUrl = new URL(result.url);
    const key = `${result.vendorKey}:${parsedUrl.origin}${parsedUrl.pathname}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

type CatalogFeedRecord = {
  vendorKey: string;
  externalKey: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  productUrl: string | null;
  imageUrl: string | null;
};

type CatalogFeedSyncVendor = {
  vendorKey: string;
  vendorName: string;
  status: "synced" | "search_only" | "unavailable" | "incomplete";
  itemCount: number;
  created: number;
  updated: number;
  source: string | null;
  message: string;
};

const SHOPIFY_PAGE_SIZE = 250;
const MAX_PUBLIC_FEED_PAGES = 50;

function vendorOwnsHost(hostname: string, vendor: VendorConfig) {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return normalized === vendor.domain || normalized.endsWith(`.${vendor.domain}`);
}

async function fetchShopifyProductPage(vendor: VendorConfig, page: number) {
  if (!vendor.publicProductFeedUrl) throw new Error("No verified public product feed.");
  const feedUrl = new URL(vendor.publicProductFeedUrl);
  feedUrl.searchParams.set("limit", String(SHOPIFY_PAGE_SIZE));
  feedUrl.searchParams.set("page", String(page));
  let target = feedUrl;

  for (let redirect = 0; redirect < 4; redirect += 1) {
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      !vendorOwnsHost(target.hostname, vendor)
    ) {
      throw new Error("Product feed redirected outside the supplier website.");
    }
    const response = await fetch(target, {
      headers: { accept: "application/json" },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Product feed returned an invalid redirect.");
      target = new URL(location, target);
      continue;
    }
    if (!response.ok) throw new Error(`Product feed returned ${response.status}.`);
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.products)) {
      throw new Error("Product feed did not return a Shopify product list.");
    }
    return payload.products.filter(isRecord);
  }
  throw new Error("Product feed exceeded the redirect limit.");
}

function stripProductHtml(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/div>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 1200) : null;
}

function firstSecureImage(product: Record<string, unknown>) {
  const image = isRecord(product.image) ? product.image.src : product.image;
  const images = Array.isArray(product.images) ? product.images : [];
  const firstImage = images.find((item) => isRecord(item) && typeof item.src === "string");
  const candidate = typeof image === "string" ? image : isRecord(firstImage) ? firstImage.src : null;
  if (typeof candidate !== "string") return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function catalogRecordsFromShopifyProduct(vendor: VendorConfig, product: Record<string, unknown>) {
  const title = cleanText(product.title, 250);
  const handle = cleanText(product.handle, 300);
  if (!title || !handle || !vendor.publicProductFeedUrl) return [];

  const feedOrigin = new URL(vendor.publicProductFeedUrl).origin;
  const baseProductUrl = new URL(`/products/${encodeURIComponent(handle)}`, feedOrigin);
  const variants = Array.isArray(product.variants)
    ? product.variants.filter(isRecord)
    : [];
  const items = variants.length > 0 ? variants : [{}];
  const category =
    cleanText(product.product_type, 200) ??
    (Array.isArray(product.tags)
      ? cleanText(product.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 3).join(" / "), 200)
      : null);

  return items.map((variant, index): CatalogFeedRecord => {
    const sku = cleanText(variant.sku, 200);
    const variantId =
      typeof variant.id === "string" || typeof variant.id === "number"
        ? String(variant.id)
        : null;
    const variantTitle = cleanText(variant.title, 200);
    const name =
      variantTitle && variantTitle.toLowerCase() !== "default title"
        ? `${title} — ${variantTitle}`.slice(0, 250)
        : title;
    const productUrl = new URL(baseProductUrl);
    if (variantId) productUrl.searchParams.set("variant", variantId);
    const stableProductId =
      typeof product.id === "string" || typeof product.id === "number"
        ? String(product.id)
        : handle;
    const externalKey = externalKeyFor({
      externalKey: sku ?? `shopify:${stableProductId}:${variantId ?? index}`,
      sku,
      productUrl: productUrl.toString(),
      name,
    });
    return {
      vendorKey: vendor.key,
      externalKey,
      name,
      sku,
      category,
      description: stripProductHtml(product.body_html ?? product.description),
      productUrl: productUrl.toString(),
      imageUrl: firstSecureImage(product),
    };
  });
}

async function collectPublicVendorCatalog(vendor: VendorConfig) {
  if (!vendor.publicProductFeedUrl) {
    return {
      vendor,
      status: "search_only" as const,
      records: [] as CatalogFeedRecord[],
      message: "No verified public full-catalog feed is available; global supplier search remains available.",
    };
  }

  const records = new Map<string, CatalogFeedRecord>();
  const seenProducts = new Set<string>();
  let reachedEnd = false;
  for (let page = 1; page <= MAX_PUBLIC_FEED_PAGES; page += 1) {
    const products = await fetchShopifyProductPage(vendor, page);
    if (products.length === 0) {
      reachedEnd = true;
      break;
    }
    let newProducts = 0;
    for (const product of products) {
      const id =
        typeof product.id === "string" || typeof product.id === "number"
          ? String(product.id)
          : cleanText(product.handle, 300);
      if (id && seenProducts.has(id)) continue;
      if (id) seenProducts.add(id);
      newProducts += 1;
      for (const record of catalogRecordsFromShopifyProduct(vendor, product)) {
        records.set(record.externalKey, record);
      }
    }
    if (newProducts === 0) throw new Error("Product feed pagination repeated an earlier page.");
    if (products.length < SHOPIFY_PAGE_SIZE) {
      reachedEnd = true;
      break;
    }
  }
  return {
    vendor,
    status: reachedEnd ? ("synced" as const) : ("incomplete" as const),
    records: [...records.values()],
    message: reachedEnd
      ? "The public product feed was paginated to its end."
      : "The feed page limit was reached before its end; this catalog may be incomplete.",
  };
}

async function saveCatalogFeedRecords(records: CatalogFeedRecord[]) {
  if (records.length === 0) return { created: 0, updated: 0 };
  return withTransaction(async (client) => {
    let created = 0;
    let updated = 0;
    for (const record of records) {
      const saved = await upsertCatalogRecord(client, record);
      if (saved.created) created += 1;
      else updated += 1;
    }
    return { created, updated };
  });
}

router.get("/parts/dashboard", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [robotsResult, totalsResult] = await Promise.all([
      pool.query(
        `select "id", "name", "created_at" as "createdAt", "updated_at" as "updatedAt"
         from "parts_robots" order by lower("name")`,
      ),
      pool.query(
        `select
           (select count(*)::int from "parts_catalog_items") as "catalogItems",
           (select coalesce(sum("quantity_owned"), 0)::int from "parts_inventory") as "ownedUnits",
           (select coalesce(sum("quantity"), 0)::int from "parts_robot_allocations") as "assignedUnits"`,
      ),
    ]);
    const totals = totalsResult.rows[0];
    const ownedUnits = Number(totals.ownedUnits);
    const assignedUnits = Number(totals.assignedUnits);
    res.json(
      GetPartsDashboardResponse.parse({
        vendors: publicVendors,
        robots: robotsResult.rows.map(mapRobot),
        summary: {
          vendorCount: VENDORS.length,
          catalogItems: Number(totals.catalogItems),
          ownedUnits,
          assignedUnits,
          availableUnits: Math.max(0, ownedUnits - assignedUnits),
        },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Parts dashboard load failed");
    res.status(500).json({ error: "Unable to load the parts dashboard." });
  }
});

router.get("/parts/catalog", requireAdmin, async (req, res): Promise<void> => {
  try {
    const search = cleanText(req.query.search, 120);
    const vendorKey = cleanText(req.query.vendorKey, 100);
    if (vendorKey && !vendorByKey.has(vendorKey)) {
      res.status(400).json({ error: "Choose one of the listed vendors." });
      return;
    }
    const limitRaw = Number(req.query.limit);
    const offsetRaw = Number(req.query.offset);
    const limit = Number.isInteger(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 100;
    const offset = Number.isInteger(offsetRaw) ? Math.max(0, offsetRaw) : 0;
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (vendorKey) {
      values.push(vendorKey);
      clauses.push(`c."vendor_key" = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      clauses.push(`(c."name" ilike $${values.length} or coalesce(c."sku", '') ilike $${values.length})`);
    }
    const whereSql = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const [countResult, rows] = await Promise.all([
      pool.query(
        `select count(*)::int as "total" from "parts_catalog_items" c ${whereSql}`,
        values,
      ),
      queryCatalogRows(whereSql, values, limit, offset),
    ]);
    res.json(
      ListPartsCatalogResponse.parse({
        items: rows.map(mapCatalogRow),
        total: Number(countResult.rows[0].total),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Parts catalog load failed");
    res.status(500).json({ error: "Unable to load the parts catalog." });
  }
});

router.get("/parts/catalog/search", requireAdmin, async (req, res): Promise<void> => {
  const vendorKey = cleanText(req.query.vendorKey, 100);
  const query = cleanText(req.query.q, 120);
  if (!query || query.length < 2) {
    res.status(400).json({ error: "Enter at least two search characters." });
    return;
  }
  const vendor = vendorKey ? vendorByKey.get(vendorKey) : undefined;
  if (vendorKey && !vendor) {
    res.status(400).json({ error: "Choose one of the listed vendors." });
    return;
  }
  try {
    const results = await searchPublicCatalog(query, vendor);
    res.json(
      SearchPartsCatalogResponse.parse({
        query,
        results,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, vendorKey }, "Public supplier catalog search failed");
    res.status(502).json({
      error: "Keyless supplier search is temporarily unavailable. Try again shortly.",
    });
  }
});

router.post("/parts/catalog", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePartsCatalogItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The catalog item details are invalid." });
    return;
  }
  try {
    const input = parsed.data;
    const vendor = vendorForKey(input.vendorKey);
    const name = cleanText(input.name, 250);
    if (!name) throw new BadInputError("A part name is required.");
    const sku = cleanText(input.sku, 200);
    const productUrl = validateVendorUrl(input.productUrl, vendor);
    const imageUrl = validateImageUrl(input.imageUrl);
    const item = {
      vendorKey: vendor.key,
      externalKey: externalKeyFor({ sku, productUrl, name }),
      name,
      sku,
      category: cleanText(input.category, 200),
      description: cleanText(input.description, 1200),
      productUrl,
      imageUrl,
    };
    const itemId = await withTransaction(async (client) => {
      const saved = await upsertCatalogRecord(client, item);
      if (Object.prototype.hasOwnProperty.call(req.body, "quantityOwned")) {
        await setOwnedQuantity(client, saved.id, input.quantityOwned ?? 0);
      }
      return saved.id;
    });
    const savedItem = await getCatalogItem(itemId);
    res.status(201).json(CreatePartsCatalogItemResponse.parse(savedItem));
  } catch (error) {
    if (error instanceof BadInputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof StockConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Parts catalog item save failed");
    res.status(500).json({ error: "Unable to save the catalog item." });
  }
});

router.post("/parts/catalog/sync", requireAdmin, async (req, res): Promise<void> => {
  try {
    const collected = await Promise.all(
      VENDORS.map(async (vendor) => {
        try {
          return await collectPublicVendorCatalog(vendor);
        } catch (error) {
          req.log.warn({ err: error, vendorKey: vendor.key }, "Public product feed sync failed");
          return {
            vendor,
            status: "unavailable" as const,
            records: [] as CatalogFeedRecord[],
            message: "The public product feed could not be retrieved.",
          };
        }
      }),
    );
    const vendorResults: CatalogFeedSyncVendor[] = [];
    for (const collection of collected) {
      const counts =
        collection.status === "unavailable" || collection.status === "search_only"
          ? { created: 0, updated: 0 }
          : await saveCatalogFeedRecords(collection.records);
      vendorResults.push({
        vendorKey: collection.vendor.key,
        vendorName: collection.vendor.name,
        status: collection.status,
        itemCount: collection.records.length,
        created: counts.created,
        updated: counts.updated,
        source: collection.vendor.publicProductFeedUrl ?? null,
        message: collection.message,
      });
    }
    res.json(
      SyncPartsCatalogResponse.parse({
        vendors: vendorResults,
        totalItems: vendorResults.reduce((sum, item) => sum + item.itemCount, 0),
        created: vendorResults.reduce((sum, item) => sum + item.created, 0),
        updated: vendorResults.reduce((sum, item) => sum + item.updated, 0),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Public parts catalog synchronization failed");
    res.status(500).json({ error: "Unable to sync public supplier catalogs." });
  }
});

router.post("/parts/catalog/import", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ImportPartsCatalogBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The catalog import must contain between 1 and 500 valid rows." });
    return;
  }
  try {
    const counts = await withTransaction(async (client) => {
      let created = 0;
      let updated = 0;
      for (const row of parsed.data.items) {
        const vendor = vendorForKey(row.vendorKey);
        const name = cleanText(row.name, 250);
        if (!name) throw new BadInputError("Every imported row needs a part name.");
        const sku = cleanText(row.sku, 200);
        const productUrl = validateVendorUrl(row.productUrl, vendor);
        const imageUrl = validateImageUrl(row.imageUrl);
        const saved = await upsertCatalogRecord(client, {
          vendorKey: vendor.key,
          externalKey: externalKeyFor({
            externalKey: row.externalKey,
            sku,
            productUrl,
            name,
          }),
          name,
          sku,
          category: cleanText(row.category, 200),
          description: cleanText(row.description, 1200),
          productUrl,
          imageUrl,
        });
        if (saved.created) created += 1;
        else updated += 1;
        if (row.quantityOwned !== undefined) {
          await setOwnedQuantity(client, saved.id, row.quantityOwned);
        }
      }
      return { created, updated };
    });
    res.json(ImportPartsCatalogResponse.parse(counts));
  } catch (error) {
    if (error instanceof BadInputError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof StockConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Parts catalog import failed");
    res.status(500).json({ error: "Unable to import the catalog file." });
  }
});

router.patch("/parts/catalog/:partId/stock", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdatePartsCatalogStockParams.safeParse(req.params);
  const body = UpdatePartsCatalogStockBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "The stock quantity is invalid." });
    return;
  }
  try {
    const result = await withTransaction((client) =>
      setOwnedQuantity(client, params.data.partId, body.data.quantityOwned),
    );
    if (!result.exists) {
      res.status(404).json({ error: "Catalog item not found." });
      return;
    }
    const savedItem = await getCatalogItem(params.data.partId);
    res.json(UpdatePartsCatalogStockResponse.parse(savedItem));
  } catch (error) {
    if (error instanceof StockConflictError) {
      res.status(409).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Parts stock update failed");
    res.status(500).json({ error: "Unable to update stock." });
  }
});

router.post("/parts/robots", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePartsRobotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a robot name." });
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Enter a robot name." });
    return;
  }
  try {
    const result = await pool.query(
      `insert into "parts_robots" ("id", "name")
       values ($1, $2)
       returning "id", "name", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [randomUUID(), name],
    );
    res.status(201).json(CreatePartsRobotResponse.parse(mapRobot(result.rows[0])));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A robot with that name already exists." });
      return;
    }
    req.log.error({ err: error }, "Parts robot creation failed");
    res.status(500).json({ error: "Unable to add the robot." });
  }
});

router.patch("/parts/robots/:robotId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdatePartsRobotParams.safeParse(req.params);
  const body = UpdatePartsRobotBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "The robot name is invalid." });
    return;
  }
  const name = body.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Enter a robot name." });
    return;
  }
  try {
    const result = await pool.query(
      `update "parts_robots" set "name" = $2, "updated_at" = now()
       where "id" = $1
       returning "id", "name", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [params.data.robotId, name],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Robot not found." });
      return;
    }
    res.json(UpdatePartsRobotResponse.parse(mapRobot(result.rows[0])));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A robot with that name already exists." });
      return;
    }
    req.log.error({ err: error }, "Parts robot update failed");
    res.status(500).json({ error: "Unable to rename the robot." });
  }
});

router.put(
  "/parts/robots/:robotId/parts/:partId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetPartsRobotAllocationParams.safeParse(req.params);
    const body = SetPartsRobotAllocationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "The robot allocation is invalid." });
      return;
    }
    try {
      const allocation = await withTransaction(async (client) => {
        const robotResult = await client.query(
          `select "id", "name" from "parts_robots" where "id" = $1`,
          [params.data.robotId],
        );
        if (robotResult.rowCount === 0) return { missing: "robot" as const };
        const partResult = await client.query(
          `select c."id", coalesce(i."quantity_owned", 0)::int as "quantityOwned"
           from "parts_catalog_items" c
           left join "parts_inventory" i on i."part_id" = c."id"
           where c."id" = $1 for update of c`,
          [params.data.partId],
        );
        if (partResult.rowCount === 0) return { missing: "part" as const };
        const quantity = body.data.quantity;
        const otherAssignments = await client.query(
          `select coalesce(sum("quantity"), 0)::int as "quantity"
           from "parts_robot_allocations"
           where "part_id" = $1 and "robot_id" <> $2`,
          [params.data.partId, params.data.robotId],
        );
        const others = Number(otherAssignments.rows[0].quantity);
        const owned = Number(partResult.rows[0].quantityOwned);
        if (quantity + others > owned) {
          return { conflict: true as const, available: Math.max(0, owned - others) };
        }
        if (quantity === 0) {
          await client.query(
            `delete from "parts_robot_allocations"
             where "robot_id" = $1 and "part_id" = $2`,
            [params.data.robotId, params.data.partId],
          );
        } else {
          await client.query(
            `insert into "parts_robot_allocations" ("id", "robot_id", "part_id", "quantity")
             values ($1, $2, $3, $4)
             on conflict ("robot_id", "part_id") do update set
               "quantity" = excluded."quantity", "updated_at" = now()`,
            [randomUUID(), params.data.robotId, params.data.partId, quantity],
          );
        }
        return {
          robotId: params.data.robotId,
          robotName: String(robotResult.rows[0].name),
          partId: params.data.partId,
          quantity,
        };
      });
      if ("missing" in allocation) {
        res.status(404).json({
          error: allocation.missing === "robot" ? "Robot not found." : "Catalog item not found.",
        });
        return;
      }
      if ("conflict" in allocation) {
        res.status(409).json({
          error: `Only ${allocation.available} unassigned unit(s) are available.`,
        });
        return;
      }
      res.json(SetPartsRobotAllocationResponse.parse(allocation));
    } catch (error) {
      req.log.error({ err: error }, "Parts robot allocation update failed");
      res.status(500).json({ error: "Unable to update the robot allocation." });
    }
  },
);

function isUniqueViolation(error: unknown): boolean {
  return isRecord(error) && error.code === "23505";
}

export default router;