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

test("sitemap-crawled suppliers publish their sitemap on their own host", () => {
  const crawled = VENDORS.filter((vendor) => vendor.productSitemapUrl);
  assert.deepEqual(
    crawled.map((vendor) => vendor.key).sort(),
    ["gobilda", "rev-robotics", "servocity"],
  );

  for (const vendor of crawled) {
    const url = new URL(vendor.productSitemapUrl);
    assert.equal(url.protocol, "https:", vendor.key);
    assert.equal(vendorOwnsHost(url.hostname, vendor), true, vendor.key);
    // The crawler validates every sitemap URL and every product URL against
    // `domain`, so a domain that does not cover the sitemap host would silently
    // reject the whole catalog and report an empty one instead of failing.
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const domain = vendor.domain.toLowerCase();
    assert.ok(
      host === domain || host.endsWith(`.${domain}`),
      `${vendor.key}: sitemap host ${url.hostname} is outside domain ${vendor.domain}`,
    );
  }
});

test("sitemap-crawled suppliers declare no competing feed", () => {
  for (const vendor of VENDORS.filter((entry) => entry.productSitemapUrl)) {
    // collectPublicVendorCatalog returns at the sitemap branch before the feed
    // branch runs, so a feed declared alongside a sitemap would never be read —
    // configuration that misreports what actually syncs.
    assert.equal(vendor.publicProductFeedUrl, undefined, vendor.key);
    // The source shown in the sync UI should be the thing the crawler reads.
    assert.equal(vendor.catalogSourceUrl, vendor.productSitemapUrl, vendor.key);
  }
});