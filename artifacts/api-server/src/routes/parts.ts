import { randomUUID } from "node:crypto";
import express, { Router, type IRouter } from "express";
import {
  CreatePartsPriceSnapshotBody,
  CreatePartsPriceSnapshotParams,
  CreatePartsPriceSnapshotResponse,
  CreatePartsCatalogItemBody,
  CreatePartsCatalogItemResponse,
  CreatePartsRobotBody,
  CreatePartsRobotResponse,
  GetPartsDashboardResponse,
  GetPartsRobotDetailsParams,
  GetPartsRobotDetailsResponse,
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
  UpdatePartsCatalogCostBody,
  UpdatePartsCatalogCostParams,
  UpdatePartsCatalogCostResponse,
  UpdatePartsRobotBody,
  UpdatePartsRobotParams,
  UpdatePartsRobotResponse,
  UpdatePartsRobotPreviewBody,
  UpdatePartsRobotPreviewParams,
  UpdatePartsRobotPreviewResponse,
  type AssistantActivity,
  type PartsVendorSyncState,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/adminAuth";
import {
  fallbackProductSearchMetadata,
  extractProductPageMetadata,
  extractVerifiedProductMetadata,
} from "../lib/partsProductMetadata";
import {
  catalogSearchVariants,
  isRelevantCatalogSearchResult,
} from "../lib/partsSearchTerms";
import {
  defaultProductFeedUrl,
  publicVendors,
  VENDORS,
  vendorByKey,
  vendorOwnsHost,
  type VendorConfig,
} from "../lib/partsVendors";
import { logger } from "../lib/logger";
import {
  calculateLineTotal,
  isPriceSnapshotStale,
  isValidCurrencyCode,
  isValidMoneyAmount,
  moneyFromDatabase,
  summarizeSavedCosts,
} from "../lib/partsCosting";
import { partsPreviewKind } from "../lib/partsRobotPreview";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
type PoolClient = {
  query: (
    statement: string,
    values?: unknown[],
  ) => Promise<{ rows: Record<string, any>[]; rowCount: number | null }>;
  release: () => void;
};

class BadInputError extends Error {}
class StockConflictError extends Error {
  readonly allocated: number;

  constructor(allocated: number) {
    super("Owned stock cannot be lower than the quantity already assigned.");
    this.allocated = allocated;
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
    isManual: boolean;
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
       ("id", "vendor_key", "external_key", "name", "sku", "category", "description", "product_url", "image_url", "is_manual")
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     on conflict ("vendor_key", "external_key") do update set
       "name" = excluded."name",
       "sku" = coalesce(excluded."sku", "parts_catalog_items"."sku"),
       "category" = coalesce(excluded."category", "parts_catalog_items"."category"),
       "description" = coalesce(excluded."description", "parts_catalog_items"."description"),
       "product_url" = coalesce(excluded."product_url", "parts_catalog_items"."product_url"),
       "image_url" = coalesce(excluded."image_url", "parts_catalog_items"."image_url"),
       "is_manual" = "parts_catalog_items"."is_manual" or excluded."is_manual",
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
      input.isManual,
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

type RobotAllocationResult =
  | { robotId: string; robotName: string; partId: string; quantity: number }
  | { missing: "robot" | "part" }
  | { conflict: true; available: number };

async function saveRobotAllocation(
  robotId: string,
  partId: string,
  quantity: number,
): Promise<RobotAllocationResult> {
  return withTransaction(async (client) => {
    const robotResult = await client.query(
      `select "id", "name" from "parts_robots" where "id" = $1`,
      [robotId],
    );
    if (robotResult.rowCount === 0) return { missing: "robot" as const };
    const partResult = await client.query(
      `select c."id", coalesce(i."quantity_owned", 0)::int as "quantityOwned"
       from "parts_catalog_items" c
       left join "parts_inventory" i on i."part_id" = c."id"
       where c."id" = $1 for update of c`,
      [partId],
    );
    if (partResult.rowCount === 0) return { missing: "part" as const };
    const otherAssignments = await client.query(
      `select coalesce(sum("quantity"), 0)::int as "quantity"
       from "parts_robot_allocations"
       where "part_id" = $1 and "robot_id" <> $2`,
      [partId, robotId],
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
        [robotId, partId],
      );
    } else {
      await client.query(
        `insert into "parts_robot_allocations" ("id", "robot_id", "part_id", "quantity")
         values ($1, $2, $3, $4)
         on conflict ("robot_id", "part_id") do update set
           "quantity" = excluded."quantity", "updated_at" = now()`,
        [randomUUID(), robotId, partId, quantity],
      );
    }
    return {
      robotId,
      robotName: String(robotResult.rows[0].name),
      partId,
      quantity,
    };
  });
}

function isoDate(value: Date | string): string {
  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function mapRobot(row: Record<string, unknown>) {
  const objectPath = typeof row.previewObjectPath === "string" ? row.previewObjectPath : null;
  const fileName = typeof row.previewFileName === "string" ? row.previewFileName : null;
  const contentType = typeof row.previewContentType === "string" ? row.previewContentType : null;
  return {
    id: String(row.id),
    name: String(row.name),
    preview: objectPath && fileName && contentType
      ? { objectPath, fileName, contentType }
      : null,
    createdAt: isoDate(row.createdAt as Date | string),
    updatedAt: isoDate(row.updatedAt as Date | string),
  };
}

function mapCatalogRow(row: Record<string, unknown>) {
  const quantityOwned = Number(row.quantityOwned ?? 0);
  const quantityAssigned = Number(row.quantityAssigned ?? 0);
  const unitCost = moneyFromDatabase(row.unitCost);
  const costCurrency = unitCost !== null && isValidCurrencyCode(row.costCurrency)
    ? row.costCurrency
    : null;
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
    unitCost: costCurrency ? unitCost : null,
    costCurrency,
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
             c."image_url" as "imageUrl", c."unit_cost" as "unitCost",
             c."cost_currency" as "costCurrency", c."created_at" as "createdAt",
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
     order by c."updated_at" desc, lower(c."name"), c."id"
     limit $${values.length + 1} offset $${values.length + 2}`,
    [...values, limit, offset],
  );
  return result.rows;
}

async function searchSyncedCatalog(
  query: string,
  vendor: VendorConfig | undefined,
  limit: number,
  offset: number,
) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  if (vendor) {
    values.push(vendor.key);
    clauses.push(`c."vendor_key" = $${values.length}`);
  }
  const searchPatterns = catalogSearchVariants(query).map((term) => `%${term}%`);
  values.push(searchPatterns);
  const patternArray = `$${values.length}::text[]`;
  clauses.push(
    `(c."name" ilike any(${patternArray})
      or coalesce(c."sku", '') ilike any(${patternArray})
      or coalesce(c."category", '') ilike any(${patternArray})
      or coalesce(c."description", '') ilike any(${patternArray}))`,
  );
  const whereSql = `where ${clauses.join(" and ")}`;
  const [countResult, rows] = await Promise.all([
    pool.query(
      `select count(*)::int as "total" from "parts_catalog_items" c ${whereSql}`,
      values,
    ),
    queryCatalogRows(whereSql, values, limit, offset),
  ]);
  return {
    items: rows.map(mapCatalogRow),
    total: Number(countResult.rows[0].total),
    offset,
    limit,
  };
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

type PublicCatalogSearchCandidate = {
  vendorKey: string;
  vendorName: string;
  title: string;
  url: string;
  description: string;
};

type PublicCatalogSearchResult = PublicCatalogSearchCandidate & {
  title: string;
  description: string;
  sku: string | null;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
  priceIsStartingAt: boolean;
  inStock: boolean;
};

function fallbackOfficialProductResult(
  candidate: PublicCatalogSearchCandidate,
  vendor: VendorConfig,
): PublicCatalogSearchResult | null {
  if (
    vendor.catalogMode !== "products" ||
    vendor.coverageState === "access_restricted" ||
    vendor.coverageState === "custom_fabrication"
  ) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(candidate.url);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !vendorOwnsHost(url.hostname, vendor)) return null;

  const metadata = fallbackProductSearchMetadata(
    candidate.title,
    candidate.description,
    url.toString(),
  );
  if (!metadata || metadata.title.toLowerCase() === vendor.name.toLowerCase()) return null;
  return {
    vendorKey: vendor.key,
    vendorName: vendor.name,
    title: metadata.title,
    url: url.toString(),
    description: metadata.description,
    sku: null,
    imageUrl: null,
    price: null,
    currency: null,
    priceIsStartingAt: false,
    inStock: true,
  };
}

export const ASSISTANT_PARTS_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_supplier_parts",
        description: "Search live supplier pages and the synced catalog separately. Synced catalog matches are paginated with limit/offset and may not have verified live prices. Live discoveries require verified supplier-page details. The result includes each supplier's latest persisted sync status, checked time, and collected item count. A feed is complete only after sync confirms pagination reached its end.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 2, maxLength: 120 },
          vendorKey: { type: "string", maxLength: 100 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            offset: { type: "integer", minimum: 0 },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_parts_robots",
      description: "List the existing robots and IDs in the shared Parts workspace. Use this before assigning a part to a robot.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_parts_catalog",
      description: "List saved parts and inventory with exact part IDs, vendor, SKU, owned stock, allocations, and availability. Use this before editing stock or allocations.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", maxLength: 120 },
          vendorKey: { type: "string", maxLength: 100 },
          limit: { type: "integer", minimum: 1, maximum: 100 },
          offset: { type: "integer", minimum: 0 },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_parts_robot",
      description: "Add a robot to the shared Parts workspace after the user asks. Return the created robot and exact ID.",
      parameters: {
        type: "object",
        properties: { name: { type: "string", minLength: 1, maxLength: 80 } },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "rename_parts_robot",
      description: "Rename an existing robot using its exact ID from list_parts_robots.",
      parameters: {
        type: "object",
        properties: {
          robotId: { type: "string" },
          name: { type: "string", minLength: 1, maxLength: 80 },
        },
        required: ["robotId", "name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_parts_catalog_item",
      description: "Save a part to the shared catalog for a listed vendor. Use verified search result details when available; never invent a SKU, product page, image, or stock count. quantityOwned defaults to zero.",
      parameters: {
        type: "object",
        properties: {
          vendorKey: { type: "string", enum: VENDORS.map((item) => item.key) },
          name: { type: "string", minLength: 1, maxLength: 250 },
          sku: { type: ["string", "null"], maxLength: 200 },
          category: { type: ["string", "null"], maxLength: 200 },
          description: { type: ["string", "null"], maxLength: 1200 },
          productUrl: { type: ["string", "null"], maxLength: 2000 },
          imageUrl: { type: ["string", "null"], maxLength: 2000 },
          quantityOwned: { type: "integer", minimum: 0, maximum: 100000 },
        },
        required: ["vendorKey", "name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_parts_stock",
      description: "Set owned stock for a saved part using its exact ID. Do not reduce stock below parts already assigned to robots.",
      parameters: {
        type: "object",
        properties: {
          partId: { type: "string" },
          quantityOwned: { type: "integer", minimum: 0, maximum: 100000 },
        },
        required: ["partId", "quantityOwned"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_parts_robot_allocation",
      description: "Set the quantity of a saved part assigned to a robot. Use exact IDs from list_parts_catalog and list_parts_robots; zero removes the assignment. The server rejects quantities above available stock.",
      parameters: {
        type: "object",
        properties: {
          robotId: { type: "string" },
          partId: { type: "string" },
          quantity: { type: "integer", minimum: 0, maximum: 100000 },
        },
        required: ["robotId", "partId", "quantity"],
      },
    },
  },
] as const;

export const ASSISTANT_PARTS_TOOL_NAMES = new Set<string>(
  ASSISTANT_PARTS_TOOLS.map((tool) => tool.function.name),
);

function catalogVendorForUrl(url: URL, allowedVendors: VendorConfig[]) {
  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  return allowedVendors.find(
    (vendor) => hostname === vendor.domain || hostname.endsWith(`.${vendor.domain}`),
  );
}

function toPublicCatalogSearchResult(
  item: Record<string, unknown>,
  allowedVendors: VendorConfig[],
): PublicCatalogSearchCandidate | null {
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

function createSerializedSearchQueue(minimumIntervalMs: number) {
  let pending = Promise.resolve();
  let nextAllowedAt = 0;
  return function run<T>(operation: () => Promise<T>): Promise<T> {
    const result = pending.then(async () => {
      const waitMs = Math.max(0, nextAllowedAt - Date.now());
      if (waitMs > 0) {
        await new Promise<void>((resolve) => setTimeout(resolve, waitMs));
      }
      nextAllowedAt = Date.now() + minimumIntervalMs;
      return operation();
    });
    pending = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

const tavilySearchQueue = createSerializedSearchQueue(1_000);
const exaSearchQueue = createSerializedSearchQueue(1_000);

async function searchWithTavily(
  query: string,
  allowedVendors: VendorConfig[],
): Promise<PublicCatalogSearchCandidate[]> {
  const searchVariants = catalogSearchVariants(query);
  const expandedQuery = searchVariants.length > 1
    ? `${query} (also listed as ${searchVariants.slice(1).join(", ")})`
    : query;
  const response = await tavilySearchQueue(() =>
    fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "X-Tavily-Access-Mode": "keyless",
      },
      body: JSON.stringify({
        query: `Official supplier product pages matching: ${expandedQuery}`,
        search_depth: "basic",
        max_results: 20,
        include_domains: allowedVendors.map((vendor) => vendor.domain),
      }),
      signal: AbortSignal.timeout(10_000),
    }),
  );
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
  const results: PublicCatalogSearchCandidate[] = [];
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
): Promise<PublicCatalogSearchCandidate[]> {
  const vendorScope = allowedVendors.map((vendor) => `${vendor.name} (${vendor.domain})`).join("; ");
  const searchVariants = catalogSearchVariants(query);
  const expandedQuery = searchVariants.length > 1
    ? `${query} (also listed as ${searchVariants.slice(1).join(", ")})`
    : query;
  const response = await exaSearchQueue(() =>
    fetch("https://mcp.exa.ai/mcp?tools=web_search_exa", {
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
            query: `Official supplier product pages matching "${expandedQuery}" from ${vendorScope}`,
            objective:
              "Return relevant product or catalog pages hosted on the listed suppliers' own domains. Exclude third-party stores and unrelated pages.",
            numResults: 30,
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    }),
  );
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

async function enrichOfficialProductPage(
  candidate: PublicCatalogSearchCandidate,
  includePartialDetails = false,
): Promise<PublicCatalogSearchResult | null> {
  const vendor = vendorByKey.get(candidate.vendorKey);
  if (!vendor) return null;
  const searchFallback = includePartialDetails
    ? fallbackOfficialProductResult(candidate, vendor)
    : null;
  let target: URL;
  try {
    target = new URL(candidate.url);
  } catch {
    return null;
  }

  for (let redirect = 0; redirect < 4; redirect += 1) {
    if (
      target.protocol !== "https:" ||
      target.username ||
      target.password ||
      !vendorOwnsHost(target.hostname, vendor)
    ) {
      return null;
    }
    let response: Response;
    try {
      response = await fetch(target, {
        headers: { accept: "text/html,application/xhtml+xml" },
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      return searchFallback;
    }
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      try {
        target = new URL(location, target);
      } catch {
        return null;
      }
      continue;
    }
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (response.status === 403 || response.status === 429 || response.status >= 500) {
      return searchFallback;
    }
    if (!response.ok || !(contentType.includes("text/html") || contentType.includes("application/xhtml+xml"))) {
      return null;
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 2_000_000) return searchFallback;
    let html: string;
    try {
      html = await response.text();
    } catch {
      return searchFallback;
    }
    if (new TextEncoder().encode(html).byteLength > 2_000_000) return searchFallback;
    const metadata = includePartialDetails
      ? extractProductPageMetadata(html, target.toString(), candidate.title)
      : extractVerifiedProductMetadata(html, target.toString(), candidate.title);
    if (!metadata) return searchFallback;
    return {
      vendorKey: vendor.key,
      vendorName: vendor.name,
      title: metadata.title,
      url: target.toString(),
      description: metadata.description,
      sku: metadata.sku,
      imageUrl: metadata.imageUrl,
      price: metadata.price,
      currency: metadata.currency,
      priceIsStartingAt: metadata.priceIsStartingAt,
      inStock: metadata.inStock,
    };
  }
  return null;
}

async function searchPublicCatalog(
  query: string,
  vendor?: VendorConfig,
  options: { maxCandidatesPerVendor?: number; includePartialDetails?: boolean } = {},
) {
  const allowedVendors = (vendor ? [vendor] : VENDORS).filter(
    (item) => item.coverageState !== "access_restricted",
  );
  if (allowedVendors.length === 0) return [];
  const vendorGroups: VendorConfig[][] = [];
  for (let index = 0; index < allowedVendors.length; index += 4) {
    vendorGroups.push(allowedVendors.slice(index, index + 4));
  }
  const focusedTavilyVendors = vendor
    ? allowedVendors
    : allowedVendors.filter((item) => item.publicProductFeedUrl);
  const providerRequests = options.includePartialDetails
    ? [
        ...vendorGroups.map((group) => searchWithExa(query, group)),
        ...focusedTavilyVendors.map((item) => searchWithTavily(query, [item])),
      ]
    : vendorGroups.flatMap((group) => [
      searchWithTavily(query, group),
      searchWithExa(query, group),
    ]);
  const providerResults = await Promise.allSettled(providerRequests);
  const combined = providerResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  if (providerResults.every((result) => result.status === "rejected")) {
    throw new Error("All keyless catalog search providers are unavailable.");
  }

  const seen = new Set<string>();
  const byVendor = new Map(allowedVendors.map((item) => [item.key, [] as PublicCatalogSearchCandidate[]]));
  for (const result of combined) {
    if (!isRelevantCatalogSearchResult(query, result.title, result.description)) continue;
    const parsedUrl = new URL(result.url);
    const key = `${result.vendorKey}:${parsedUrl.origin}${parsedUrl.pathname}`.toLowerCase();
    const bucket = byVendor.get(result.vendorKey);
    if (!bucket || seen.has(key)) continue;
    seen.add(key);
    bucket.push(result);
  }
  const candidates: PublicCatalogSearchCandidate[] = [];
  const candidatesPerVendor = options.maxCandidatesPerVendor ?? 8;
  for (let rank = 0; rank < candidatesPerVendor; rank += 1) {
    for (const allowedVendor of allowedVendors) {
      const candidate = byVendor.get(allowedVendor.key)?.[rank];
      if (candidate) candidates.push(candidate);
    }
  }

  const verifiedResults: PublicCatalogSearchResult[] = [];
  for (let index = 0; index < candidates.length; index += 12) {
    const batch = await Promise.allSettled(
      candidates
        .slice(index, index + 12)
        .map((candidate) => enrichOfficialProductPage(candidate, options.includePartialDetails)),
    );
    for (const result of batch) {
      if (
        result.status === "fulfilled" &&
        result.value &&
        isRelevantCatalogSearchResult(query, result.value.title, result.value.description)
      ) {
        verifiedResults.push(result.value);
      }
    }
  }
  return verifiedResults;
}

export async function runAssistantPartsTool(
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: string; activity: AssistantActivity }> {
  const result = (content: string, detail: string) => ({
    content,
    activity: { tool: name, detail: detail.slice(0, 160) },
  });
  try {
    if (name === "search_supplier_parts") {
      const query = cleanText(args.query, 120);
      const vendorKey = cleanText(args.vendorKey, 100);
      if (!query || query.length < 2) return result("Use at least two search characters.", "invalid search");
      if (vendorKey && !vendorByKey.has(vendorKey)) return result("Unsupported supplier.", "unknown vendor");
      const vendor = vendorKey ? vendorByKey.get(vendorKey) : undefined;
      const limitValue = Number(args.limit);
      const offsetValue = Number(args.offset);
      const limit = Number.isInteger(limitValue) ? Math.min(100, Math.max(1, limitValue)) : 50;
      const offset = Number.isInteger(offsetValue) ? Math.max(0, offsetValue) : 0;
      const syncedCatalog = await searchSyncedCatalog(query, vendor, limit, offset);
      let products: PublicCatalogSearchResult[] = [];
      let liveSearchStatus: "available" | "unavailable" = "available";
      try {
        products = await searchPublicCatalog(query, vendor);
      } catch {
        liveSearchStatus = "unavailable";
      }
      const items = products.slice(0, 18).map((item) => ({
        vendorKey: item.vendorKey,
        vendorName: item.vendorName,
        title: item.title,
        url: item.url,
        sku: item.sku,
        description: item.description,
        imageUrl: item.imageUrl,
        price: item.price,
        currency: item.currency,
        priceIsStartingAt: item.priceIsStartingAt,
        inStock: item.inStock,
      }));
      const syncStates = await readPartsSupplierSyncStates();
      const coverage = publicVendors.map((item) => ({
        vendorKey: item.key,
        vendorName: item.name,
        catalogSourceUrl: item.catalogSourceUrl,
        coverageState: item.coverageState,
        feedMustReachEndBeforeComplete: item.coverageState === "feed_sync_required",
        lastSync: syncStates.get(item.key) ?? null,
      }));
      return result(
        JSON.stringify({
          query,
          catalogIsExhaustive: false,
          liveSearchStatus,
          syncedCatalog,
          vendorCoverage: coverage,
          results: items,
        }),
        `${syncedCatalog.total} indexed match(es), ${items.length} live discovery result(s)`,
      );
    }
    if (name === "list_parts_robots") {
      const rows = await pool.query(
        `select "id", "name", "preview_object_path" as "previewObjectPath",
                "preview_file_name" as "previewFileName",
                "preview_content_type" as "previewContentType",
                "created_at" as "createdAt", "updated_at" as "updatedAt"
         from "parts_robots" order by lower("name")`,
      );
      const robots = rows.rows.map(mapRobot);
      return result(JSON.stringify({ robots }), `${robots.length} robot(s)`);
    }
    if (name === "list_parts_catalog") {
      const vendorKey = cleanText(args.vendorKey, 100);
      if (vendorKey && !vendorByKey.has(vendorKey)) return result("Unsupported supplier.", "unknown vendor");
      const search = cleanText(args.search, 120);
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
      const limitValue = Number(args.limit);
      const offsetValue = Number(args.offset);
      const limit = Number.isInteger(limitValue) ? Math.min(100, Math.max(1, limitValue)) : 30;
      const offset = Number.isInteger(offsetValue) ? Math.max(0, offsetValue) : 0;
      const rows = await queryCatalogRows(clauses.length ? `where ${clauses.join(" and ")}` : "", values, limit, offset);
      const items = rows.map(mapCatalogRow);
      return result(JSON.stringify({ offset, limit, items }), `${items.length} part(s)`);
    }
    if (name === "create_parts_robot") {
      const parsed = CreatePartsRobotBody.safeParse({ name: args.name });
      if (!parsed.success || !parsed.data.name.trim()) return result("Enter a valid robot name.", "invalid robot name");
      const rows = await pool.query(
        `insert into "parts_robots" ("id", "name") values ($1, $2)
         returning "id", "name", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
        [randomUUID(), parsed.data.name.trim()],
      );
      const robot = mapRobot(rows.rows[0]);
      return result(JSON.stringify({ created: true, robot }), `added ${robot.name}`);
    }
    if (name === "rename_parts_robot") {
      const params = UpdatePartsRobotParams.safeParse({ robotId: args.robotId });
      const body = UpdatePartsRobotBody.safeParse({ name: args.name });
      if (!params.success || !body.success || !body.data.name.trim()) return result("A valid robot ID and name are required.", "invalid rename");
      const rows = await pool.query(
        `update "parts_robots" set "name" = $2, "updated_at" = now() where "id" = $1
         returning "id", "name", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
        [params.data.robotId, body.data.name.trim()],
      );
      if (!rows.rowCount) return result("Robot not found; no change was made.", "robot not found");
      const robot = mapRobot(rows.rows[0]);
      return result(JSON.stringify({ renamed: true, robot }), `renamed ${robot.name}`);
    }
    if (name === "create_parts_catalog_item") {
      const parsed = CreatePartsCatalogItemBody.safeParse(args);
      if (!parsed.success) return result("Part details are invalid; provide a supported vendor and name.", "invalid part");
      const input = parsed.data;
      const vendor = vendorForKey(input.vendorKey);
      const partName = cleanText(input.name, 250);
      if (!partName) return result("A part name is required.", "missing name");
      const sku = cleanText(input.sku, 200);
      const productUrl = validateVendorUrl(input.productUrl, vendor);
      const imageUrl = validateImageUrl(input.imageUrl);
      const saved = await withTransaction(async (client) => {
        const item = await upsertCatalogRecord(client, {
          vendorKey: vendor.key,
          externalKey: externalKeyFor({ sku, productUrl, name: partName }),
          name: partName,
          sku,
          category: cleanText(input.category, 200),
          description: cleanText(input.description, 1200),
          productUrl,
          imageUrl,
          isManual: true,
        });
        if (input.quantityOwned !== undefined) await setOwnedQuantity(client, item.id, input.quantityOwned);
        return item;
      });
      const item = await getCatalogItem(saved.id);
      if (!item) return result("The saved item could not be reloaded; check the catalog before retrying.", "reload failed");
      return result(JSON.stringify({ created: saved.created, item }), `${saved.created ? "added" : "updated"} ${item.name}`);
    }
    if (name === "update_parts_stock") {
      const params = UpdatePartsCatalogStockParams.safeParse({ partId: args.partId });
      const body = UpdatePartsCatalogStockBody.safeParse({ quantityOwned: args.quantityOwned });
      if (!params.success || !body.success) return result("Use a valid part ID and non-negative whole-number quantity.", "invalid stock");
      const update = await withTransaction((client) => setOwnedQuantity(client, params.data.partId, body.data.quantityOwned));
      if (!update.exists) return result("Part not found; no stock was changed.", "part not found");
      const item = await getCatalogItem(params.data.partId);
      return result(JSON.stringify({ updated: true, item }), `stock updated: ${item?.name ?? params.data.partId}`);
    }
    if (name === "set_parts_robot_allocation") {
      const params = SetPartsRobotAllocationParams.safeParse({ robotId: args.robotId, partId: args.partId });
      const body = SetPartsRobotAllocationBody.safeParse({ quantity: args.quantity });
      if (!params.success || !body.success) return result("Use valid robot/part IDs and a non-negative whole-number quantity.", "invalid allocation");
      const allocation = await saveRobotAllocation(params.data.robotId, params.data.partId, body.data.quantity);
      if ("missing" in allocation) return result(`${allocation.missing} not found; no change was made.`, `${allocation.missing} not found`);
      if ("conflict" in allocation) return result(`Only ${allocation.available} unassigned unit(s) are available; no change was made.`, "insufficient stock");
      return result(JSON.stringify({ updated: true, allocation }), `${allocation.robotName}: ${allocation.quantity} assigned`);
    }
    return result("Unsupported Parts operation.", "unsupported operation");
  } catch (error) {
    if (error instanceof BadInputError || error instanceof StockConflictError) return result(`${error.message} No change was made.`, "request rejected");
    if (isUniqueViolation(error)) {
      return name === "create_parts_robot" || name === "rename_parts_robot"
        ? result("A robot with that name already exists.", "duplicate robot")
        : result("A matching catalog entry already exists; no change was confirmed.", "duplicate catalog item");
    }
    logger.error({ err: error, tool: name }, "Assistant Parts operation failed");
    return result("The operation failed and success was not confirmed. Refresh Parts and try again.", "operation failed");
  }
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
  status: PartsVendorSyncState["status"];
  checkedAt: Date;
  itemCount: number;
  created: number;
  updated: number;
  source: string;
  message: string;
};

async function readPartsSupplierSyncStates() {
  const result = await pool.query(
    `select "vendor_key" as "vendorKey", "status", "checked_at" as "checkedAt",
            "item_count" as "itemCount", "source", "message"
     from "parts_supplier_sync_states"`,
  );
  return new Map<string, PartsVendorSyncState>(
    result.rows.map((row) => [
      String(row.vendorKey),
      {
        status: String(row.status) as PartsVendorSyncState["status"],
        checkedAt: row.checkedAt instanceof Date
          ? row.checkedAt
          : new Date(String(row.checkedAt)),
        itemCount: Number(row.itemCount),
        source: String(row.source),
        message: String(row.message),
      },
    ]),
  );
}

async function savePartsSupplierSyncState(
  vendorKey: string,
  state: PartsVendorSyncState,
) {
  await pool.query(
    `insert into "parts_supplier_sync_states"
       ("vendor_key", "status", "checked_at", "item_count", "source", "message")
     values ($1, $2, $3, $4, $5, $6)
     on conflict ("vendor_key") do update set
       "status" = excluded."status",
       "checked_at" = excluded."checked_at",
       "item_count" = excluded."item_count",
       "source" = excluded."source",
       "message" = excluded."message"
     where "parts_supplier_sync_states"."checked_at" <= excluded."checked_at"`,
    [
      vendorKey,
      state.status,
      state.checkedAt,
      state.itemCount,
      state.source,
      state.message,
    ],
  );
}

const SHOPIFY_PAGE_SIZE = 250;
const MAX_PUBLIC_FEED_PAGES = 50;

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
  const feedUrl = defaultProductFeedUrl(vendor);
  const feedVendor = { ...vendor, publicProductFeedUrl: feedUrl };
  let firstPage: Record<string, unknown>[] | null = null;

  if (!vendor.publicProductFeedUrl) {
    try {
      firstPage = await fetchShopifyProductPage(feedVendor, 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const noPublicFeed =
        /Product feed returned (401|403|404|405|406|410)\./.test(message) ||
        /did not return a Shopify product list|redirected outside the supplier website|invalid JSON/i.test(message) ||
        error instanceof SyntaxError;
      return {
        vendor,
        status: noPublicFeed ? ("search_only" as const) : ("unavailable" as const),
        source: feedUrl,
        records: [] as CatalogFeedRecord[],
        message: noPublicFeed
          ? "No supplier-owned public Shopify catalog feed is available; global supplier search remains available."
          : "The supplier's standard public catalog endpoint could not be checked; global supplier search remains available.",
      };
    }
  }

  const records = new Map<string, CatalogFeedRecord>();
  const seenProducts = new Set<string>();
  let reachedEnd = false;
  const partialCollection = (message: string) => ({
    vendor: feedVendor,
    status: "incomplete" as const,
    source: feedUrl,
    records: [...records.values()],
    message,
  });
  for (let page = 1; page <= MAX_PUBLIC_FEED_PAGES; page += 1) {
    let products: Record<string, unknown>[];
    try {
      products = page === 1 && firstPage !== null
        ? firstPage
        : await fetchShopifyProductPage(feedVendor, page);
    } catch {
      if (records.size > 0) {
        return partialCollection("Pagination stopped early; the collected records were retained.");
      }
      throw new Error("The public product feed stopped before returning catalog records.");
    }
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
      for (const record of catalogRecordsFromShopifyProduct(feedVendor, product)) {
        records.set(record.externalKey, record);
      }
    }
    if (newProducts === 0) {
      if (records.size > 0) {
        return partialCollection("Pagination repeated an earlier page; the collected records were retained.");
      }
      throw new Error("Product feed pagination repeated an earlier page.");
    }
    if (products.length < SHOPIFY_PAGE_SIZE) {
      reachedEnd = true;
      break;
    }
  }
  return {
    vendor: feedVendor,
    status: reachedEnd ? ("synced" as const) : ("incomplete" as const),
    source: feedUrl,
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
    const batchSize = 500;
    for (let start = 0; start < records.length; start += batchSize) {
      const batch = records.slice(start, start + batchSize);
      const values: unknown[] = [];
      const rows = batch.map((record, index) => {
        const offset = index * 10;
        values.push(
          randomUUID(),
          record.vendorKey,
          record.externalKey,
          record.name,
          record.sku,
          record.category,
          record.description,
          record.productUrl,
          record.imageUrl,
          false,
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`;
      });
      const saved = await client.query(
        `insert into "parts_catalog_items"
           ("id", "vendor_key", "external_key", "name", "sku", "category", "description", "product_url", "image_url", "is_manual")
         values ${rows.join(", ")}
         on conflict ("vendor_key", "external_key") do update set
           "name" = excluded."name",
           "sku" = coalesce(excluded."sku", "parts_catalog_items"."sku"),
           "category" = coalesce(excluded."category", "parts_catalog_items"."category"),
           "description" = coalesce(excluded."description", "parts_catalog_items"."description"),
           "product_url" = coalesce(excluded."product_url", "parts_catalog_items"."product_url"),
           "image_url" = coalesce(excluded."image_url", "parts_catalog_items"."image_url"),
           "is_manual" = "parts_catalog_items"."is_manual" or excluded."is_manual",
           "updated_at" = now()
         returning "id", (xmax = 0) as "created"`,
        values,
      );
      for (const row of saved.rows) {
        if (row.created === true) created += 1;
        else updated += 1;
      }
      if (saved.rows.length > 0) {
        const inventoryValues: unknown[] = [];
        const inventoryRows = saved.rows.map((row, index) => {
          inventoryValues.push(String(row.id), 0);
          return `($${index * 2 + 1}, $${index * 2 + 2})`;
        });
        await client.query(
          `insert into "parts_inventory" ("part_id", "quantity_owned")
           values ${inventoryRows.join(", ")}
           on conflict ("part_id") do nothing`,
          inventoryValues,
        );
      }
    }
    return { created, updated };
  });
}

router.get("/parts/dashboard", requireAdmin, async (req, res): Promise<void> => {
  try {
    const [robotsResult, totalsResult, syncStates] = await Promise.all([
      pool.query(
        `select "id", "name", "preview_object_path" as "previewObjectPath",
                "preview_file_name" as "previewFileName",
                "preview_content_type" as "previewContentType",
                "created_at" as "createdAt", "updated_at" as "updatedAt"
         from "parts_robots" order by lower("name")`,
      ),
      pool.query(
        `select
           (select count(*)::int from "parts_catalog_items") as "catalogItems",
           (select coalesce(sum("quantity_owned"), 0)::int from "parts_inventory") as "ownedUnits",
           (select coalesce(sum("quantity"), 0)::int from "parts_robot_allocations") as "assignedUnits"`,
      ),
      readPartsSupplierSyncStates(),
    ]);
    const totals = totalsResult.rows[0];
    const ownedUnits = Number(totals.ownedUnits);
    const assignedUnits = Number(totals.assignedUnits);
    res.json(
      GetPartsDashboardResponse.parse({
        vendors: publicVendors.map((vendor) => ({
          ...vendor,
          lastSync: syncStates.get(vendor.key) ?? null,
        })),
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
        const vendorKey = String(row.vendorKey);
    if (vendorKey && !vendorByKey.has(vendorKey)) {
      res.status(400).json({ error: "Choose one of the listed vendors." });
      return;
    }
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isInteger(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 100;
  const offset = Number.isInteger(offsetRaw) ? Math.max(0, offsetRaw) : 0;
    const manualOnly = req.query.manualOnly === "true" || req.query.manualOnly === "1";
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (manualOnly) {
      clauses.push(`c."is_manual" = true`);
    }
    if (vendorKey) {
      values.push(vendorKey);
      clauses.push(`c."vendor_key" = $${values.length}`);
    }
    if (search) {
      const searchPatterns = catalogSearchVariants(search).map((term) => `%${term}%`);
      values.push(searchPatterns);
      const patternArray = `$${values.length}::text[]`;
      clauses.push(
        `(c."name" ilike any(${patternArray})
          or coalesce(c."sku", '') ilike any(${patternArray})
          or coalesce(c."category", '') ilike any(${patternArray})
          or coalesce(c."description", '') ilike any(${patternArray}))`,
      );
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
        const vendorKey = String(row.vendorKey);
  const query = cleanText(req.query.q, 120);
  if (!query || query.length < 2) {
    res.status(400).json({ error: "Enter at least two search characters." });
    return;
  }
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isInteger(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 100;
  const offset = Number.isInteger(offsetRaw) ? Math.max(0, offsetRaw) : 0;
        const vendor = vendorByKey.get(vendorKey);
  if (vendorKey && !vendor) {
    res.status(400).json({ error: "Choose one of the listed vendors." });
    return;
  }
  try {
    const syncedCatalog = await searchSyncedCatalog(query, vendor, limit, offset);
    let results: PublicCatalogSearchResult[] = [];
    let liveSearchStatus: "available" | "unavailable" = "available";
    try {
      results = await searchPublicCatalog(query, vendor, {
        maxCandidatesPerVendor: 40,
        includePartialDetails: true,
      });
    } catch (error) {
      if (syncedCatalog.total === 0) throw error;
      liveSearchStatus = "unavailable";
    }
    res.json(
      SearchPartsCatalogResponse.parse({
        query,
        results,
        catalogItems: syncedCatalog.items,
        catalogTotal: syncedCatalog.total,
        catalogOffset: syncedCatalog.offset,
        catalogLimit: syncedCatalog.limit,
        liveSearchStatus,
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
  const parsed = CreatePartsRobotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The catalog item details are invalid." });
    return;
  }
  try {
    const input = parsed.data;
        const vendor = vendorByKey.get(vendorKey);
  const name = body.data.name.trim();
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
      isManual: true,
    };
    const itemId = await withTransaction(async (client) => {
      const saved = await upsertCatalogRecord(client, item);
      if (Object.prototype.hasOwnProperty.call(req.body, "quantityOwned")) {
        await setOwnedQuantity(client, saved.id, input.quantityOwned ?? 0);
      }
      return saved.id;
    });
    const savedItem = await getCatalogItem(params.data.partId);
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

export async function syncPublicPartsCatalogs() {
  const vendorResults = new Array<CatalogFeedSyncVendor>(VENDORS.length);
  let nextVendorIndex = 0;

  const syncVendor = async (index: number) => {
    const vendor = VENDORS[index];
    let collection: Awaited<ReturnType<typeof collectPublicVendorCatalog>>;
    try {
      collection = await collectPublicVendorCatalog(vendor);
    } catch (error) {
      logger.warn({ err: error, vendorKey: vendor.key }, "Public product feed sync failed");
      collection = {
        vendor,
        status: "unavailable",
        source: defaultProductFeedUrl(vendor),
        records: [],
        message: "The public product feed could not be retrieved.",
      };
    }
    const counts =
      collection.status === "unavailable" || collection.status === "search_only"
        ? { created: 0, updated: 0 }
        : await saveCatalogFeedRecords(collection.records);
    vendorResults[index] = {
      vendorKey: collection.vendor.key,
      vendorName: collection.vendor.name,
      status: collection.status,
      checkedAt: new Date(),
      itemCount: collection.records.length,
      created: counts.created,
      updated: counts.updated,
      source: collection.source,
      message: collection.message,
    };
    await savePartsSupplierSyncState(collection.vendor.key, {
      status: vendorResults[index].status,
      checkedAt: vendorResults[index].checkedAt,
      itemCount: vendorResults[index].itemCount,
      source: vendorResults[index].source,
      message: vendorResults[index].message,
    });
    logger.info(
      {
        vendorKey: collection.vendor.key,
        status: collection.status,
        checkedAt: vendorResults[index].checkedAt,
        itemCount: collection.records.length,
        created: counts.created,
        updated: counts.updated,
      },
      "Public supplier catalog processed",
    );
  };

  const worker = async () => {
    while (true) {
      const index = nextVendorIndex++;
      if (index >= VENDORS.length) return;
      await syncVendor(index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(4, VENDORS.length) }, () => worker()),
  );

  return SyncPartsCatalogResponse.parse({
    vendors: vendorResults,
    totalItems: vendorResults.reduce((sum, item) => sum + item.itemCount, 0),
    created: vendorResults.reduce((sum, item) => sum + item.created, 0),
    updated: vendorResults.reduce((sum, item) => sum + item.updated, 0),
  });
}

router.post("/parts/catalog/sync", requireAdmin, async (req, res): Promise<void> => {
  try {
    res.json(await syncPublicPartsCatalogs());
  } catch (error) {
    req.log.error({ err: error }, "Public parts catalog synchronization failed");
    res.status(500).json({ error: "Unable to sync public supplier catalogs." });
  }
});

router.post("/parts/catalog/import", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePartsRobotBody.safeParse(req.body);
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
          isManual: true,
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
    const params = SetPartsRobotAllocationParams.safeParse(req.params);
    const body = SetPartsRobotAllocationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "The stock quantity is invalid." });
    return;
  }
  try {
    const result = await pool.query(
      `update "parts_robots" set "name" = $2, "updated_at" = now()
       where "id" = $1
       returning "id", "name", "preview_object_path" as "previewObjectPath",
                 "preview_file_name" as "previewFileName",
                 "preview_content_type" as "previewContentType",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [params.data.robotId, name],
    );
    if (!result.exists) {
      res.status(404).json({ error: "Catalog item not found." });
      return;
    }
    const savedItem = await getCatalogItem(params.data.partId);
    res.json(UpdatePartsCatalogCostResponse.parse(savedItem));
  } catch (error) {
    req.log.error({ err: error }, "Parts saved cost update failed");
    res.status(500).json({ error: "Unable to update the saved unit cost." });
  }
});

router.post(
  "/parts/catalog/:partId/price-snapshots",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetPartsRobotAllocationParams.safeParse(req.params);
    const body = SetPartsRobotAllocationBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "The saved unit cost is invalid." });
    return;
  }
  const { unitCost, costCurrency } = body.data;
  if (
    (unitCost === null) !== (costCurrency === null) ||
    (unitCost !== null && !isValidMoneyAmount(unitCost)) ||
    (costCurrency !== null && !isValidCurrencyCode(costCurrency))
  ) {
    res.status(400).json({ error: "Enter both a valid amount and a three-letter currency, or clear both." });
    return;
  }
  try {
    const updated = await pool.query(
      `update "parts_catalog_items"
       set "unit_cost" = $2, "cost_currency" = $3, "updated_at" = now()
       where "id" = $1
       returning "id"`,
      [params.data.partId, unitCost, costCurrency],
    );
    if (updated.rowCount === 0) {
      res.status(404).json({ error: "Catalog item not found." });
      return;
    }
    const savedItem = await getCatalogItem(params.data.partId);
    res.json(UpdatePartsCatalogCostResponse.parse(savedItem));
  } catch (error) {
    req.log.error({ err: error }, "Parts saved cost update failed");
    res.status(500).json({ error: "Unable to update the saved unit cost." });
  }
});

router.post(
  "/parts/catalog/:partId/price-snapshots",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetPartsRobotAllocationParams.safeParse(req.params);
    const body = SetPartsRobotAllocationBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "The supplier quote details are invalid." });
      return;
    }
    try {
      const partResult = await pool.query(
        `select "vendor_key" as "vendorKey" from "parts_catalog_items" where "id" = $1`,
        [params.data.partId],
      );
      if (partResult.rowCount === 0) {
        res.status(404).json({ error: "Catalog item not found." });
        return;
      }
        const vendorKey = String(row.vendorKey);
        const vendor = vendorByKey.get(vendorKey);
      const sourceUrl = validateVendorUrl(body.data.sourceUrl, vendor);
      if (!sourceUrl || !isValidCurrencyCode(body.data.currency) || !isValidMoneyAmount(body.data.unitPrice)) {
        res.status(400).json({ error: "Choose a valid price, currency, and source on the item's supplier domain." });
        return;
      }
      const saved = await pool.query(
        `insert into "parts_supplier_price_snapshots"
           ("id", "part_id", "unit_price", "currency", "source_url", "is_starting_at")
         values ($1, $2, $3, $4, $5, $6)
         returning "id", "part_id" as "partId", "unit_price" as "unitPrice",
                   "currency", "source_url" as "sourceUrl",
                   "captured_at" as "capturedAt", "is_starting_at" as "isStartingAt"`,
        [
          randomUUID(),
          params.data.partId,
          body.data.unitPrice,
          body.data.currency,
          sourceUrl,
          body.data.isStartingAt,
        ],
      );
      const row = saved.rows[0];
      res.status(201).json(CreatePartsPriceSnapshotResponse.parse({
        id: String(row.id),
        partId: String(row.partId),
        vendorKey,
        vendorName: vendor.name,
        sourceUrl: String(row.sourceUrl),
        unitPrice: moneyFromDatabase(row.unitPrice),
        currency: String(row.currency),
        capturedAt: isoDate(row.capturedAt as Date | string),
        isStartingAt: Boolean(row.isStartingAt),
        isStale: false,
      }));
    } catch (error) {
      if (error instanceof BadInputError) {
        res.status(400).json({ error: error.message });
        return;
      }
      req.log.error({ err: error }, "Supplier quote snapshot save failed");
      res.status(500).json({ error: "Unable to save the supplier quote snapshot." });
    }
  },
);

router.get(
  "/parts/robots/:robotId/details",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = SetPartsRobotAllocationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "The robot ID is invalid." });
      return;
    }
    try {
      const robotResult = await pool.query(
        `select "id", "name", "preview_object_path" as "previewObjectPath",
                "preview_file_name" as "previewFileName",
                "preview_content_type" as "previewContentType",
                "created_at" as "createdAt", "updated_at" as "updatedAt"
         from "parts_robots" where "id" = $1`,
        [params.data.robotId],
      );
      if (robotResult.rowCount === 0) {
        res.status(404).json({ error: "Robot not found." });
        return;
      }
      const allocationResult = await pool.query(
        `select c."id" as "partId", c."name", c."vendor_key" as "vendorKey",
                c."sku", c."product_url" as "productUrl",
                c."unit_cost" as "unitCost", c."cost_currency" as "costCurrency",
                a."quantity"
         from "parts_robot_allocations" a
         join "parts_catalog_items" c on c."id" = a."part_id"
         where a."robot_id" = $1
         order by lower(c."name"), c."id"`,
        [params.data.robotId],
      );
      const partIds = allocationResult.rows.map((row) => String(row.partId));
      const snapshotResult = partIds.length === 0
        ? { rows: [] as Record<string, any>[] }
        : await pool.query(
            `select s."id", s."part_id" as "partId", s."unit_price" as "unitPrice",
                    s."currency", s."source_url" as "sourceUrl",
                    s."captured_at" as "capturedAt",
                    s."is_starting_at" as "isStartingAt",
                    c."vendor_key" as "vendorKey"
             from "parts_supplier_price_snapshots" s
             join "parts_catalog_items" c on c."id" = s."part_id"
             where s."part_id" = any($1::text[])
             order by s."captured_at" desc`,
            [partIds],
          );
      const now = Date.now();
      const snapshotsByPart = new Map<string, unknown[]>();
      for (const row of snapshotResult.rows) {
        const vendorKey = String(row.vendorKey);
        const vendor = vendorByKey.get(vendorKey);
        const partId = String(row.partId);
        const snapshot = {
          id: String(row.id),
          partId,
          vendorKey,
          vendorName: vendor?.name ?? vendorKey,
          sourceUrl: String(row.sourceUrl),
          unitPrice: moneyFromDatabase(row.unitPrice),
          currency: String(row.currency),
          capturedAt: isoDate(row.capturedAt as Date | string),
          isStartingAt: Boolean(row.isStartingAt),
          isStale: isPriceSnapshotStale(row.capturedAt as Date | string, now),
        };
        const snapshots = snapshotsByPart.get(partId) ?? [];
        snapshots.push(snapshot);
        snapshotsByPart.set(partId, snapshots);
      }
      const parts = allocationResult.rows.map((row) => {
        const vendorKey = String(row.vendorKey);
        const vendor = vendorByKey.get(vendorKey);
        const quantity = Number(row.quantity);
        const rawUnitCost = moneyFromDatabase(row.unitCost);
        const costCurrency = rawUnitCost !== null && isValidCurrencyCode(row.costCurrency)
          ? row.costCurrency
          : null;
        const unitCost = costCurrency ? rawUnitCost : null;
        return {
          partId: String(row.partId),
          name: String(row.name),
          vendorKey,
          vendorName: vendor?.name ?? vendorKey,
          sku: (row.sku as string | null) ?? null,
          productUrl: (row.productUrl as string | null) ?? null,
          quantity,
          unitCost,
          costCurrency,
          lineTotal: calculateLineTotal(quantity, unitCost, costCurrency),
          priceSnapshots: snapshotsByPart.get(String(row.partId)) ?? [],
        };
      });
      const savedCostTotals = summarizeSavedCosts(
        parts.map((part) => ({
          quantity: part.quantity,
          unitCost: part.unitCost,
          currency: part.costCurrency,
        })),
      );
      res.json(GetPartsRobotDetailsResponse.parse({
        robot: mapRobot(robotResult.rows[0]),
        parts,
        ...savedCostTotals,
      }));
    } catch (error) {
      req.log.error({ err: error, robotId: params.data.robotId }, "Robot build details load failed");
      res.status(500).json({ error: "Unable to load this robot's build details." });
    }
  },
);

router.patch("/parts/robots/:robotId/preview", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdatePartsRobotPreviewParams.safeParse(req.params);
  const parsed = UpdatePartsRobotPreviewBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.success ? "Invalid preview details." : "Robot not found." });
    return;
  }
  const objectPath = parsed.data.objectPath.trim();
  const fileName = parsed.data.fileName.trim();
  const contentType = parsed.data.contentType.trim();
  if (!objectPath || !fileName || !contentType) {
    res.status(400).json({ error: "Preview file details are incomplete." });
    return;
  }
  try {
    const result = await pool.query(
      `update "parts_robots"
          set "preview_object_path" = $2,
              "preview_file_name" = $3,
              "preview_content_type" = $4,
              "updated_at" = now()
        where "id" = $1
        returning "id", "name", "preview_object_path" as "previewObjectPath",
                  "preview_file_name" as "previewFileName",
                  "preview_content_type" as "previewContentType",
                  "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [params.data.robotId, objectPath, fileName, contentType],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Robot not found." });
      return;
    }
    res.json(UpdatePartsRobotPreviewResponse.parse(mapRobot(result.rows[0])));
  } catch (error) {
    req.log.error({ err: error, robotId: params.data.robotId }, "Robot preview update failed");
    res.status(500).json({ error: "Unable to attach this preview." });
  }
});

router.post("/parts/robots", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreatePartsRobotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a robot name." });
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
       returning "id", "name", "preview_object_path" as "previewObjectPath",
                 "preview_file_name" as "previewFileName",
                 "preview_content_type" as "previewContentType",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
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
      res.status(400).json({ error: "The robot preview details are invalid." });
      return;
    }
    const preview = body.data;
    if (
      !/^\/objects\/[A-Za-z0-9-]{8,128}$/.test(preview.objectPath) ||
      partsPreviewKind(preview.fileName, preview.contentType) === null
    ) {
      res.status(400).json({ error: "Choose a supported private preview file." });
      return;
    }
    try {
    const result = await pool.query(
      `update "parts_robots" set "name" = $2, "updated_at" = now()
       where "id" = $1
       returning "id", "name", "preview_object_path" as "previewObjectPath",
                 "preview_file_name" as "previewFileName",
                 "preview_content_type" as "previewContentType",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
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
       returning "id", "name", "preview_object_path" as "previewObjectPath",
                 "preview_file_name" as "previewFileName",
                 "preview_content_type" as "previewContentType",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
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
      const allocation = await saveRobotAllocation(
        params.data.robotId,
        params.data.partId,
        body.data.quantity,
      );
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
