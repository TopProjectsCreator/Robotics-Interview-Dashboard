import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
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

test("supplier block routes are admin-only, team-scoped, and enforced by assistant sourcing", async (t) => {
  const httpFetch = globalThis.fetch.bind(globalThis);
  const blocks = new Map();
  const statements = [];
  const liveFetches = [];
  const partRow = {
    id: "shared-andymark-part",
    vendorKey: "andymark",
    name: "8 mm shaft collar",
    sku: "COLLAR-8",
    category: "Hardware",
    description: "An indexed supplier item.",
    productUrl: "https://www.andymark.com/products/shaft-collar",
    imageUrl: null,
    storageLocation: null,
    inventoryNotes: null,
    unitCost: null,
    costCurrency: null,
    quantityOwned: 0,
    quantityAssigned: 0,
    allocations: [],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const blockedForTeam = (teamId, vendorKey) => blocks.has(`${teamId}:${vendorKey}`);
  const pool = {
    async query(statement, values = []) {
      statements.push({ statement, values });
      if (
        statement.includes('from "parts_vendor_blocks"') ||
        statement.includes('into "parts_vendor_blocks"')
      ) {
        const teamId = values[0];
        if (statement.startsWith("select")) {
          return {
            rows: [...blocks]
              .filter(([key]) => key.startsWith(`${teamId}:`))
              .map(([key]) => ({ vendorKey: key.slice(teamId.length + 1) })),
            rowCount: [...blocks].filter(([key]) => key.startsWith(`${teamId}:`)).length,
          };
        }
        if (statement.startsWith("insert")) {
          blocks.set(`${values[0]}:${values[1]}`, true);
          return { rows: [], rowCount: 1 };
        }
        if (statement.startsWith("delete")) {
          const removed = blocks.delete(`${values[0]}:${values[1]}`);
          return { rows: [], rowCount: removed ? 1 : 0 };
        }
      }
      if (statement.includes('from "parts_supplier_sync_states"')) {
        return { rows: [], rowCount: 0 };
      }
      if (statement.includes('select count(*)::int as "total"')) {
        const teamId = values.find((value) => value === "team-a" || value === "team-b");
        const denied = values.find((value) => Array.isArray(value) && value.includes("andymark"));
        return {
          rows: [{ total: denied && blockedForTeam(teamId, "andymark") ? 0 : 1 }],
          rowCount: 1,
        };
      }
      if (statement.includes('from "parts_catalog_items" c')) {
        const teamId = values.find((value) => value === "team-a" || value === "team-b");
        const denied = values.find((value) => Array.isArray(value) && value.includes("andymark"));
        if (denied && blockedForTeam(teamId, "andymark")) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [partRow], rowCount: 1 };
      }
      throw new Error(`Unexpected supplier block query: ${statement}`);
    },
    async connect() {
      return {
        async query(statement, values = []) {
          statements.push({ statement, values });
          if (["BEGIN", "COMMIT", "ROLLBACK"].includes(statement)) {
            return { rows: [], rowCount: 0 };
          }
          if (statement.includes('from "parts_vendor_blocks"')) {
            return {
              rows: blockedForTeam(values[0], values[1]) ? [{ "?column?": 1 }] : [],
              rowCount: blockedForTeam(values[0], values[1]) ? 1 : 0,
            };
          }
          throw new Error(`Unexpected supplier block transaction query: ${statement}`);
        },
        release() {},
      };
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
      runWithInstance: (_instance, callback) => callback(),
      currentInstance: () => "primary",
      enterInstance: () => {},
      secondaryDb: () => null,
      secondaryPool: () => null,
      hasSecondary: () => false,
    },
  });
  const requireAdmin = (req, res, next) => {
    if (req.get("x-test-auth") !== "valid") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    next();
  };
  mock.module("../middlewares/adminAuth.ts", {
    namedExports: {
      requireAdmin,
      requireInboxAdmin: (req, res, next) => {
        requireAdmin(req, res, () => {
          if (!["admin", "coordinator"].includes(req.get("x-test-role"))) {
            res.status(403).json({ error: "Admins only" });
            return;
          }
          next();
        });
      },
      requestTeamId: async (req) => req.get("x-test-team") || "default",
    },
  });
  mock.method(globalThis, "fetch", async (input) => {
    liveFetches.push(String(input));
    return new Response("supplier search unavailable", { status: 503 });
  });
  t.after(() => mock.restoreAll());

  const [{ default: express }, partsModule] = await Promise.all([
    import("express"),
    import("../routes/parts.ts"),
  ]);
  const partsRouter = partsModule.default;
  const { runAssistantPartsTool } = partsModule;
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.log = {
      error: (fields, message) => console.error(message, fields?.err ?? ""),
      warn() {},
    };
    next();
  });
  app.use("/api", partsRouter);
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const request = (path, { team = "team-a", role = "admin", auth = "valid", ...options } = {}) =>
    httpFetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        ...(options.headers ?? {}),
        ...(auth ? { "x-test-auth": auth } : {}),
        "x-test-role": role,
        "x-test-team": team,
      },
    });

  assert.equal((await request("/parts/vendors/blocks", { auth: "" })).status, 401);
  assert.equal((await request("/parts/vendors/andymark/block", {
    method: "PUT",
    role: "interviewer",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocked: true }),
  })).status, 403);

  const blockResponse = await request("/parts/vendors/andymark/block", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocked: true }),
  });
  assert.equal(blockResponse.status, 200);
  assert.deepEqual(await blockResponse.json(), { vendorKey: "andymark", blocked: true });
  assert.equal((await request("/parts/vendors/not-registered/block", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ blocked: true }),
  })).status, 400);

  const teamAList = await request("/parts/vendors/blocks");
  assert.deepEqual(await teamAList.json(), { blockedVendorKeys: ["andymark"] });
  const teamBList = await request("/parts/vendors/blocks", { team: "team-b" });
  assert.deepEqual(await teamBList.json(), { blockedVendorKeys: [] });

  const blockedCatalogSearch = await request(
    "/parts/catalog/search?q=shaft%20collar&vendorKey=andymark",
  );
  assert.equal(blockedCatalogSearch.status, 200);
  const blockedCatalogSearchBody = await blockedCatalogSearch.json();
  assert.deepEqual(blockedCatalogSearchBody.results, []);
  assert.equal(blockedCatalogSearchBody.catalogTotal, 0);

  const blockedStream = await request(
    "/parts/catalog/search/stream?q=shaft%20collar&vendorKey=andymark",
  );
  assert.equal(blockedStream.status, 200);
  const streamEvents = (await blockedStream.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.deepEqual(streamEvents.map(({ type }) => type), ["catalog", "complete"]);
  assert.equal(streamEvents.some(({ type }) => type === "result"), false);

  const sourcedCatalogPage = await request("/parts/catalog?search=collar");
  assert.deepEqual((await sourcedCatalogPage.json()).items, []);
  const existingInventory = await request("/parts/catalog?inventoryOnly=true&search=collar");
  assert.equal((await existingInventory.json()).items[0].id, partRow.id);

  const teamASearch = JSON.parse((await runAssistantPartsTool("search_supplier_parts", {
    query: "shaft collar",
    vendorKey: "andymark",
  }, "team-a")).content);
  assert.equal(teamASearch.syncedCatalog.total, 0);
  assert.deepEqual(teamASearch.results, []);
  assert.equal(teamASearch.vendorCoverage.find(({ vendorKey }) => vendorKey === "andymark").blocked, true);
  assert.deepEqual(liveFetches, [], "a blocked supplier is not queried by assistant live search");

  const teamBSearch = JSON.parse((await runAssistantPartsTool("search_supplier_parts", {
    query: "shaft collar",
    vendorKey: "andymark",
  }, "team-b")).content);
  assert.equal(teamBSearch.syncedCatalog.total, 1);
  assert.equal(teamBSearch.syncedCatalog.items[0].vendorKey, "andymark");
  assert.ok(liveFetches.length > 0, "another team can still search the same supplier");

  const blockedManualWrite = await request("/parts/catalog", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ vendorKey: "andymark", name: "New shaft collar" }),
  });
  assert.equal(blockedManualWrite.status, 400);
  const blockedImport = await request("/parts/catalog/import", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ items: [{ vendorKey: "andymark", name: "Imported collar" }] }),
  });
  assert.equal(blockedImport.status, 400);

  const blockedCreate = await runAssistantPartsTool("create_parts_catalog_item", {
    vendorKey: "andymark",
    name: "New shaft collar",
  }, "team-a");
  assert.match(blockedCreate.content, /supplier is blocked/i);
  assert.equal(
    statements.some(({ statement }) => statement.startsWith('insert into "parts_catalog_items"')),
    false,
    "blocked vendor-backed catalog writes do not reach the catalog",
  );
});
