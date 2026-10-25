/**
 * One-time (and re-runnable) importer for hand-collected vendor catalog seeds.
 *
 * Usage (from the repo root, with .env sourced):
 *   cd artifacts/api-server
 *   set -a; . ../../.env; set +a
 *   pnpm run import:rev-catalog   # imports every seed in vendorCatalogSeeds.ts
 *
 * Each seed is upserted into parts_catalog_items as global (team_id NULL)
 * feed rows — the same shape saveCatalogFeedRecords() writes — inventory rows
 * are ensured, and each vendor's hand-collected coverage is recorded in
 * parts_supplier_sync_states so the Parts workspace dashboard reflects it.
 * Re-running is safe: upserts are idempotent and only refresh updated_at.
 */
import { randomUUID } from "node:crypto";
import { createRequire, registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

// Resolve extensionless relative imports (e.g. "./revCatalogSeed" inside
// vendorCatalogSeeds.ts) the same way the lib test files do.
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
// NOTE: the seed import below must stay dynamic (await import) —
// registerHooks only affects resolutions issued after it runs, which covers
// dynamic imports but not the entry module's own static import graph.
const { VENDOR_CATALOG_SEEDS, vendorSeedSyncStatus, vendorSeedSyncMessage } =
  await import("../src/lib/vendorCatalogSeeds.ts");

// pg lives in the @workspace/db workspace (not an api-server dep), so
// resolve it from there instead of relying on hoisted node_modules.
const dbPkgPath = fileURLToPath(new URL("../../../lib/db/package.json", import.meta.url));
const requireDb = createRequire(dbPkgPath);
const pg = requireDb("pg").default ?? requireDb("pg");
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL must be set.");

const onlyVendor = process.argv[2] ?? null;
const entries = [...VENDOR_CATALOG_SEEDS.entries()].filter(([key]) => !onlyVendor || key === onlyVendor);
if (onlyVendor && entries.length === 0) throw new Error(`No seed registered for vendor "${onlyVendor}".`);

const summary = [];
for (const [vendorKey, seed] of entries) {
  const rows = seed.records;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let created = 0;
    let updated = 0;
    const batchSize = 500;
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      const values = [];
      const placeholders = batch.map((record, index) => {
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
         values ${placeholders.join(", ")}
          on conflict ("vendor_key", "external_key")
            where "team_id" is null and "is_manual" = false
          do update set
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
    }
    await client.query(
      `insert into "parts_supplier_sync_states"
         ("vendor_key", "status", "checked_at", "item_count", "source", "message")
       values ($1, $2, $3, $4, $5, $6)
       on conflict ("vendor_key") do update set
         "status" = excluded."status",
         "checked_at" = excluded."checked_at",
         "item_count" = excluded."item_count",
         "source" = excluded."source",
         "message" = excluded."message"`,
      [
        vendorKey,
        vendorSeedSyncStatus(seed),
        new Date(),
        rows.length,
        seed.source,
        vendorSeedSyncMessage(seed),
      ],
    );
    await client.query("COMMIT");
    summary.push({ vendor: vendorKey, seed: rows.length, created, updated });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
await pool.end();
console.log(JSON.stringify(summary));
