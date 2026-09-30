import test from "node:test";
import assert from "node:assert/strict";
import {
  VENDORS,
  defaultProductFeedUrl,
  publicVendors,
  vendorOwnsHost,
} from "./partsVendors.ts";

test("all 19 supplier entries include an official source and an honest coverage state", () => {
  assert.equal(VENDORS.length, 19);
  assert.equal(new Set(VENDORS.map((vendor) => vendor.key)).size, 19);
  assert.equal(publicVendors.length, 19);

  for (const vendor of VENDORS) {
    assert.ok(vendor.catalogSourceUrl.startsWith("https://"), vendor.key);
    assert.ok(["feed_sync_required", "discovery_only", "access_restricted", "custom_fabrication"].includes(vendor.coverageState), vendor.key);
    assert.equal(vendorOwnsHost(new URL(vendor.catalogSourceUrl).hostname, vendor), true, vendor.key);
  }
});

test("only the five configured supplier-owned feeds are marked for sync verification", () => {
  const feedVendors = VENDORS.filter((vendor) => vendor.publicProductFeedUrl);
  assert.deepEqual(
    feedVendors.map((vendor) => vendor.key).sort(),
    ["andymark", "ferra", "melonbotics", "optii", "swyft"],
  );
  assert.ok(feedVendors.every((vendor) => vendor.coverageState === "feed_sync_required"));
});

test("default feed probes remain on the supplier-owned hostname", () => {
  for (const vendor of VENDORS) {
    assert.equal(vendorOwnsHost(new URL(defaultProductFeedUrl(vendor)).hostname, vendor), true, vendor.key);
  }
  assert.equal(vendorOwnsHost("unrelated.example", VENDORS[0]), false);
});