import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { GetPartsCatalogDetailsResponse } from "../../../../lib/api-zod/src/generated/api.ts";

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

test("part details return generated-contract data scoped to the signed-in team", async (t) => {
  const partId = "team-a-saved-bracket";
  const timestamp = new Date("2026-10-01T12:00:00.000Z");
  const catalogRow = {
    id: partId,
    vendorKey: "andymark",
    name: "Saved bracket",
    sku: "BRACKET-42",
    category: "Structure",
    description: "Supplier description",
    productUrl: "https://www.andymark.com/products/saved-bracket",
    imageUrl: "https://images.example.test/saved-bracket.png",
    storageLocation: "Team A shelf",
    inventoryNotes: "Keep with the spares",
    unitCost: 12.5,
    costCurrency: "USD",
    createdAt: timestamp,
    updatedAt: timestamp,
    quantityOwned: 4,
    quantityAssigned: 1,
    allocations: [
      {
        robotId: "team-a-robot",
        robotName: "Team A robot",
        partId,
        quantity: 1,
      },
    ],
  };
  const queries = [];
  const pool = {
    async query(statement, values = []) {
      queries.push({ statement, values });
      if (statement.includes('from "parts_catalog_items" c')) {
        assert.match(
          statement,
          /c\."team_id"/,
          "part lookup must be team-scoped",
        );
        return values[1] === "team-a"
          ? { rows: [catalogRow], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      }
      if (statement.includes('from "parts_supplier_price_snapshots" s')) {
        assert.match(
          statement,
          /c\."team_id"/,
          "quote history must follow the owning team's catalog record",
        );
        assert.deepEqual(values, [partId, "team-a"]);
        return {
          rows: [
            {
              id: "team-a-quote-1",
              partId,
              unitPrice: "14.75",
              currency: "USD",
              sourceUrl: "https://www.andymark.com/products/saved-bracket",
              capturedAt: timestamp,
              isStartingAt: true,
              vendorKey: "andymark",
            },
          ],
          rowCount: 1,
        };
      }
      if (statement.includes('from "parts_inventory" i')) {
        assert.match(
          statement,
          /c\."team_id"/,
          "location suggestions must be team-scoped",
        );
        assert.deepEqual(values, ["team-a"]);
        return { rows: [{ storageLocation: "Team A shelf" }], rowCount: 1 };
      }
      throw new Error(`Unexpected part-details query: ${statement}`);
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
      normalizeTeamName: (value) =>
        String(value ?? "")
          .trim()
          .replace(/\s+/g, " ")
          .toLocaleLowerCase(),
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
      requestTeamId: async (req) => req.get("x-team-id") ?? "team-a",
    },
  });
  t.after(() => mock.restoreAll());

  const [{ default: express }, { default: partsRouter }] = await Promise.all([
    import("express"),
    import(`../routes/parts.ts?parts-details-contract=${Date.now()}`),
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
  const url = `http://127.0.0.1:${address.port}/api/parts/catalog/${partId}/details`;

  const teamAResponse = await fetch(url, {
    headers: { "x-team-id": "team-a" },
  });
  assert.equal(teamAResponse.status, 200);
  const teamAResult = GetPartsCatalogDetailsResponse.parse(
    await teamAResponse.json(),
  );
  assert.equal(teamAResult.item.name, "Saved bracket");
  assert.equal(teamAResult.item.storageLocation, "Team A shelf");
  assert.equal(teamAResult.item.inventoryNotes, "Keep with the spares");
  assert.equal(teamAResult.item.unitCost, 12.5);
  assert.equal(teamAResult.priceSnapshots[0].unitPrice, 14.75);
  assert.equal(
    teamAResult.priceSnapshots[0].sourceUrl,
    "https://www.andymark.com/products/saved-bracket",
  );
  assert.deepEqual(teamAResult.locations, ["Team A shelf"]);

  const teamBResponse = await fetch(url, {
    headers: { "x-team-id": "team-b" },
  });
  assert.equal(teamBResponse.status, 404);
  const teamBBody = await teamBResponse.json();
  assert.equal(teamBBody.error, "Catalog item not found.");
  assert.equal(JSON.stringify(teamBBody).includes("Saved bracket"), false);
  assert.equal(
    queries.filter(({ statement }) =>
      statement.includes('from "parts_catalog_items" c'),
    ).length,
    2,
  );
});
