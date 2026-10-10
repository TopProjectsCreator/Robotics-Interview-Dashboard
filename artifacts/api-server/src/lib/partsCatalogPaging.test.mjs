import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { SearchPartsCatalogResponse } from "../../../../lib/api-zod/src/generated/api.ts";
import { teamsTable, DEFAULT_TEAM_ID, normalizeTeamName } from "../../../../lib/db/src/schema/teams.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (
        specifier.startsWith(".") &&
        !specifier.endsWith(".ts") &&
        !specifier.endsWith(".js")
      ) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});

const catalog = Array.from({ length: 205 }, (_, index) => {
  const partNumber = String(index).padStart(3, "0");
  const vendorKey = index % 2 === 0 ? "andymark" : "ferra";
  return {
    id: `${vendorKey}-part-${partNumber}`,
    vendorKey,
    name: "Widget",
    sku: `${vendorKey.toUpperCase()}-WIDGET-${partNumber}`,
    category: "Widgets",
    description: "Synced widget catalog item",
    productUrl: null,
    imageUrl: null,
    unitCost: null,
    costCurrency: null,
    quantityOwned: 0,
    quantityAssigned: 0,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    allocations: [],
  };
}).reverse();
const expectedCatalog = [...catalog].sort((left, right) =>
  left.id.localeCompare(right.id),
);

test("assistant catalog search pages beyond 100 matches without gaps or duplicates", async (t) => {
  const pageQueries = [];
  const catalogQueries = [];
  const pool = {
    async query(statement, values = []) {
      if (statement.includes('from "parts_supplier_sync_states"')) {
        return { rows: [] };
      }

      const vendorKey = statement.includes('c."vendor_key" = $1')
        ? values[0]
        : undefined;
      const matches = catalog
        .filter((item) => !vendorKey || item.vendorKey === vendorKey)
        .sort(
          (left, right) =>
            right.updatedAt.getTime() - left.updatedAt.getTime() ||
            left.name.localeCompare(right.name) ||
            left.id.localeCompare(right.id),
        );
      if (statement.includes("select count(*)::int as")) {
        return { rows: [{ total: matches.length }] };
      }

      if (statement.includes('from "parts_catalog_items" c')) {
        const limit = Number(values.at(-2));
        const offset = Number(values.at(-1));
        pageQueries.push({ limit, offset });
        catalogQueries.push(statement);
        return { rows: matches.slice(offset, offset + limit) };
      }

      throw new Error(`Unexpected Parts query: ${statement}`);
    },
  };

  mock.module("@workspace/db", {
    namedExports: {
      pool,
      db: {},
      interviewerAccountsTable: {},
      revokedSessionsTable: {},
      teamsTable,
      DEFAULT_TEAM_ID,
      normalizeTeamName,
    },
  });
  mock.method(
    globalThis,
    "fetch",
    async () => new Response("", { status: 503 }),
  );

  t.after(() => mock.restoreAll());

  const { runAssistantPartsTool } = await import("../routes/parts.ts");
  const readPage = async (offset) => {
    const response = await runAssistantPartsTool("search_supplier_parts", {
      query: "widget",
      limit: 100,
      offset,
    });
    assert.equal(response.activity.tool, "search_supplier_parts");
    return JSON.parse(response.content);
  };

  const pages = await Promise.all([readPage(0), readPage(100), readPage(200)]);
  assert.deepEqual(
    pages.map(({ syncedCatalog }) => syncedCatalog.items.length),
    [100, 100, 5],
  );
  assert.deepEqual(
    pages.map(({ syncedCatalog }) => [
      syncedCatalog.offset,
      syncedCatalog.limit,
      syncedCatalog.total,
    ]),
    [
      [0, 100, 205],
      [100, 100, 205],
      [200, 100, 205],
    ],
  );
  assert.deepEqual(pageQueries, [
    { limit: 100, offset: 0 },
    { limit: 100, offset: 100 },
    { limit: 100, offset: 200 },
  ]);

  const catalogItems = pages.flatMap(
    ({ syncedCatalog }) => syncedCatalog.items,
  );
  assert.equal(catalogItems.length, 205);
  assert.deepEqual(
    catalogItems.map(({ id }) => id),
    expectedCatalog.map(({ id }) => id),
  );
  assert.equal(new Set(catalogItems.map(({ id }) => id)).size, 205);
  assert.deepEqual(
    catalogItems.map(({ vendorKey }) => vendorKey),
    expectedCatalog.map(({ vendorKey }) => vendorKey),
  );
  assert.deepEqual(
    catalogItems.map(({ sku }) => sku),
    expectedCatalog.map(({ sku }) => sku),
  );
  assert.ok(
    catalogQueries.every((statement) =>
      /order by c\."updated_at" desc, lower\(c\."name"\), c\."id"/i.test(
        statement,
      ),
    ),
    "catalog pagination has a deterministic final sort key",
  );

  for (const page of pages) {
    assert.equal(
      page.results.length,
      0,
      "live discoveries stay separate from saved catalog items",
    );
    assert.equal(page.liveSearchStatus, "unavailable");
    assert.equal(
      SearchPartsCatalogResponse.safeParse({
        query: page.query,
        results: page.results,
        catalogItems: page.syncedCatalog.items,
        catalogTotal: page.syncedCatalog.total,
        catalogOffset: page.syncedCatalog.offset,
        catalogLimit: page.syncedCatalog.limit,
        liveSearchStatus: page.liveSearchStatus,
      }).success,
      true,
    );
  }

  for (const offset of [205, 250]) {
    const page = await readPage(offset);
    assert.equal(page.syncedCatalog.total, 205);
    assert.equal(page.syncedCatalog.offset, offset);
    assert.deepEqual(page.syncedCatalog.items, []);
  }
});
