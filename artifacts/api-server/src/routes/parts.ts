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
  DeletePartsRobotPreviewParams,
  DeletePartsRobotPreviewResponse,
  type AssistantActivity,
  type PartsVendorSyncState,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { requestTeamId, requireAdmin } from "../middlewares/adminAuth";
import { teamSqlCondition } from "../lib/teams";
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
  VENDOR_CATALOG_SEEDS,
  vendorSeedSyncMessage,
  vendorSeedSyncStatus,
} from "../lib/vendorCatalogSeeds";
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
  PRODUCT_CRAWL_DEFAULT_BUDGET,
  PRODUCT_CRAWL_DELAY_MS,
  crawlDelay,
  fetchProductPage,
  fetchSitemapProductUrls,
  productUrlSlug,
  type SitemapCrawlTarget,
} from "../lib/productSitemapCrawl";
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
import { isPrivateObjectReferenced } from "../lib/privateObjectReferences";
import partsImageRecognitionRouter from "./partsImageRecognition";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
router.use(partsImageRecognitionRouter);
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

/**
 * Appends a team predicate for `alias."team_id"` to a raw-SQL where clause.
 * Pass the requester's team id from routes; omit (undefined) for legacy
 * global callers (assistant tools, background sync) whose behaviour is
 * unchanged. The default team also matches legacy NULL rows so pre-migration
 * data is never lost; other teams only ever see their own rows.
 */
function withTeamScope(
  whereSql: string,
  values: unknown[],
  teamId: string | undefined,
  alias: string,
): { whereSql: string; values: unknown[] } {
  if (!teamId) return { whereSql, values };
  const placeholder = `$${values.length + 1}`;
  const condition = teamSqlCondition(`${alias}."team_id"`, placeholder);
  return {
    whereSql: whereSql ? `${whereSql} and ${condition}` : `where ${condition}`,
    values: [...values, teamId],
  };
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
  teamId?: string,
): Promise<{ id: string; created: boolean }> {
  const lookupValues: unknown[] = [input.vendorKey, input.externalKey];
  let lookupSql =
    `select "id" from "parts_catalog_items" where "vendor_key" = $1 and "external_key" = $2`;
  if (teamId) {
    lookupValues.push(teamId);
    lookupSql += ` and ${teamSqlCondition('"team_id"', `$${lookupValues.length}`)}`;
  }
  const existing = await client.query(lookupSql, lookupValues);
  if (teamId && existing.rowCount !== 0) {
    // A row for this team already exists (possibly a legacy NULL row adopted
    // by the default team): update it in place instead of inserting, so the
    // per-team unique index can never produce a same-team duplicate.
    const id = String(existing.rows[0].id);
    await client.query(
      `update "parts_catalog_items" set
         "name" = $2,
         "sku" = coalesce($3, "sku"),
         "category" = coalesce($4, "category"),
         "description" = coalesce($5, "description"),
         "product_url" = coalesce($6, "product_url"),
         "image_url" = coalesce($7, "image_url"),
         "is_manual" = "is_manual" or $8,
         "updated_at" = now()
       where "id" = $1`,
      [
        id,
        input.name,
        input.sku,
        input.category,
        input.description,
        input.productUrl,
        input.imageUrl,
        input.isManual,
      ],
    );
    await client.query(
      `insert into "parts_inventory" ("part_id", "quantity_owned")
       values ($1, 0) on conflict ("part_id") do nothing`,
      [id],
    );
    return { id, created: false };
  }
  const created = existing.rowCount === 0;
  const id = created ? randomUUID() : String(existing.rows[0].id);
  const columns = teamId
    ? `("id", "team_id", "vendor_key", "external_key", "name", "sku", "category", "description", "product_url", "image_url", "is_manual")`
    : `("id", "vendor_key", "external_key", "name", "sku", "category", "description", "product_url", "image_url", "is_manual")`;
  const conflictTarget = teamId
    ? `("team_id", "vendor_key", "external_key")`
    : `("vendor_key", "external_key")`;
  const insertValues: unknown[] = teamId
    ? [id, teamId, input.vendorKey, input.externalKey, input.name, input.sku, input.category, input.description, input.productUrl, input.imageUrl, input.isManual]
    : [id, input.vendorKey, input.externalKey, input.name, input.sku, input.category, input.description, input.productUrl, input.imageUrl, input.isManual];
  const placeholders = insertValues.map((_, index) => `$${index + 1}`).join(", ");
  const saved = await client.query(
    `insert into "parts_catalog_items"
       ${columns}
     values (${placeholders})
     on conflict ${conflictTarget} do update set
       "name" = excluded."name",
       "sku" = coalesce(excluded."sku", "parts_catalog_items"."sku"),
       "category" = coalesce(excluded."category", "parts_catalog_items"."category"),
       "description" = coalesce(excluded."description", "parts_catalog_items"."description"),
       "product_url" = coalesce(excluded."product_url", "parts_catalog_items"."product_url"),
       "image_url" = coalesce(excluded."image_url", "parts_catalog_items"."image_url"),
       "is_manual" = "parts_catalog_items"."is_manual" or excluded."is_manual",
       "updated_at" = now()
     returning "id"`,
    insertValues,
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
  teamId?: string,
): Promise<{ exists: boolean; allocated: number }> {
  const lookupValues: unknown[] = [partId];
  let partSql = `select "id" from "parts_catalog_items" where "id" = $1 for update`;
  if (teamId) {
    lookupValues.push(teamId);
    partSql =
      `select "id" from "parts_catalog_items" where "id" = $1` +
      ` and ${teamSqlCondition('"team_id"', `$${lookupValues.length}`)} for update`;
  }
  const part = await client.query(partSql, lookupValues);
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
  teamId?: string,
): Promise<RobotAllocationResult> {
  return withTransaction(async (client) => {
    const robotValues: unknown[] = [robotId];
    let robotSql = `select "id", "name" from "parts_robots" where "id" = $1`;
    if (teamId) {
      robotValues.push(teamId);
      robotSql += ` and ${teamSqlCondition('"team_id"', `$${robotValues.length}`)}`;
    }
    const robotResult = await client.query(robotSql, robotValues);
    if (robotResult.rowCount === 0) return { missing: "robot" as const };
    const partValues: unknown[] = [partId];
    let partSql =
      `select c."id", coalesce(i."quantity_owned", 0)::int as "quantityOwned"
       from "parts_catalog_items" c
       left join "parts_inventory" i on i."part_id" = c."id"
       where c."id" = $1 for update of c`;
    if (teamId) {
      partValues.push(teamId);
      partSql =
        `select c."id", coalesce(i."quantity_owned", 0)::int as "quantityOwned"
         from "parts_catalog_items" c
         left join "parts_inventory" i on i."part_id" = c."id"
         where c."id" = $1 and ${teamSqlCondition('c."team_id"', `$${partValues.length}`)} for update of c`;
    }
    const partResult = await client.query(partSql, partValues);
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
  teamId?: string,
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
  const baseWhere = `where ${clauses.join(" and ")}`;
  const scoped = withTeamScope(baseWhere, values, teamId, "c");
  const whereSql = scoped.whereSql;
  const scopedValues = scoped.values;
  const [countResult, rows] = await Promise.all([
    pool.query(
      `select count(*)::int as "total" from "parts_catalog_items" c ${whereSql}`,
      scopedValues,
    ),
    queryCatalogRows(whereSql, scopedValues, limit, offset),
  ]);
  return {
    items: rows.map(mapCatalogRow),
    total: Number(countResult.rows[0].total),
    offset,
    limit,
  };
}

async function getCatalogItem(partId: string, teamId?: string) {
  const scoped = withTeamScope(`where c."id" = $1`, [partId], teamId, "c");
  const rows = await queryCatalogRows(scoped.whereSql, scoped.values, 1, 0);
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

export async function searchPublicCatalog(
  query: string,
  vendor?: VendorConfig,
  options: {
    maxCandidatesPerVendor?: number;
    includePartialDetails?: boolean;
    onResult?: (result: PublicCatalogSearchResult) => void | Promise<void>;
    onComplete?: (summary: {
      providerCount: number;
      failedProviderCount: number;
      resultCount: number;
    }) => void | Promise<void>;
  } = {},
) {
  const allowedVendors = (vendor ? [vendor] : VENDORS).filter(
    (item) => item.coverageState !== "access_restricted",
  );
  if (allowedVendors.length === 0) {
    await options.onComplete?.({
      providerCount: 0,
      failedProviderCount: 0,
      resultCount: 0,
    });
    return [];
  }
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

  if (options.onResult) {
    const seen = new Set<string>();
    const candidateCounts = new Map(allowedVendors.map((item) => [item.key, 0]));
    const verifiedResults: PublicCatalogSearchResult[] = [];
    let failedProviderCount = 0;
    const candidatesPerVendor = options.maxCandidatesPerVendor ?? 8;
    let activeEnrichments = 0;
    const enrichmentWaiters: Array<() => void> = [];
    const withEnrichmentSlot = async <T>(operation: () => Promise<T>): Promise<T> => {
      if (activeEnrichments >= 12) {
        await new Promise<void>((resolve) => enrichmentWaiters.push(resolve));
      } else {
        activeEnrichments += 1;
      }
      try {
        return await operation();
      } finally {
        const next = enrichmentWaiters.shift();
        if (next) next();
        else activeEnrichments -= 1;
      }
    };

    await Promise.all(providerRequests.map(async (providerRequest) => {
      let providerCandidates: PublicCatalogSearchCandidate[];
      try {
        providerCandidates = await providerRequest;
      } catch {
        failedProviderCount += 1;
        return;
      }

      const candidates = providerCandidates.filter((candidate) => {
        if (!isRelevantCatalogSearchResult(query, candidate.title, candidate.description)) return false;
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(candidate.url);
        } catch {
          return false;
        }
        const key = `${candidate.vendorKey}:${parsedUrl.origin}${parsedUrl.pathname}`.toLowerCase();
        const count = candidateCounts.get(candidate.vendorKey);
        if (count === undefined || count >= candidatesPerVendor || seen.has(key)) return false;
        seen.add(key);
        candidateCounts.set(candidate.vendorKey, count + 1);
        return true;
      });

      await Promise.all(candidates.map(async (candidate) => {
        await withEnrichmentSlot(async () => {
          try {
            const result = await enrichOfficialProductPage(candidate, options.includePartialDetails);
            if (
              !result ||
              !isRelevantCatalogSearchResult(query, result.title, result.description)
            ) {
              return;
            }
            verifiedResults.push(result);
            await options.onResult?.(result);
          } catch {
            // A single broken product page or disconnected consumer must not stop
            // other suppliers from returning their verified results.
          }
        });
      }));
    }));

    await options.onComplete?.({
      providerCount: providerRequests.length,
      failedProviderCount,
      resultCount: verifiedResults.length,
    });
    return verifiedResults;
  }

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

/**
 * Records buffered during a sitemap crawl slice before they are written. Bounds
 * how much fetched work a mid-slice restart can discard; at the supplier's 10s
 * per-page delay this is roughly two minutes of fetching.
 */
const SITEMAP_CRAWL_FLUSH_EVERY = 12;

/**
 * How many times a sitemap URL may fail before the crawl stops retrying it.
 * Without a ceiling a URL that always times out stays pending forever, so the
 * supplier never converges and the crawler re-fetches it every minute for as long
 * as the site is online. A page that returns no product record at all counts as
 * terminal on its first attempt, because that answer will not change.
 */
const PRODUCT_CRAWL_MAX_ATTEMPTS = 3;

/**
 * How long a refused sitemap URL stays refused before the crawl tries it once
 * more. Long enough that a settled "not a product" costs one request a day rather
 * than one a minute, short enough that a supplier outage cannot silently drop real
 * products from the catalog.
 */
const PRODUCT_CRAWL_SKIP_TTL_SECONDS = 24 * 60 * 60;

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

/**
 * Suppliers currently mid-crawl. The scheduled sync and the background crawler
 * can both reach a sitemap supplier, and overlapping runs would double-fetch
 * every pending product page against a host that asks for a 10s delay.
 */
const sitemapCrawlInFlight = new Set<string>();

/**
 * Suppliers that publish a product sitemap but no machine-readable feed are
 * crawled here instead of being shipped as a hand-collected seed.
 *
 * The sitemap is the change detector: one request enumerates every product URL,
 * and one database read of the URLs already indexed isolates the ones never
 * seen before. Only those are fetched, so the steady-state cost is a single
 * request per run regardless of catalog size. The first pass is the only
 * expensive one, and it is sliced by `budget` so the background crawler can
 * work through it without holding a request open for hours.
 */
async function collectSitemapCrawledCatalog(
  vendor: VendorConfig,
  budget: number = PRODUCT_CRAWL_DEFAULT_BUDGET,
) {
  const sitemapUrl = vendor.productSitemapUrl as string;
  const target: SitemapCrawlTarget = { domain: vendor.domain, sitemapUrl };
  if (sitemapCrawlInFlight.has(vendor.key)) {
    const states = await readPartsSupplierSyncStates();
    const current = states.get(vendor.key);
    return {
      vendor,
      status: current?.status ?? ("incomplete" as const),
      source: sitemapUrl,
      records: [] as CatalogFeedRecord[],
      itemCount: current?.itemCount ?? 0,
      created: 0,
      updated: 0,
      message: "A crawl slice for this supplier was already running; the last persisted state is reported.",
    };
  }
  sitemapCrawlInFlight.add(vendor.key);
  try {
    return await crawlSitemapSlice(vendor, sitemapUrl, target, budget);
  } finally {
    sitemapCrawlInFlight.delete(vendor.key);
  }
}

/**
 * Persists the sitemap URLs this slice will not ask for again, or has failed to
 * fetch. `greatest` keeps the stored attempt count monotonic, so a terminal
 * "not-a-product" mark is never walked back by a later transient failure.
 */
async function recordSkippedProducts(
  vendorKey: string,
  skips: { productUrl: string; reason: string; attempts: number }[],
) {
  if (skips.length === 0) return;
  const values: unknown[] = [vendorKey];
  const rows = skips.map((skip, index) => {
    const offset = index * 3 + 2;
    values.push(skip.productUrl, skip.reason, skip.attempts);
    return `($1, $${offset}, $${offset + 1}, $${offset + 2}, now())`;
  });
  await pool.query(
    `insert into "parts_catalog_crawl_skips"
       ("vendor_key", "product_url", "reason", "attempts", "updated_at")
     values ${rows.join(", ")}
     on conflict ("vendor_key", "product_url") do update set
       "reason" = excluded."reason",
       "attempts" = greatest("parts_catalog_crawl_skips"."attempts", excluded."attempts"),
       "updated_at" = now()`,
    values,
  );
}

async function crawlSitemapSlice(
  vendor: VendorConfig,
  sitemapUrl: string,
  target: SitemapCrawlTarget,
  budget: number,
) {
  const sitemapUrls = await fetchSitemapProductUrls(target);

  // Every row for the vendor, not just the ones carrying a URL: an empty result is
  // what tells the seed bootstrap below that this is the vendor's first pass.
  const indexed = await pool.query(
    `select "product_url" from "parts_catalog_items" where "vendor_key" = $1`,
    [vendor.key],
  );
  const indexedRows = indexed.rows as { product_url: string | null }[];
  const known = new Set<string>(
    indexedRows
      .map((row) => row.product_url)
      .filter((productUrl): productUrl is string => productUrl !== null),
  );

  // URLs the crawl has recently refused. The pending set is "sitemap URLs minus
  // indexed URLs", so a sitemap entry that yields no product record never gains a
  // catalog row and would be re-fetched on every slice for as long as the site is
  // online. Reading the refusals back is what lets the pending set empty.
  //
  // They expire rather than lasting forever: a supplier outage would otherwise let
  // a few transient failures drop real products permanently. Retrying a refused
  // URL once a day costs one request, which is nothing next to losing a part.
  const refused = await pool.query(
    `select "product_url", "attempts" from "parts_catalog_crawl_skips"
     where "vendor_key" = $1
       and "updated_at" > now() - make_interval(secs => $2::int)`,
    [vendor.key, PRODUCT_CRAWL_SKIP_TTL_SECONDS],
  );
  const unproductive = new Map<string, number>(
    (refused.rows as { product_url: string; attempts: number }[]).map((row) => [
      row.product_url,
      row.attempts,
    ]),
  );

  const records: CatalogFeedRecord[] = [];
  let created = 0;
  let updated = 0;

  /**
   * Writes whatever has been collected so far. Records are flushed as the slice
   * runs rather than held until it finishes: a slice takes about ten minutes at
   * the supplier's delay, and a restart partway through would otherwise discard
   * every page fetched so far — work the sitemap diff would have to repeat in
   * full. Flushing bounds that loss to a couple of minutes of fetching.
   */
  const flush = async () => {
    if (records.length === 0) return;
    const counts = await saveCatalogFeedRecords(records);
    created += counts.created;
    updated += counts.updated;
    records.length = 0;
  };

  /**
   * A supplier that also ships a hand-collected seed starts from it rather than
   * re-crawling a catalog this repository already carries. The seed is complete
   * as of when it was collected and costs a single bulk write, so the first pass
   * then only fetches what the supplier has listed since: for REV Robotics that
   * is 17 products instead of 389, and the catalog is populated immediately
   * rather than after an hour of polite fetching.
   *
   * Gated on an empty catalog so the seed is a starting point and never a
   * ceiling — once the supplier lists something new, the crawl owns the vendor.
   */
  if (indexedRows.length === 0) {
    const seed = VENDOR_CATALOG_SEEDS.get(vendor.key);
    if (seed && seed.records.length > 0) {
      for (const record of seed.records) {
        records.push({
          vendorKey: record.vendorKey,
          externalKey: record.externalKey,
          name: record.name,
          sku: record.sku,
          category: record.category,
          description: record.description,
          productUrl: record.productUrl,
          imageUrl: record.imageUrl,
        });
        // Registered as known so the diff below asks only for what the seed missed.
        if (record.productUrl) known.add(record.productUrl);
      }
      await flush();
    }
  }

  const pending = sitemapUrls.filter(
    (url) => !known.has(url) && (unproductive.get(url) ?? 0) < PRODUCT_CRAWL_MAX_ATTEMPTS,
  );
  const slice = pending.slice(0, Math.max(0, budget));
  /** Sitemap URLs this slice refuses or fails again, and why. */
  const skips: { productUrl: string; reason: string; attempts: number }[] = [];
  for (const productUrl of slice) {
    try {
      const product = await fetchProductPage(productUrl, target);
      if (product) {
        records.push({
          vendorKey: vendor.key,
          // The supplier SKU is the stable identity; the slug covers pages that
          // ship no JSON-LD so a part is still never fetched twice.
          externalKey: (product.sku ?? productUrlSlug(productUrl) ?? productUrl)
            .toLocaleLowerCase()
            .slice(0, 500),
          name: product.name,
          sku: product.sku,
          category: null,
          description: product.description,
          productUrl,
          imageUrl: product.imageUrl,
        });
      } else {
        // A page with no product JSON-LD is a settled answer rather than a
        // transient fault, so record it as terminal instead of asking again.
        skips.push({
          productUrl,
          reason: "not-a-product",
          attempts: PRODUCT_CRAWL_MAX_ATTEMPTS,
        });
      }
    } catch (error) {
      skips.push({
        productUrl,
        reason: "fetch-failed",
        attempts: (unproductive.get(productUrl) ?? 0) + 1,
      });
      logger.warn({ err: error, vendorKey: vendor.key, productUrl }, "Sitemap product page failed");
    }
    if (records.length >= SITEMAP_CRAWL_FLUSH_EVERY) await flush();
    await crawlDelay(PRODUCT_CRAWL_DELAY_MS);
  }
  await flush();
  await recordSkippedProducts(vendor.key, skips);

  // An attempted URL only counts as still owed when it failed transiently and has
  // attempts left; everything else either gained a catalog row or was given up on.
  const retryable = new Set(
    skips
      .filter((skip) => skip.attempts < PRODUCT_CRAWL_MAX_ATTEMPTS)
      .map((skip) => skip.productUrl),
  );
  const attempted = new Set(slice);
  const remaining = pending.filter((url) => !attempted.has(url) || retryable.has(url)).length;
  const refusedUrls = new Set([
    ...[...unproductive.entries()]
      .filter(([, attempts]) => attempts >= PRODUCT_CRAWL_MAX_ATTEMPTS)
      .map(([url]) => url),
    ...skips
      .filter((skip) => skip.attempts >= PRODUCT_CRAWL_MAX_ATTEMPTS)
      .map((skip) => skip.productUrl),
  ]);
  const skippedCount = sitemapUrls.filter((url) => refusedUrls.has(url)).length;
  const skippedNote =
    skippedCount > 0
      ? ` ${skippedCount} sitemap URL(s) are not product pages or failed repeatedly, and are no longer retried.`
      : "";
  const enumerated = `${sitemapUrls.length} sitemap URL(s)`;
  // Counted from the catalog rather than derived from this slice: the whole
  // point of flushing is that the running total survives a restart this slice
  // did not, so the honest figure is whatever the database now holds.
  const total = await pool.query(
    `select count(*)::int as "total" from "parts_catalog_items"
     where "vendor_key" = $1 and "product_url" is not null`,
    [vendor.key],
  );
  const itemCount = Number((total.rows[0] as { total: number } | undefined)?.total ?? 0);
  if (remaining === 0) {
    return {
      vendor,
      status: "synced" as const,
      source: sitemapUrl,
      // Records are already persisted by the flush above; returning them again
      // would make every caller re-save work that is already in the catalog.
      records: [] as CatalogFeedRecord[],
      itemCount,
      created,
      updated,
      message: `Product sitemap enumerated (${enumerated}); ${itemCount} product(s) are indexed and nothing is left to fetch. Incremental checks now cost one request per run.${skippedNote}`,
    };
  }
  return {
    vendor,
    status: "incomplete" as const,
    source: sitemapUrl,
    records: [] as CatalogFeedRecord[],
    itemCount,
    created,
    updated,
    message: `Product sitemap enumerated (${enumerated}); ${itemCount} product(s) indexed and ${remaining} still to crawl. The background crawler continues automatically at ${PRODUCT_CRAWL_DELAY_MS / 1000}s per product page.${skippedNote}`,
  };
}

async function collectPublicVendorCatalog(
  vendor: VendorConfig,
  sitemapBudget: number = PRODUCT_CRAWL_DEFAULT_BUDGET,
) {
  // Sitemap-crawled suppliers have no feed to paginate; the sitemap diff above
  // supplies both the inventory and the incremental change signal.
  if (vendor.productSitemapUrl) {
    return collectSitemapCrawledCatalog(vendor, sitemapBudget);
  }
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
      if (noPublicFeed) {
        const seed = vendor.key ? VENDOR_CATALOG_SEEDS.get(vendor.key) : undefined;
        if (seed) {
          // This supplier publishes no verified public full-catalog feed,
          // so automated sync can never index it. Fall back to the
          // hand-collected seed so the synced catalog search still covers
          // its parts. `synced` is reported only for fully-enumerated seeds
          // (see vendorCatalogSeeds.ts); anything scoped stays search_only.
          const seedRecords: CatalogFeedRecord[] = seed.records.map((record) => ({
            vendorKey: record.vendorKey,
            externalKey: record.externalKey,
            name: record.name,
            sku: record.sku,
            category: record.category,
            description: record.description,
            productUrl: record.productUrl,
            imageUrl: record.imageUrl,
          }));
          return {
            vendor,
            status: vendorSeedSyncStatus(seed),
            source: seed.source,
            records: seedRecords,
            message: vendorSeedSyncMessage(seed),
          };
        }
      }
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
    const teamId = await requestTeamId(req);
    const [robotsResult, totalsResult, syncStates] = await Promise.all([
      pool.query(
        `select "id", "name", "preview_object_path" as "previewObjectPath",
                "preview_file_name" as "previewFileName",
                "preview_content_type" as "previewContentType",
                "created_at" as "createdAt", "updated_at" as "updatedAt"
         from "parts_robots" where ${teamSqlCondition('"team_id"', "$1")} order by lower("name")`,
        [teamId],
      ),
      pool.query(
        `select
           (select count(*)::int from "parts_catalog_items" c where ${teamSqlCondition('c."team_id"', "$1")}) as "catalogItems",
           (select coalesce(sum("quantity_owned"), 0)::int from "parts_inventory" i
             join "parts_catalog_items" c on c."id" = i."part_id"
             where ${teamSqlCondition('c."team_id"', "$1")}) as "ownedUnits",
           (select coalesce(sum("quantity"), 0)::int from "parts_robot_allocations" a
             join "parts_robots" r on r."id" = a."robot_id"
             where ${teamSqlCondition('r."team_id"', "$1")}) as "assignedUnits"`,
        [teamId],
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
    const vendorKey = cleanText(req.query.vendorKey, 100);
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
    const teamId = await requestTeamId(req);
    const scoped = withTeamScope(whereSql, values, teamId, "c");
    const [countResult, rows] = await Promise.all([
      pool.query(
        `select count(*)::int as "total" from "parts_catalog_items" c ${scoped.whereSql}`,
        scoped.values,
      ),
      queryCatalogRows(scoped.whereSql, scoped.values, limit, offset),
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
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isInteger(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 100;
  const offset = Number.isInteger(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  const vendor = vendorKey ? vendorByKey.get(vendorKey) : undefined;
  if (vendorKey && !vendor) {
    res.status(400).json({ error: "Choose one of the listed vendors." });
    return;
  }
  try {
    const teamId = await requestTeamId(req);
    const syncedCatalog = await searchSyncedCatalog(query, vendor, limit, offset, teamId);
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

router.get("/parts/catalog/search/stream", requireAdmin, async (req, res): Promise<void> => {
  const vendorKey = cleanText(req.query.vendorKey, 100);
  const query = cleanText(req.query.q, 120);
  if (!query || query.length < 2) {
    res.status(400).json({ error: "Enter at least two search characters." });
    return;
  }
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isInteger(limitRaw) ? Math.min(100, Math.max(1, limitRaw)) : 100;
  const offset = Number.isInteger(offsetRaw) ? Math.max(0, offsetRaw) : 0;
  const vendor = vendorKey ? vendorByKey.get(vendorKey) : undefined;
  if (vendorKey && !vendor) {
    res.status(400).json({ error: "Choose one of the listed vendors." });
    return;
  }

  try {
    const teamId = await requestTeamId(req);
    const syncedCatalog = await searchSyncedCatalog(query, vendor, limit, offset, teamId);
    const catalogItems = ListPartsCatalogResponse.parse({
      items: syncedCatalog.items,
      total: syncedCatalog.total,
    }).items;

    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let connected = true;
    let resultCount = 0;
    res.on("close", () => {
      connected = false;
    });
    const writeEvent = (event: Record<string, unknown>) => {
      if (!connected || res.destroyed || res.writableEnded) return;
      res.write(`${JSON.stringify(event)}\n`);
      res.flush?.();
    };

    writeEvent({
      type: "catalog",
      query,
      catalogItems,
      catalogTotal: syncedCatalog.total,
      catalogOffset: syncedCatalog.offset,
      catalogLimit: syncedCatalog.limit,
    });

    await searchPublicCatalog(query, vendor, {
      maxCandidatesPerVendor: 40,
      includePartialDetails: true,
      onResult: (result) => {
        const validated = SearchPartsCatalogResponse.parse({
          query,
          results: [result],
          catalogItems: [],
          catalogTotal: 0,
          catalogOffset: 0,
          catalogLimit: 0,
          liveSearchStatus: "available",
        }).results[0];
        resultCount += 1;
        writeEvent({ type: "result", result: validated });
      },
      onComplete: ({ providerCount, failedProviderCount }) => {
        const status = failedProviderCount === 0
          ? "available"
          : failedProviderCount >= providerCount
            ? "unavailable"
            : "partial";
        writeEvent({
          type: "complete",
          status,
          providerCount,
          failedProviderCount,
          resultCount,
        });
      },
    });
    if (connected && !res.writableEnded) res.end();
  } catch (error) {
    req.log.error({ err: error, vendorKey }, "Progressive supplier catalog search failed");
    if (res.headersSent) {
      if (!res.destroyed && !res.writableEnded) res.end();
      return;
    }
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
      isManual: true,
    };
    const teamId = await requestTeamId(req);
    const itemId = await withTransaction(async (client) => {
      const saved = await upsertCatalogRecord(client, item, teamId);
      if (Object.prototype.hasOwnProperty.call(req.body, "quantityOwned")) {
        await setOwnedQuantity(client, saved.id, input.quantityOwned ?? 0, teamId);
      }
      return saved.id;
    });
    const savedItem = await getCatalogItem(itemId, teamId);
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
      // Sitemap-backed suppliers are diffed but not crawled here: a slice at the
      // host's 10s per-page delay would hold this request open for minutes. The
      // diff still reports how much is left, and the background crawler does the
      // fetching, so a manual sync stays fast and honest.
      collection = await collectPublicVendorCatalog(vendor, 0);
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
    // Persist any collected records, including hand-collected seeds served
    // under a search_only status (REV Robotics). Vendors without records
    // still no-op because saveCatalogFeedRecords([]) returns zeros.
    const counts = collection.records.length > 0
      ? await saveCatalogFeedRecords(collection.records)
      : { created: 0, updated: 0 };
    vendorResults[index] = {
      vendorKey: collection.vendor.key,
      vendorName: collection.vendor.name,
      status: collection.status,
      checkedAt: new Date(),
      // Sitemap crawls report their whole indexed catalog; feed and seed paths
      // report the records collected in this run.
      itemCount: "itemCount" in collection ? collection.itemCount : collection.records.length,
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

/**
 * Product pages fetched per slice. At the hosts' declared 10s delay this is about
 * ten minutes of work, and still lands inside the lease below if every page hits
 * the 30s request timeout. The sitemap suppliers total roughly 7,900 product
 * pages, so a full first pass is about a day of polite background fetching; every
 * later check costs a single sitemap request per supplier.
 */
const SITEMAP_CRAWL_PAGE_BUDGET = 60;

/**
 * Gap between slices while a supplier still has URLs to crawl. Kept short so the
 * first pass finishes overnight; it is not a rate limit — the per-page delay
 * inside the slice is what paces the crawl.
 */
const SITEMAP_CRAWL_BACKLOG_DELAY_MS = 60 * 1000;

/**
 * Once a supplier has converged, the crawler stops fetching product pages and
 * only re-reads the sitemap this often to notice newly listed parts. An idle
 * season therefore costs four sitemap requests a day instead of a full walk.
 */
const SITEMAP_RECHECK_MS = 6 * 60 * 60 * 1000;

let sitemapCrawlTimer: ReturnType<typeof setTimeout> | null = null;
let sitemapCrawlStopped = false;

/**
 * How long a crawler lease is held before another instance may take over.
 *
 * Sized for the timeout path, not the happy path: a page normally costs about
 * 10s (delay only), but `fetchProductPage` allows a 30s request timeout, so a
 * slice of 60 pages against a slow supplier can take up to ~40 minutes. A lease
 * shorter than that would let a second instance start crawling alongside a
 * healthy one. A crashed instance still frees the lease long before the nightly
 * first pass would be missed.
 */
const SITEMAP_CRAWL_LEASE_SECONDS = 45 * 60;

/**
 * Takes the cross-instance crawl lease. Autoscaled deployments run several
 * server instances against one database, and without this every instance would
 * fetch the same sitemap and crawl the same pending products — multiplying the
 * request rate against a host that asks for a delay between fetches. Mirrors the
 * lease the scheduled supplier sync already uses for the same reason.
 *
 * Returns true when this instance may crawl.
 */
async function claimSitemapCrawlLease(): Promise<boolean> {
  const claim = await pool.query(
    `insert into "parts_catalog_crawl_state" ("id", "claimed_at")
     values ('global', now())
     on conflict ("id") do update set "claimed_at" = now()
     where "parts_catalog_crawl_state"."claimed_at" is null
        or "parts_catalog_crawl_state"."claimed_at"
             < now() - make_interval(secs => $1::int)
     returning "id"`,
    [SITEMAP_CRAWL_LEASE_SECONDS],
  );
  return claim.rowCount !== 0;
}

/**
 * Runs one bounded crawl slice and reports whether the crawler should come back
 * promptly.
 *
 * A first pass cannot live inside a request: the sitemap suppliers list 2,387,
 * 5,152 and 389 products and each asks for 10 seconds between page fetches, so a
 * complete walk is hours of polite fetching. Slicing lets the sitemap diff do the
 * bookkeeping instead — a restart costs a single slice rather than the whole run,
 * and no tick blocks the event loop.
 */
async function runSitemapCrawlSlices(): Promise<boolean> {
  // A lost lease means another instance is mid-slice, so come back soon rather
  // than sleeping the converged interval and stalling the first pass.
  if (!(await claimSitemapCrawlLease())) return true;

  const states = await readPartsSupplierSyncStates();
  const due = VENDORS.filter((vendor) => {
    if (!vendor.productSitemapUrl) return false;
    const state = states.get(vendor.key);
    // No converged run yet: a first pass is still owed.
    if (state?.status !== "synced") return true;
    return Date.now() - state.checkedAt.getTime() >= SITEMAP_RECHECK_MS;
  });
  if (due.length === 0) return false;

  // One supplier per slice, oldest check first. Crawling every sitemap supplier
  // back to back would run for hours and outlive the lease above, so a slice stays
  // at 60 pages (~10 minutes at the declared delay) however many suppliers are
  // configured. Rotation is read back from persisted `checkedAt`, so it survives a
  // restart without a cursor anyone has to keep.
  const vendor = due.reduce((best, candidate) => {
    const bestAt = states.get(best.key)?.checkedAt.getTime() ?? 0;
    const candidateAt = states.get(candidate.key)?.checkedAt.getTime() ?? 0;
    return candidateAt < bestAt ? candidate : best;
  });

  // Another supplier still waiting counts as backlog: this one advancing does not
  // mean the rest should sleep for the converged interval.
  let backlogRemains = due.length > 1;
  try {
    const collection = await collectSitemapCrawledCatalog(vendor, SITEMAP_CRAWL_PAGE_BUDGET);
    await savePartsSupplierSyncState(vendor.key, {
      status: collection.status,
      checkedAt: new Date(),
      itemCount: collection.itemCount,
      source: collection.source,
      message: collection.message,
    });
    if (collection.status === "incomplete") backlogRemains = true;
    logger.info(
      {
        vendorKey: vendor.key,
        status: collection.status,
        itemCount: collection.itemCount,
        // The crawl persists incrementally so a mid-slice restart keeps its
        // work; these counts are reported by the crawl, not saved here.
        created: collection.created,
        updated: collection.updated,
      },
      "Sitemap crawl slice processed",
    );
  } catch (error) {
    backlogRemains = true;
    logger.warn({ err: error, vendorKey: vendor.key }, "Sitemap crawl slice failed");
  }
  return backlogRemains;
}

/**
 * Starts the background crawler. Idempotent, and unref'd so it never holds the
 * process open on its own.
 *
 * Scheduling is a self-rescheduling timeout rather than an interval: a slice can
 * run for ten minutes, and an interval would keep firing while the previous
 * slice was still fetching. Waiting for completion also lets the delay adapt —
 * a minute while a backlog exists, six hours once every sitemap has converged.
 */
export function startSitemapCatalogCrawler(): void {
  if (sitemapCrawlTimer || sitemapCrawlStopped) return;
  const schedule = (delayMs: number) => {
    if (sitemapCrawlStopped) return;
    sitemapCrawlTimer = setTimeout(() => {
      void runSitemapCrawlSlices()
        .then((backlogRemains) => {
          schedule(backlogRemains ? SITEMAP_CRAWL_BACKLOG_DELAY_MS : SITEMAP_RECHECK_MS);
        })
        .catch((err) => {
          logger.error({ err }, "Sitemap crawl failed");
          schedule(SITEMAP_CRAWL_BACKLOG_DELAY_MS);
        });
    }, delayMs);
    sitemapCrawlTimer.unref();
  };
  schedule(0);
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
  const params = UpdatePartsCatalogStockParams.safeParse(req.params);
  const body = UpdatePartsCatalogStockBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "The stock quantity is invalid." });
    return;
  }
  try {
    const teamId = await requestTeamId(req);
    const result = await withTransaction((client) =>
      setOwnedQuantity(client, params.data.partId, body.data.quantityOwned, teamId),
    );
    if (!result.exists) {
      res.status(404).json({ error: "Catalog item not found." });
      return;
    }
    const savedItem = await getCatalogItem(params.data.partId, teamId);
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

router.patch("/parts/catalog/:partId/cost", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdatePartsCatalogCostParams.safeParse(req.params);
  const body = UpdatePartsCatalogCostBody.safeParse(req.body);
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
    const teamId = await requestTeamId(req);
    const updated = await pool.query(
      `update "parts_catalog_items"
       set "unit_cost" = $2, "cost_currency" = $3, "updated_at" = now()
       where "id" = $1 and ${teamSqlCondition('"team_id"', "$4")}
       returning "id"`,
      [params.data.partId, unitCost, costCurrency, teamId],
    );
    if (updated.rowCount === 0) {
      res.status(404).json({ error: "Catalog item not found." });
      return;
    }
    const savedItem = await getCatalogItem(params.data.partId, teamId);
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
    const params = CreatePartsPriceSnapshotParams.safeParse(req.params);
    const body = CreatePartsPriceSnapshotBody.safeParse(req.body);
    if (!params.success || !body.success) {
      res.status(400).json({ error: "The supplier quote details are invalid." });
      return;
    }
    try {
      const teamId = await requestTeamId(req);
      const partResult = await pool.query(
        `select "vendor_key" as "vendorKey" from "parts_catalog_items" where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}`,
        [params.data.partId, teamId],
      );
      if (partResult.rowCount === 0) {
        res.status(404).json({ error: "Catalog item not found." });
        return;
      }
      const vendorKey = String(partResult.rows[0].vendorKey);
      const vendor = vendorForKey(vendorKey);
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
    const params = GetPartsRobotDetailsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "The robot ID is invalid." });
      return;
    }
    try {
      const teamId = await requestTeamId(req);
      const robotResult = await pool.query(
        `select "id", "name", "preview_object_path" as "previewObjectPath",
                "preview_file_name" as "previewFileName",
                "preview_content_type" as "previewContentType",
                "created_at" as "createdAt", "updated_at" as "updatedAt"
         from "parts_robots" where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}`,
        [params.data.robotId, teamId],
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
    const teamId = await requestTeamId(req);
    const result = await pool.query(
      `insert into "parts_robots" ("id", "team_id", "name")
       values ($1, $2, $3)
       returning "id", "name", "preview_object_path" as "previewObjectPath",
                 "preview_file_name" as "previewFileName",
                 "preview_content_type" as "previewContentType",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [randomUUID(), teamId, name],
    );
    if (result.rowCount === 0) {
      res.status(409).json({ error: "A robot with that name already exists." });
      return;
    }
    res.status(201).json(CreatePartsRobotResponse.parse(mapRobot(result.rows[0])));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A robot with that name already exists." });
      return;
    }
    req.log.error({ err: error }, "Parts robot create failed");
    res.status(500).json({ error: "Unable to add the robot." });
  }
});

router.patch("/parts/robots/:robotId", requireAdmin, async (req, res): Promise<void> => {
  const params = UpdatePartsRobotParams.safeParse(req.params);
  const parsed = UpdatePartsRobotBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: params.success ? "Enter a robot name." : "Robot not found." });
    return;
  }
  const name = parsed.data.name.trim();
  if (!name) {
    res.status(400).json({ error: "Enter a robot name." });
    return;
  }
  try {
    const teamId = await requestTeamId(req);
    const result = await pool.query(
      `update "parts_robots" set "name" = $2, "updated_at" = now()
       where "id" = $1 and ${teamSqlCondition('"team_id"', "$3")}
       returning "id", "name", "preview_object_path" as "previewObjectPath",
                 "preview_file_name" as "previewFileName",
                 "preview_content_type" as "previewContentType",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [params.data.robotId, name, teamId],
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
    req.log.error({ err: error, robotId: params.data.robotId }, "Parts robot update failed");
    res.status(500).json({ error: "Unable to rename the robot." });
  }
});

router.patch(
  "/parts/robots/:robotId/preview",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdatePartsRobotPreviewParams.safeParse(req.params);
    const body = UpdatePartsRobotPreviewBody.safeParse(req.body);
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
      const teamId = await requestTeamId(req);
      const result = await withTransaction(async (client) => {
        const current = await client.query(
          `select "preview_object_path" as "previewObjectPath"
           from "parts_robots" where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} for update`,
          [params.data.robotId, teamId],
        );
        if (current.rowCount === 0) return null;
        const updated = await client.query(
          `update "parts_robots"
           set "preview_object_path" = $2, "preview_file_name" = $3,
               "preview_content_type" = $4, "updated_at" = now()
           where "id" = $1 and ${teamSqlCondition('"team_id"', "$5")}
           returning "id", "name", "preview_object_path" as "previewObjectPath",
                     "preview_file_name" as "previewFileName",
                     "preview_content_type" as "previewContentType",
                     "created_at" as "createdAt", "updated_at" as "updatedAt"`,
          [params.data.robotId, preview.objectPath, preview.fileName, preview.contentType, teamId],
        );
        return {
          robot: updated.rows[0],
          previousObjectPath: current.rows[0].previewObjectPath as string | null,
        };
      });
      if (!result) {
        res.status(404).json({ error: "Robot not found." });
        return;
      }
      if (result.previousObjectPath && result.previousObjectPath !== preview.objectPath) {
        try {
          await objectStorageService.deleteObject(result.previousObjectPath);
        } catch (error) {
          req.log.warn({ err: error, objectPath: result.previousObjectPath }, "Replaced robot preview cleanup failed");
        }
      }
      res.json(UpdatePartsRobotPreviewResponse.parse(mapRobot(result.robot)));
    } catch (error) {
      req.log.error({ err: error, robotId: params.data.robotId }, "Robot preview metadata update failed");
      res.status(500).json({ error: "Unable to update this robot's preview." });
    }
  },
);

router.delete(
  "/parts/robots/:robotId/preview",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeletePartsRobotPreviewParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "The robot preview request is invalid." });
      return;
    }

    try {
      const teamId = await requestTeamId(req);
      const result = await withTransaction(async (client) => {
        const current = await client.query(
          `select "preview_object_path" as "previewObjectPath"
           from "parts_robots" where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} for update`,
          [params.data.robotId, teamId],
        );
        if (current.rowCount === 0) return null;

        const updated = await client.query(
          `update "parts_robots"
           set "preview_object_path" = null, "preview_file_name" = null,
               "preview_content_type" = null, "updated_at" = now()
           where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
           returning "id", "name", "preview_object_path" as "previewObjectPath",
                     "preview_file_name" as "previewFileName",
                     "preview_content_type" as "previewContentType",
                     "created_at" as "createdAt", "updated_at" as "updatedAt"`,
          [params.data.robotId, teamId],
        );
        return {
          robot: updated.rows[0],
          previousObjectPath: current.rows[0].previewObjectPath as string | null,
        };
      });

      if (!result) {
        res.status(404).json({ error: "Robot not found." });
        return;
      }

      if (result.previousObjectPath) {
        try {
          if (/^\/objects\/[A-Za-z0-9-]{8,128}$/.test(result.previousObjectPath)) {
            if (!(await isPrivateObjectReferenced(result.previousObjectPath))) {
              await objectStorageService.deleteObject(result.previousObjectPath);
            }
          } else {
            req.log.warn(
              { objectPath: result.previousObjectPath, robotId: params.data.robotId },
              "Removed robot preview has an invalid object path; storage cleanup skipped",
            );
          }
        } catch (error) {
          req.log.warn(
            { err: error, objectPath: result.previousObjectPath, robotId: params.data.robotId },
            "Removed robot preview storage cleanup failed",
          );
        }
      }

      res.json(DeletePartsRobotPreviewResponse.parse(mapRobot(result.robot)));
    } catch (error) {
      req.log.error({ err: error, robotId: params.data.robotId }, "Robot preview removal failed");
      res.status(500).json({ error: "Unable to remove this robot's preview." });
    }
  },
);

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
        await requestTeamId(req),
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
