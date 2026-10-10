import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

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

const canary = "PRIVATE_PARTS_CANARY_84";
const request = globalThis.fetch.bind(globalThis);
const robotId = `${canary}_ROBOT`;
const partId = `${canary}_PART`;
const now = new Date("2026-10-01T12:00:00.000Z");
const robotRow = {
  id: robotId,
  name: `${canary} robot`,
  previewObjectPath: null,
  previewFileName: null,
  previewContentType: null,
  createdAt: now,
  updatedAt: now,
};
const catalogRow = {
  id: partId,
  vendorKey: "andymark",
  name: `${canary} catalog item`,
  sku: null,
  category: null,
  description: null,
  productUrl: null,
  imageUrl: null,
  unitCost: null,
  costCurrency: null,
  quantityOwned: 3,
  quantityAssigned: 0,
  allocations: [],
  createdAt: now,
  updatedAt: now,
};

test("signed-out visitors cannot read private Parts records from any GET endpoint", async (t) => {
  let databaseReads = 0;
  const pool = {
    async query(statement) {
      databaseReads += 1;
      if (
        statement.includes('from "parts_robots"') &&
        statement.includes("order by lower")
      ) {
        return { rows: [robotRow], rowCount: 1 };
      }
      if (statement.includes('(select count(*)::int from "parts_catalog_items")')) {
        return {
          rows: [{ catalogItems: 1, ownedUnits: 3, assignedUnits: 0 }],
          rowCount: 1,
        };
      }
      if (statement.includes('from "parts_supplier_sync_states"')) {
        return { rows: [], rowCount: 0 };
      }
      if (statement.includes('select count(*)::int as "total"')) {
        return { rows: [{ total: 1 }], rowCount: 1 };
      }
      if (statement.includes('from "parts_catalog_items" c')) {
        return { rows: [catalogRow], rowCount: 1 };
      }
      if (
        statement.includes('from "parts_robots" where "id" = $1')
      ) {
        return { rows: [robotRow], rowCount: 1 };
      }
      if (statement.includes('from "parts_robot_allocations" a')) {
        return { rows: [], rowCount: 0 };
      }
      throw new Error(`Unexpected Parts authorization test query: ${statement}`);
    },
  };

  mock.module("@workspace/db", {
    namedExports: {
      pool,
      db: {},
      interviewerAccountsTable: {},
      revokedSessionsTable: {},
      teamsTable: {},
      DEFAULT_TEAM_ID: "default",
      normalizeTeamName: (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase(),
    },
  });
  mock.method(globalThis, "fetch", async () => new Response("", { status: 503 }));
  t.after(() => mock.restoreAll());

  const [{ default: express }, { default: partsRouter }] = await Promise.all([
    import("express"),
    import("../routes/parts.ts"),
  ]);
  const app = express();
  app.use("/api", partsRouter);
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const privateReadPaths = [
      "/parts/dashboard",
      "/parts/catalog",
      "/parts/catalog/search?q=canary",
      `/parts/robots/${encodeURIComponent(robotId)}/details`,
    ];

    for (const path of privateReadPaths) {
      const response = await request(`${baseUrl}${path}`);
      const body = await response.text();

      assert.equal(response.status, 401, `GET ${path} must require a team session`);
      assert.equal(body.includes(canary), false, `GET ${path} must not return the private canary`);
    }

    assert.equal(databaseReads, 0, "unauthenticated Parts reads must stop before querying private records");
  } finally {
    if (server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
});