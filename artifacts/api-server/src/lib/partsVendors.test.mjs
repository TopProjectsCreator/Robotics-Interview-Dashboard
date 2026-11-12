import test from "node:test";
import assert from "node:assert/strict";
import {
  VENDORS,
  defaultProductFeedUrl,
  publicVendors,
  vendorOwnsHost,
} from "./partsVendors.ts";

test("all 15 supplier entries include an official source and an honest coverage state", () => {
  assert.equal(VENDORS.length, 15);
  assert.equal(new Set(VENDORS.map((vendor) => vendor.key)).size, 15);
  assert.equal(publicVendors.length, 15);

  for (const vendor of VENDORS) {
    assert.ok(vendor.catalogSourceUrl.startsWith("https://"), vendor.key);
    assert.ok(["feed_sync_required", "discovery_only"].includes(vendor.coverageState), vendor.key);
    assert.equal(vendorOwnsHost(new URL(vendor.catalogSourceUrl).hostname, vendor), true, vendor.key);
  }
});

test("feed suppliers publish their supplier-owned product feed and an honest coverage state", () => {
  const feedVendors = VENDORS.filter((vendor) => vendor.publicProductFeedUrl);
  assert.deepEqual(
    feedVendors.map((vendor) => vendor.key).sort(),
    ["andymark", "ferra", "limelightvision", "melonbotics", "optii", "swyft", "westcoastproducts"],
  );
  assert.ok(feedVendors.every((vendor) => vendor.coverageState === "feed_sync_required"));
  // The products.json feed never states a currency; without a declared one the
  // catalog could not store a price the UI would display.
  assert.ok(
    feedVendors.every((vendor) => vendor.feedPriceCurrency && /^[A-Z]{3}$/.test(vendor.feedPriceCurrency)),
    "every feed vendor must declare its feed price currency",
  );
});

test("suppliers publishing a UCP catalog API call it out on their own host", () => {
  const ucpVendors = VENDORS.filter((vendor) => vendor.ucpCatalogEndpoint);
  assert.deepEqual(
    ucpVendors.map((vendor) => vendor.key).sort(),
    ["limelightvision", "westcoastproducts"],
  );
  for (const vendor of ucpVendors) {
    const url = new URL(vendor.ucpCatalogEndpoint);
    assert.equal(url.protocol, "https:", vendor.key);
    assert.equal(vendorOwnsHost(url.hostname, vendor), true, vendor.key);
  }
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
    ["gobilda", "platypus-robotics", "rev-robotics", "servocity"],
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