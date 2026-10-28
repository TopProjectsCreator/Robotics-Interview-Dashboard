import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier);
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

const timestamp = new Date("2026-10-01T12:00:00.000Z");
const supplierSyncRows = [
  {
    vendorKey: "gobilda",
    status: "incomplete",
    checkedAt: timestamp,
    itemCount: 120,
    source: "https://www.gobilda.com/xmlsitemap.php?type=products&page=1",
    message: "53 pages still to crawl.",
    remainingPages: 53,
    estimatedSecondsRemaining: 660,
  },
  {
    vendorKey: "andymark",
    status: "synced",
    checkedAt: timestamp,
    itemCount: 40,
    source: "https://www.andymark.com/products.json",
    message: "Complete feed.",
    remainingPages: 15,
    estimatedSecondsRemaining: 300,
  },
  {
    vendorKey: "servocity",
    status: "unavailable",
    checkedAt: timestamp,
    itemCount: 25,
    source: "https://www.servocity.com/xmlsitemap.php?type=products&page=1",
    message: "The supplier source could not be reached.",
    remainingPages: 15,
    estimatedSecondsRemaining: 300,
  },
];
const items = [
  {
    id: "team-a-gear",
    teamId: "team-a",
    vendorKey: "andymark",
    name: "Tracked gear",
    sku: "GEAR-1",
    quantityOwned: 5,
    isManual: false,
    allocations: [
      { robotId: "team-a-robot", robotName: "Team A robot", quantity: 2 },
      { robotId: "team-b-robot", robotName: "Team B robot", quantity: 7 },
    ],
  },
  {
    id: "team-a-bearing",
    teamId: "team-a",
    vendorKey: "andymark",
    name: "Tracked bearing",
    sku: "BEARING-1",
    quantityOwned: 3,
    isManual: false,
    allocations: [],
  },
  {
    id: "team-a-allocation",
    teamId: "team-a",
    vendorKey: "ferra",
    name: "Tracked allocation",
    sku: "ALLOC-1",
    quantityOwned: 1,
    isManual: false,
    allocations: [{ robotId: "team-a-robot", robotName: "Team A robot", quantity: 1 }],
  },
  {
    id: "team-a-manual",
    teamId: "team-a",
    vendorKey: "andymark",
    name: "Manual spare",
    sku: null,
    quantityOwned: 0,
    isManual: true,
    allocations: [],
  },
  {
    id: "team-a-untracked",
    teamId: "team-a",
    vendorKey: "andymark",
    name: "Supplier catalog only",
    sku: "CATALOG-1",
    quantityOwned: 0,
    isManual: false,
    allocations: [],
  },
  {
    id: "team-b-private",
    teamId: "team-b",
    vendorKey: "andymark",
    name: "Other team tracked part",
    sku: "PRIVATE-1",
    quantityOwned: 7,
    isManual: false,
    allocations: [{ robotId: "team-b-robot", robotName: "Team B robot", quantity: 2 }],
  },
  {
    id: "shared-zero-count",
    teamId: null,
    vendorKey: "ferra",
    name: "Shared catalog item with no team stock",
    sku: "SHARED-ZERO",
    quantityOwned: 0,
    isManual: false,
    allocations: [],
  },
  {
    id: "shared-team-stock",
    teamId: null,
    vendorKey: "andymark",
    name: "Shared item with team-specific stock",
    sku: "SHARED-STOCK",
    quantityOwned: 0,
    isManual: false,
    allocations: [],
    teamInventory: {
      "team-a": { quantityOwned: 2, unitCost: "8.50", costCurrency: "USD", storageLocation: "A cabinet" },
      "team-b": { quantityOwned: 0, unitCost: null, costCurrency: null, storageLocation: null },
    },
  },
].map((item) => ({
  category: null,
  description: null,
  productUrl: null,
  imageUrl: null,
  storageLocation: null,
  inventoryNotes: null,
  unitCost: null,
  costCurrency: null,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...item,
}));

function teamFromQuery(statement, values) {
  const match = statement.match(/c\."team_id" = \$(\d+)/);
  assert.ok(match, "Parts query must scope catalog rows to a team");
  return values[Number(match[1]) - 1];
}

function matchesCatalogQuery(item, statement, values, teamId) {
  if (item.teamId !== teamId && !(item.teamId === null && !item.isManual)) return false;
  const inventory = item.teamInventory?.[teamId] ?? item;
  if (
    !statement.includes("tracked_inventory") &&
    statement.includes('c."is_manual" = true') &&
    !item.isManual
  ) return false;
  if (statement.includes("tracked_inventory")) {
    const hasTeamAllocation = item.allocations.some(
      (allocation) => allocation.quantity > 0 && allocation.robotId.startsWith(`${teamId}-`),
    );
    if (!item.isManual && inventory.quantityOwned <= 0 && !hasTeamAllocation) return false;
  }
  const vendorMatch = statement.match(/c\."vendor_key" = \$(\d+)/);
  if (vendorMatch && item.vendorKey !== values[Number(vendorMatch[1]) - 1]) return false;
  const searchMatch = statement.match(/ilike any\(\$(\d+)::text\[\]\)/);
  if (searchMatch) {
    const patterns = values[Number(searchMatch[1]) - 1];
    const text = [item.name, item.sku, item.category, item.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!patterns.some((pattern) => text.includes(pattern.replaceAll("%", "").toLowerCase()))) {
      return false;
    }
  }
  return true;
}

function mapCatalogRow(item, teamId) {
  const inventory = item.teamInventory?.[teamId] ?? item;
  const allocations = item.allocations.filter(({ robotId }) =>
    robotId.startsWith(`${teamId}-`),
  );
  const quantityAssigned = allocations.reduce(
    (total, allocation) => total + allocation.quantity,
    0,
  );
  return {
    id: item.id,
    vendorKey: item.vendorKey,
    name: item.name,
    sku: item.sku,
    category: item.category,
    description: item.description,
    productUrl: item.productUrl,
    imageUrl: item.imageUrl,
    storageLocation: inventory.storageLocation,
    inventoryNotes: inventory.inventoryNotes,
    unitCost: inventory.unitCost,
    costCurrency: inventory.costCurrency,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    quantityOwned: inventory.quantityOwned,
    quantityAssigned,
    allocations: allocations.map((allocation) => ({
      ...allocation,
      partId: item.id,
    })),
  };
}

test("Parts inventory lists tracked supplier stock with team-scoped totals and filters", async (t) => {
  const catalogQueries = [];
  const pool = {
    async query(statement, values = []) {
      if (statement.includes('from "parts_vendor_blocks"')) {
        return { rows: [], rowCount: 0 };
      }
      if (statement.includes('from "parts_supplier_sync_states"')) {
        return { rows: supplierSyncRows, rowCount: supplierSyncRows.length };
      }
      if (statement.includes('from "parts_robots" where')) {
        return { rows: [], rowCount: 0 };
      }
      if (statement.includes('as "ownedUnits"')) {
        assert.match(statement, /c\."team_id"/, "owned totals must be scoped to catalog team");
        assert.match(statement, /r\."team_id"/, "assigned totals must be scoped to robot team");
        const teamId = values[0];
        const teamItems = items.filter(
          (item) => item.teamId === teamId || (item.teamId === null && !item.isManual),
        );
        return {
          rows: [{
            catalogItems: teamItems.length,
            ownedUnits: teamItems.reduce(
              (sum, item) => sum + (item.teamInventory?.[teamId] ?? item).quantityOwned,
              0,
            ),
            assignedUnits: teamItems.reduce(
              (sum, item) => sum + item.allocations
                .filter(({ robotId }) => robotId.startsWith(`${teamId}-`))
                .reduce((total, allocation) => total + allocation.quantity, 0),
              0,
            ),
          }],
          rowCount: 1,
        };
      }
      if (statement.includes('select count(*)::int as "total"')) {
        catalogQueries.push({ statement, values });
        const teamId = teamFromQuery(statement, values);
        const found = items.filter((item) => matchesCatalogQuery(item, statement, values, teamId));
        return { rows: [{ total: found.length }], rowCount: 1 };
      }
      if (statement.includes('from "parts_catalog_items" c')) {
        catalogQueries.push({ statement, values });
        const teamId = teamFromQuery(statement, values);
        const found = items
          .filter((item) => matchesCatalogQuery(item, statement, values, teamId))
          .sort((left, right) =>
            right.updatedAt.getTime() - left.updatedAt.getTime() ||
            left.name.localeCompare(right.name) ||
            left.id.localeCompare(right.id),
          );
        const limit = Number(values.at(-2));
        const offset = Number(values.at(-1));
        return {
          rows: found.slice(offset, offset + limit).map((item) => mapCatalogRow(item, teamId)),
          rowCount: Math.min(limit, Math.max(0, found.length - offset)),
        };
      }
      throw new Error(`Unexpected inventory listing query: ${statement}`);
    },
  };

  mock.module("@workspace/db", {
    namedExports: {
      pool,
      db: {},
      primaryDb: {},
      primaryPool: pool,
      interviewerAccountsTable: {},
      revokedSessionsTable: {},
      teamsTable: {},
      DEFAULT_TEAM_ID: "default",
      normalizeTeamName: (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase(),
      runWithInstance: (_instance, fn) => fn(),
      currentInstance: () => "primary",
      enterInstance: () => {},
      secondaryDb: () => null,
      secondaryPool: () => null,
      hasSecondary: () => false,
    },
  });
  mock.module("../middlewares/adminAuth", {
    namedExports: {
      requireAdmin: (_req, _res, next) => next(),
      requireInboxAdmin: (_req, _res, next) => next(),
      requestTeamId: async (req) => req.get("x-team-id") ?? "team-a",
    },
  });
  t.after(() => mock.restoreAll());

  const [{ default: express }, { default: partsRouter }] = await Promise.all([
    import("express"),
    import(`../routes/parts.ts?inventory-listing=${Date.now()}`),
  ]);
  const app = express();
  app.use((req, _res, next) => {
    req.log = { error() {}, warn() {} };
    next();
  });
  app.use("/api", partsRouter);
  const server = app.listen(0, "127.0.0.1");
  t.after(async () => {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  });
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const get = async (path, teamId = "team-a") => {
    const response = await fetch(`${baseUrl}${path}`, { headers: { "x-team-id": teamId } });
    assert.equal(response.status, 200, `${path} should succeed`);
    return response.json();
  };

  const dashboard = await get("/parts/dashboard");
  assert.deepEqual(
    {
      ownedUnits: dashboard.summary.ownedUnits,
      assignedUnits: dashboard.summary.assignedUnits,
      availableUnits: dashboard.summary.availableUnits,
    },
    { ownedUnits: 11, assignedUnits: 3, availableUnits: 8 },
  );
  assert.deepEqual(
    {
      remainingPages: dashboard.vendors.find(({ key }) => key === "gobilda").lastSync.remainingPages,
      estimatedSecondsRemaining: dashboard.vendors.find(({ key }) => key === "gobilda").lastSync.estimatedSecondsRemaining,
    },
    { remainingPages: 53, estimatedSecondsRemaining: 660 },
  );
  assert.equal(
    dashboard.vendors.find(({ key }) => key === "andymark").lastSync.remainingPages,
    undefined,
    "completed suppliers must not expose stale crawl progress",
  );
  assert.equal(
    dashboard.vendors.find(({ key }) => key === "servocity").lastSync.estimatedSecondsRemaining,
    undefined,
    "failed supplier checks must not expose a crawl estimate",
  );

  const inventory = await get("/parts/catalog?inventoryOnly=true&limit=100");
  assert.equal(inventory.total, 5);
  assert.deepEqual(
    inventory.items.map(({ id }) => id).sort(),
    ["shared-team-stock", "team-a-allocation", "team-a-bearing", "team-a-gear", "team-a-manual"],
  );
  assert.equal(inventory.items.some(({ id }) => id === "team-a-untracked"), false);
  assert.equal(inventory.items.some(({ id }) => id === "team-b-private"), false);
  assert.equal(
    inventory.items.reduce((sum, item) => sum + item.quantityOwned, 0),
    dashboard.summary.ownedUnits,
  );
  assert.equal(
    inventory.items.reduce((sum, item) => sum + item.quantityAssigned, 0),
    dashboard.summary.assignedUnits,
  );

  const firstFilteredPage = await get(
    "/parts/catalog?inventoryOnly=true&search=Tracked&vendorKey=andymark&limit=1&offset=0",
  );
  const secondFilteredPage = await get(
    "/parts/catalog?inventoryOnly=true&search=Tracked&vendorKey=andymark&limit=1&offset=1",
  );
  assert.equal(firstFilteredPage.total, 2);
  assert.equal(secondFilteredPage.total, 2);
  assert.equal(firstFilteredPage.items.length, 1);
  assert.equal(secondFilteredPage.items.length, 1);
  assert.notEqual(firstFilteredPage.items[0].id, secondFilteredPage.items[0].id);

  const manuallySaved = await get("/parts/catalog?manualOnly=true");
  assert.deepEqual(manuallySaved.items.map(({ id }) => id), ["team-a-manual"]);
  const otherTeamInventory = await get("/parts/catalog?inventoryOnly=true", "team-b");
  assert.deepEqual(otherTeamInventory.items.map(({ id }) => id), ["team-b-private"]);
  const teamACatalog = await get("/parts/catalog", "team-a");
  const teamBCatalog = await get("/parts/catalog", "team-b");
  assert.equal(teamACatalog.items.some(({ id }) => id === "shared-zero-count"), true);
  assert.equal(teamBCatalog.items.some(({ id }) => id === "shared-zero-count"), true);
  assert.equal(teamACatalog.items.some(({ id }) => id === "shared-team-stock"), true);
  assert.equal(teamBCatalog.items.some(({ id }) => id === "shared-team-stock"), true);
  assert.equal(
    teamACatalog.items.find(({ id }) => id === "shared-team-stock").quantityOwned,
    2,
  );
  assert.equal(
    teamACatalog.items.find(({ id }) => id === "shared-team-stock").unitCost,
    8.5,
  );
  assert.equal(
    teamACatalog.items.find(({ id }) => id === "shared-team-stock").storageLocation,
    "A cabinet",
  );
  assert.equal(
    teamBCatalog.items.find(({ id }) => id === "shared-team-stock").quantityOwned,
    0,
    "one team's stock must not be exposed to another team using the shared catalog",
  );
  assert.equal(
    teamBCatalog.items.find(({ id }) => id === "shared-team-stock").unitCost,
    null,
  );
  assert.equal(
    teamBCatalog.items.find(({ id }) => id === "shared-team-stock").storageLocation,
    null,
  );
  assert.equal(
    teamACatalog.items.find(({ id }) => id === "shared-zero-count").quantityOwned,
    0,
    "shared supplier rows with no team stock remain present without implying owned stock",
  );
  assert.equal(
    teamBCatalog.items.find(({ id }) => id === "shared-zero-count").quantityOwned,
    0,
  );
  assert.ok(
    catalogQueries
      .filter(({ statement }) => statement.includes("json_agg("))
      .every(({ statement }) =>
        statement.includes('scoped_robot."team_id"'),
      ),
    "listed allocations must be scoped to the current team’s robots",
  );
});
