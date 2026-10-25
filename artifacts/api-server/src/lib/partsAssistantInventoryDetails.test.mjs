import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
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

const records = [
  {
    id: "team-a-part",
    teamId: "team-a",
    vendorKey: "andymark",
    name: "Precision bracket",
    sku: "PREC-42",
    category: "Structure",
    description: "Supplier product copy.",
    productUrl: "https://www.andymark.com/products/precision-bracket",
    imageUrl: "https://images.example.test/bracket.png",
    unitCost: "12.50",
    costCurrency: "USD",
    storageLocation: "Shelf A",
    inventoryNotes: "Keep with spare fasteners.",
    quantityOwned: 4,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "team-b-part",
    teamId: "team-b",
    vendorKey: "andymark",
    name: "Private team B part",
    sku: "TEAM-B-1",
    category: null,
    description: "Private to team B.",
    productUrl: null,
    imageUrl: null,
    unitCost: null,
    costCurrency: null,
    storageLocation: "Team B rack",
    inventoryNotes: null,
    quantityOwned: 2,
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  },
];
const quote = {
  id: "quote-1",
  partId: "team-a-part",
  vendorKey: "andymark",
  unitPrice: "14.75",
  currency: "USD",
  sourceUrl: "https://www.andymark.com/products/precision-bracket",
  capturedAt: new Date("2026-01-15T00:00:00.000Z"),
  isStartingAt: false,
};
const statements = [];

function teamFrom(values) {
  return values.find((value) => value === "team-a" || value === "team-b");
}

const pool = {
  async query(statement, values = []) {
    statements.push({ statement, values });
    if (statement.includes('from "parts_catalog_items" c')) {
      const teamId = teamFrom(values);
      const partId = statement.includes('c."id" = $1') ? values[0] : undefined;
      const matches = records.filter((record) =>
        (!partId || record.id === partId) && (!teamId || record.teamId === teamId),
      );
      if (statement.includes("limit $")) return { rows: matches.slice(0, 1) };
      return { rows: matches };
    }
    if (statement.includes('from "parts_supplier_price_snapshots" s')) {
      const record = records.find((candidate) => candidate.id === values[0]);
      return {
        rows: record?.teamId === teamFrom(values) && record.id === quote.partId
          ? [quote]
          : [],
      };
    }
    if (statement.includes('from "parts_inventory" i')) {
      const teamId = teamFrom(values);
      return {
        rows: records
          .filter((record) => record.teamId === teamId && record.storageLocation)
          .map((record) => ({ storageLocation: record.storageLocation })),
      };
    }
    throw new Error(`Unexpected Parts query: ${statement}`);
  },
  async connect() {
    return {
      async query(statement, values = []) {
        statements.push({ statement, values });
        if (statement === "BEGIN" || statement === "COMMIT" || statement === "ROLLBACK") {
          return { rows: [], rowCount: 0 };
        }
        if (statement.includes('update "parts_catalog_items"')) {
          const [partId, hasImage, imageUrl, teamId] = values;
          const record = records.find((candidate) =>
            candidate.id === partId && candidate.teamId === teamId,
          );
          if (!record) return { rows: [], rowCount: 0 };
          if (hasImage) record.imageUrl = imageUrl;
          return { rows: [{ id: partId }], rowCount: 1 };
        }
        if (statement.includes('insert into "parts_inventory"')) {
          const [partId, teamId, storageLocation, inventoryNotes, unitCost, costCurrency, hasLocation, hasNotes, hasCost] = values;
          const record = records.find((candidate) =>
            candidate.id === partId && candidate.teamId === teamId,
          );
          if (!record) return { rows: [], rowCount: 0 };
          if (hasLocation) record.storageLocation = storageLocation;
          if (hasNotes) record.inventoryNotes = inventoryNotes;
          if (hasCost) {
            record.unitCost = unitCost;
            record.costCurrency = costCurrency;
          }
          return { rows: [], rowCount: 1 };
        }
        throw new Error(`Unexpected transactional query: ${statement}`);
      },
      release() {},
    };
  },
};

test("Parts assistant reads and updates full inventory details inside the signed-in team", async (t) => {
  statements.length = 0;
  mock.module("@workspace/db", {
    namedExports: {
      pool,
      db: {},
      primaryDb: {},
      primaryPool: pool,
      interviewerAccountsTable: {},
      revokedSessionsTable: {},
      teamsTable,
      DEFAULT_TEAM_ID,
      normalizeTeamName,
      runWithInstance: (_instance, fn) => fn(),
      currentInstance: () => "primary",
      enterInstance: () => {},
      secondaryDb: () => null,
      secondaryPool: () => null,
      hasSecondary: () => false,
    },
  });
  t.after(() => mock.restoreAll());

  const { runAssistantPartsTool } = await import("../routes/parts.ts");
  const listed = await runAssistantPartsTool("list_parts_catalog", {}, "team-a");
  const listItems = JSON.parse(listed.content).items;
  assert.deepEqual(listItems.map(({ id }) => id), ["team-a-part"]);
  assert.equal(listItems[0].storageLocation, "Shelf A");
  assert.equal(listItems[0].inventoryNotes, "Keep with spare fasteners.");
  assert.ok(statements.some(({ statement, values }) =>
    statement.includes('c."team_id"') && values.includes("team-a"),
  ));

  const read = await runAssistantPartsTool(
    "get_parts_inventory_details",
    { partId: "team-a-part" },
    "team-a",
  );
  const details = JSON.parse(read.content);
  assert.equal(details.item.imageUrl, "https://images.example.test/bracket.png");
  assert.equal(details.item.unitCost, 12.5);
  assert.equal(details.item.costCurrency, "USD");
  assert.equal(details.item.storageLocation, "Shelf A");
  assert.equal(details.item.inventoryNotes, "Keep with spare fasteners.");
  assert.equal(details.item.description, "Supplier product copy.");
  assert.equal(details.priceSnapshots[0].unitPrice, 14.75);
  assert.deepEqual(details.locations, ["Shelf A"]);

  const updated = await runAssistantPartsTool(
    "update_parts_inventory_details",
    {
      partId: "team-a-part",
      imageUrl: "https://images.example.test/bracket-v2.png",
      unitCost: 13.25,
      costCurrency: "CAD",
      storageLocation: "Parts cabinet",
      inventoryNotes: "Use the short M4 bolts.",
    },
    "team-a",
  );
  const saved = JSON.parse(updated.content);
  assert.equal(saved.updated, true);
  assert.deepEqual(saved.changedFields.sort(), [
    "costCurrency",
    "imageUrl",
    "inventoryNotes",
    "storageLocation",
    "unitCost",
  ]);
  assert.equal(saved.item.imageUrl, "https://images.example.test/bracket-v2.png");
  assert.equal(saved.item.unitCost, 13.25);
  assert.equal(saved.item.costCurrency, "CAD");
  assert.equal(saved.item.storageLocation, "Parts cabinet");
  assert.equal(saved.item.inventoryNotes, "Use the short M4 bolts.");
  assert.match(updated.activity.detail, /persisted state returned/);

  const callsBeforeInvalid = statements.length;
  const invalid = await runAssistantPartsTool(
    "update_parts_inventory_details",
    { partId: "team-a-part", unitCost: 77 },
    "team-a",
  );
  assert.match(invalid.content, /saved cost and currency together/);
  assert.equal(
    statements.slice(callsBeforeInvalid).some(({ statement }) =>
      statement.includes('update "parts_catalog_items"'),
    ),
    false,
  );

  const crossTeamRead = await runAssistantPartsTool(
    "get_parts_inventory_details",
    { partId: "team-b-part" },
    "team-a",
  );
  assert.match(crossTeamRead.content, /not found in this team's inventory/);
  const crossTeamUpdate = await runAssistantPartsTool(
    "update_parts_inventory_details",
    { partId: "team-b-part", storageLocation: "Changed by team A" },
    "team-a",
  );
  assert.match(crossTeamUpdate.content, /not found in this team's inventory/);
  assert.equal(records[1].storageLocation, "Team B rack");
});
