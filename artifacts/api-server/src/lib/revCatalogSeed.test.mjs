import assert from "node:assert/strict";
import test from "node:test";
import {
  REV_CATALOG_SEED,
  REV_CATALOG_SEED_COUNT,
} from "./revCatalogSeed.ts";

test("REV seed covers the hand-collected Shop All catalog", () => {
  assert.equal(REV_CATALOG_SEED.length, REV_CATALOG_SEED_COUNT);
  assert.ok(REV_CATALOG_SEED.length >= 300, "expected the full catalog, not a sample");
});

test("REV seed rows are shaped for the catalog upsert", () => {
  const externalKeys = new Set();
  for (const record of REV_CATALOG_SEED) {
    assert.equal(record.vendorKey, "rev-robotics");
    assert.ok(record.name.length >= 2);
    assert.ok(record.externalKey.length > 0 && record.externalKey.length <= 500);
    assert.ok(!externalKeys.has(record.externalKey), `duplicate externalKey ${record.externalKey}`);
    externalKeys.add(record.externalKey);
    assert.ok(record.description === null || record.description.length <= 1200);
  }
});

test("REV seed rows carry verified listing URLs and images", () => {
  for (const record of REV_CATALOG_SEED) {
    const productUrl = new URL(record.productUrl);
    assert.equal(productUrl.protocol, "https:");
    assert.equal(productUrl.hostname, "www.revrobotics.com");
    assert.ok(record.imageUrl === null || record.imageUrl.startsWith("https://"));
  }
});

test("REV seed covers the parts users actually search for", () => {
  const names = new Set(REV_CATALOG_SEED.map((record) => record.name));
  for (const expected of [
    "NEO Vortex Brushless Motor",
    "NEO 550 Brushless Motor",
    "SPARK MAX Motor Controller",
    "3in MAXSwerve Module",
    "Power Distribution Hub",
    "Control Hub",
  ]) {
    assert.ok(names.has(expected), `missing ${expected}`);
  }
  const skus = new Set(REV_CATALOG_SEED.map((record) => record.sku).filter(Boolean));
  assert.ok(skus.has("REV-21-1652"));
  assert.ok(skus.has("REV-11-2158"));
});
