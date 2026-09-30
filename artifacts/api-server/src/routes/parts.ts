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
  type AssistantActivity,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/adminAuth";
import { extractVerifiedProductMetadata } from "../lib/partsProductMetadata";
import { catalogSearchVariants } from "../lib/partsSearchTerms";
import { logger } from "../lib/logger";

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
  imageUrl: string;
  price: string;
  currency: string;
  priceIsStartingAt: boolean;
};

export const ASSISTANT_PARTS_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_supplier_parts",
      description: "Search the 19 listed suppliers using keyless search, then return only official product pages with verified product details, an image, and a supplier-page price. Use this before adding a supplier part.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", minLength: 2, maxLength: 120 },
          vendorKey: { type: "string", maxLength: 100 },
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

async function searchWithTavily(
  query: string,
  allowedVendors: VendorConfig[],
): Promise<PublicCatalogSearchCandidate[]> {
  const searchVariants = catalogSearchVariants(query);
  const expandedQuery = searchVariants.length > 1
    ? `${query} (also listed as ${searchVariants.slice(1).join(", ")})`
    : query;
  const response = await fetch("https://api.tavily.com/search", {
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
          query: `Official supplier product pages matching "${expandedQuery}" from ${vendorScope}`,
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

async function enrichOfficialProductPage(
  candidate: PublicCatalogSearchCandidate,
): Promise<PublicCatalogSearchResult | null> {
  const vendor = vendorByKey.get(candidate.vendorKey);
  if (!vendor) return null;
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
      return null;
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
    if (!response.ok || !(contentType.includes("text/html") || contentType.includes("application/xhtml+xml"))) {
      return null;
    }
    const contentLength = Number(response.headers.get("content-length") ?? 0);
    if (contentLength > 2_000_000) return null;
    let html: string;
    try {
      html = await response.text();
    } catch {
      return null;
    }
    if (new TextEncoder().encode(html).byteLength > 2_000_000) return null;
    const metadata = extractVerifiedProductMetadata(html, target.toString(), candidate.title);
    if (!metadata) return null;
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
    };
  }
  return null;
}

async function searchPublicCatalog(query: string, vendor?: VendorConfig) {
  const allowedVendors = vendor ? [vendor] : VENDORS;
  const vendorGroups: VendorConfig[][] = [];
  for (let index = 0; index < allowedVendors.length; index += 4) {
    vendorGroups.push(allowedVendors.slice(index, index + 4));
  }
  const providerResults = await Promise.allSettled(
    vendorGroups.flatMap((group) => [
      searchWithTavily(query, group),
      searchWithExa(query, group),
    ]),
  );
  const combined = providerResults.flatMap((result) =>
    result.status === "fulfilled" ? result.value : [],
  );
  const searchPatterns = catalogSearchVariants(query).map((term) => `%${term}%`);
  const storedProducts = await pool.query(
    `select c."vendor_key" as "vendorKey", c."name", c."sku", c."description",
            c."product_url" as "url"
     from "parts_catalog_items" c
     where c."vendor_key" = any($1::text[])
       and c."product_url" is not null
       and (
          c."name" ilike any($2::text[])
          or coalesce(c."sku", '') ilike any($2::text[])
          or coalesce(c."category", '') ilike any($2::text[])
          or coalesce(c."description", '') ilike any($2::text[])
       )
     order by lower(c."name")
     limit 500`,
    [allowedVendors.map((item) => item.key), searchPatterns],
  );
  const storedCandidates = storedProducts.rows.flatMap((row) => {
    const itemUrl = typeof row.url === "string" ? row.url : null;
    const itemVendorKey = typeof row.vendorKey === "string" ? row.vendorKey : "";
    const storedVendor = vendorByKey.get(itemVendorKey);
    if (!itemUrl || !storedVendor) return [];
    return [{
      vendorKey: storedVendor.key,
      vendorName: storedVendor.name,
      title: String(row.name ?? storedVendor.name),
      url: itemUrl,
      description: String(row.description ?? ""),
    }];
  });
  if (
    providerResults.every((result) => result.status === "rejected") &&
    storedCandidates.length === 0
  ) {
    throw new Error("All keyless catalog search providers are unavailable.");
  }

  const seen = new Set<string>();
  const byVendor = new Map(allowedVendors.map((item) => [item.key, [] as PublicCatalogSearchCandidate[]]));
  for (const result of [...storedCandidates, ...combined]) {
    const parsedUrl = new URL(result.url);
    const key = `${result.vendorKey}:${parsedUrl.origin}${parsedUrl.pathname}`.toLowerCase();
    const bucket = byVendor.get(result.vendorKey);
    if (!bucket || seen.has(key)) continue;
    seen.add(key);
    bucket.push(result);
  }
  const candidates: PublicCatalogSearchCandidate[] = [];
  const candidatesPerVendor = vendor ? 24 : 8;
  for (let rank = 0; rank < candidatesPerVendor; rank += 1) {
    for (const allowedVendor of allowedVendors) {
      const candidate = byVendor.get(allowedVendor.key)?.[rank];
      if (candidate) candidates.push(candidate);
    }
  }

  const verifiedResults: PublicCatalogSearchResult[] = [];
  for (let index = 0; index < candidates.length; index += 12) {
    const batch = await Promise.allSettled(
      candidates.slice(index, index + 12).map(enrichOfficialProductPage),
    );
    for (const result of batch) {
      if (result.status === "fulfilled" && result.value) verifiedResults.push(result.value);
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
      const products = await searchPublicCatalog(query, vendorKey ? vendorByKey.get(vendorKey) : undefined);
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
      }));
      return result(JSON.stringify({ query, catalogIsExhaustive: false, results: items }), `${items.length} verified product page(s)`);
    }
    if (name === "list_parts_robots") {
      const rows = await pool.query(
        `select "id", "name", "created_at" as "createdAt", "updated_at" as "updatedAt"
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
  const feedUrl = vendor.publicProductFeedUrl ??
    new URL("/products.json", `https://${vendor.domain}`).toString();
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
        return partialCollection("Pagination stopped early; the records collected so far were retained.");
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
        return partialCollection("Pagination repeated an earlier page; the records collected so far were retained.");
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
        const offset = index * 9;
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
        );
        return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
      });
      const saved = await client.query(
        `insert into "parts_catalog_items"
           ("id", "vendor_key", "external_key", "name", "sku", "category", "description", "product_url", "image_url")
         values ${rows.join(", ")}
         on conflict ("vendor_key", "external_key") do update set
           "name" = excluded."name",
           "sku" = coalesce(excluded."sku", "parts_catalog_items"."sku"),
           "category" = coalesce(excluded."category", "parts_catalog_items"."category"),
           "description" = coalesce(excluded."description", "parts_catalog_items"."description"),
           "product_url" = coalesce(excluded."product_url", "parts_catalog_items"."product_url"),
           "image_url" = coalesce(excluded."image_url", "parts_catalog_items"."image_url"),
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
      itemCount: collection.records.length,
      created: counts.created,
      updated: counts.updated,
      source: collection.vendor.publicProductFeedUrl ?? null,
      message: collection.message,
    };
    logger.info(
      {
        vendorKey: collection.vendor.key,
        status: collection.status,
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
  }
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