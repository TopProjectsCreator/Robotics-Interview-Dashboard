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
};

const VENDORS: VendorConfig[] = [
  { key: "andymark", name: "Andymark", group: "General Parts", website: "https://www.andymark.com/", domain: "andymark.com", catalogMode: "products" },
  { key: "gobilda", name: "goBILDA", group: "General Parts", website: "https://www.gobilda.com/", domain: "gobilda.com", catalogMode: "products" },
  { key: "grainger", name: "Grainger", group: "General Parts", website: "https://www.grainger.com/", domain: "grainger.com", catalogMode: "products" },
  { key: "rev-robotics", name: "REV Robotics", group: "General Parts", website: "https://www.revrobotics.com/", domain: "revrobotics.com", catalogMode: "products" },
  { key: "servocity", name: "ServoCity", group: "General Parts", website: "https://www.servocity.com/", domain: "servocity.com", catalogMode: "products" },
  { key: "studica", name: "Studica", group: "General Parts", website: "https://www.studica.com/", domain: "studica.com", catalogMode: "products" },
  { key: "swyft", name: "Swyft", group: "Specific Parts", website: "https://swyftrobotics.com/", domain: "swyftrobotics.com", catalogMode: "products" },
  { key: "ferra", name: "Ferra", group: "Specific Parts", website: "https://ferracomponents.com/", domain: "ferracomponents.com", catalogMode: "products" },
  { key: "axon-robotics", name: "Axon Robotics", group: "Specific Parts", website: "https://axon-robotics.com/", domain: "axon-robotics.com", catalogMode: "products" },
  { key: "bwtlink", name: "BWTLink", group: "Specific Parts", website: "https://bwtlink.com/", domain: "bwtlink.com", catalogMode: "products" },
  { key: "melonbotics", name: "Melonbotics", group: "Specific Parts", website: "https://melonbotics.com/", domain: "melonbotics.com", catalogMode: "products" },
  { key: "misumi", name: "Misumi", group: "Specific Parts", website: "https://us.misumi-ec.com/", domain: "misumi-ec.com", catalogMode: "products" },
  { key: "optii", name: "Optii", group: "Specific Parts", website: "https://optii.com.au/", domain: "optii.com.au", catalogMode: "products" },
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

async function searchPublicVendorCatalog(vendor: VendorConfig, query: string) {
  const response = await fetch("https://mcp.firecrawl.dev/mcp", {
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
        name: "firecrawl_search",
        arguments: {
          query: `${vendor.name} ${query} product part`,
          sources: ["web"],
          includeDomains: [vendor.domain],
          limit: 8,
          domainTools: false,
        },
      },
    }),
    signal: AbortSignal.timeout(25_000),
  });
  if (!response.ok) throw new Error(`Catalog search returned ${response.status}`);
  const envelope = parseSseResponse(await response.text());
  if (!isRecord(envelope) || !isRecord(envelope.result) || envelope.result.isError) {
    throw new Error("Catalog search returned an invalid response");
  }
  const content = envelope.result.content;
  if (!Array.isArray(content)) throw new Error("Catalog search returned no results");
  const textBlock = content.find(
    (item) => isRecord(item) && item.type === "text" && typeof item.text === "string",
  );
  if (!isRecord(textBlock) || typeof textBlock.text !== "string") {
    throw new Error("Catalog search result was empty");
  }
  const searchPayload = JSON.parse(textBlock.text) as unknown;
  if (!isRecord(searchPayload) || !isRecord(searchPayload.data)) {
    throw new Error("Catalog search result was malformed");
  }
  const webResults = searchPayload.data.web;
  if (!Array.isArray(webResults)) return [];

  const seen = new Set<string>();
  const results = [];
  for (const item of webResults) {
    if (!isRecord(item) || typeof item.url !== "string") continue;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(item.url);
    } catch {
      continue;
    }
    const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
    if (
      (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") ||
      (hostname !== vendor.domain && !hostname.endsWith(`.${vendor.domain}`)) ||
      seen.has(parsedUrl.toString())
    ) {
      continue;
    }
    seen.add(parsedUrl.toString());
    results.push({
      title: typeof item.title === "string" ? item.title.slice(0, 300) : vendor.name,
      url: parsedUrl.toString(),
      description:
        typeof item.description === "string"
          ? item.description.slice(0, 1200)
          : typeof item.snippet === "string"
            ? item.snippet.slice(0, 1200)
            : "",
    });
  }
  return results;
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
  if (!vendorKey || !query || query.length < 2) {
    res.status(400).json({ error: "Choose a vendor and enter at least two search characters." });
    return;
  }
  const vendor = vendorByKey.get(vendorKey);
  if (!vendor) {
    res.status(400).json({ error: "Choose one of the listed vendors." });
    return;
  }
  try {
    const results = await searchPublicVendorCatalog(vendor, query);
    res.json(
      SearchPartsCatalogResponse.parse({
        vendorKey,
        query,
        results,
      }),
    );
  } catch (error) {
    req.log.error({ err: error, vendorKey }, "Public vendor catalog search failed");
    res.status(502).json({
      error: "The vendor catalog search is temporarily unavailable. Try again or import a vendor catalog file.",
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