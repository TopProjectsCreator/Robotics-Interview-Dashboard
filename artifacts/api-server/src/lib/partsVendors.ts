export type PartsVendorCoverageState =
  | "feed_sync_required"
  | "discovery_only";

export type VendorGroup = "General Parts" | "Specific Parts";

export type VendorConfig = {
  key: string;
  name: string;
  group: VendorGroup;
  website: string;
  domain: string;
  catalogMode: "products";
  catalogSourceUrl: string;
  coverageState: PartsVendorCoverageState;
  publicProductFeedUrl?: string;
  /**
   * Endpoint of the supplier's UCP (Universal Commerce Protocol) catalog MCP
   * service, when the supplier publishes one (see its agents.md). The sync
   * imports the full supplier catalog from products.json, then overlays the
   * UCP API's live price/currency/availability for the products it lists.
   */
  ucpCatalogEndpoint?: string;
  /**
   * ISO 4217 currency of the prices in a Shopify `products.json` feed. The
   * endpoint does not advertise one, so a feed vendor that carries prices for
   * the catalog must declare it here; without it, feed prices are not stored.
   */
  feedPriceCurrency?: string;
  /**
   * Suppliers that publish no machine-readable product feed but do publish a
   * product sitemap are crawled incrementally instead of seeded by hand (see
   * productSitemapCrawl.ts). The sitemap supplies change detection — one
   * request per run — and each product page supplies the catalog fields.
   */
  productSitemapUrl?: string;
};

export const VENDORS: VendorConfig[] = [
  { key: "andymark", name: "Andymark", group: "General Parts", website: "https://www.andymark.com/", domain: "andymark.com", catalogMode: "products", catalogSourceUrl: "https://andymark.com/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://andymark.com/products.json", feedPriceCurrency: "USD" },
  { key: "gobilda", name: "goBILDA", group: "General Parts", website: "https://www.gobilda.com/", domain: "gobilda.com", catalogMode: "products", catalogSourceUrl: "https://www.gobilda.com/xmlsitemap.php?type=products&page=1", coverageState: "discovery_only", productSitemapUrl: "https://www.gobilda.com/xmlsitemap.php?type=products&page=1" },
  { key: "rev-robotics", name: "REV Robotics", group: "General Parts", website: "https://www.revrobotics.com/", domain: "revrobotics.com", catalogMode: "products", catalogSourceUrl: "https://www.revrobotics.com/xmlsitemap.php?type=products&page=1", coverageState: "discovery_only", productSitemapUrl: "https://www.revrobotics.com/xmlsitemap.php?type=products&page=1" },
  { key: "servocity", name: "ServoCity", group: "General Parts", website: "https://www.servocity.com/", domain: "servocity.com", catalogMode: "products", catalogSourceUrl: "https://www.servocity.com/xmlsitemap.php?type=products&page=1", coverageState: "discovery_only", productSitemapUrl: "https://www.servocity.com/xmlsitemap.php?type=products&page=1" },
  { key: "studica", name: "Studica", group: "General Parts", website: "https://www.studica.com/", domain: "studica.com", catalogMode: "products", catalogSourceUrl: "https://www.studica.com/", coverageState: "discovery_only" },
  { key: "swyft", name: "Swyft", group: "Specific Parts", website: "https://swyftrobotics.com/", domain: "swyftrobotics.com", catalogMode: "products", catalogSourceUrl: "https://shop.swyftrobotics.com/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://shop.swyftrobotics.com/products.json", feedPriceCurrency: "USD" },
  // products.json stays online but half of it is discontinued/reference pages the store
  // 404s; the real-time sitemap index gate decides which handles are actually listed.
  { key: "westcoastproducts", name: "WestCoast Products", group: "General Parts", website: "https://wcproducts.com/", domain: "wcproducts.com", catalogMode: "products", catalogSourceUrl: "https://wcproducts.com/.well-known/ucp", coverageState: "feed_sync_required", publicProductFeedUrl: "https://wcproducts.com/products.json", ucpCatalogEndpoint: "https://wcproducts.com/api/ucp/mcp", feedPriceCurrency: "USD" },
  { key: "limelightvision", name: "Limelight Vision", group: "Specific Parts", website: "https://limelightvision.io/", domain: "limelightvision.io", catalogMode: "products", catalogSourceUrl: "https://limelightvision.io/.well-known/ucp", coverageState: "feed_sync_required", publicProductFeedUrl: "https://limelightvision.io/products.json", ucpCatalogEndpoint: "https://limelightvision.io/api/ucp/mcp", feedPriceCurrency: "USD" },
  // Wix store; no products.json. The product sitemap enumerates the catalog and
  // each product page ships schema.org Product JSON-LD, so it is crawled like REV.
  { key: "platypus-robotics", name: "Platypus Robotics", group: "General Parts", website: "https://www.platypus-robotics.org/", domain: "platypus-robotics.org", catalogMode: "products", catalogSourceUrl: "https://www.platypus-robotics.org/store-products-sitemap.xml", coverageState: "discovery_only", productSitemapUrl: "https://www.platypus-robotics.org/store-products-sitemap.xml" },
  { key: "ferra", name: "Ferra", group: "Specific Parts", website: "https://ferracomponents.com/", domain: "ferracomponents.com", catalogMode: "products", catalogSourceUrl: "https://ferracomponents.com/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://ferracomponents.com/products.json", feedPriceCurrency: "USD" },
  { key: "axon-robotics", name: "Axon Robotics", group: "Specific Parts", website: "https://axon-robotics.com/", domain: "axon-robotics.com", catalogMode: "products", catalogSourceUrl: "https://axon-robotics.com/", coverageState: "discovery_only" },
  { key: "bwtlink", name: "BWTLink", group: "Specific Parts", website: "https://bwtlink.com/", domain: "bwtlink.com", catalogMode: "products", catalogSourceUrl: "https://bwtlink.com/", coverageState: "discovery_only" },
  { key: "melonbotics", name: "Melonbotics", group: "Specific Parts", website: "https://melonbotics.com/", domain: "melonbotics.com", catalogMode: "products", catalogSourceUrl: "https://www.melonbotics.com/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://www.melonbotics.com/products.json", feedPriceCurrency: "USD" },
  { key: "optii", name: "Optii", group: "Specific Parts", website: "https://optii.com.au/", domain: "optii.com.au", catalogMode: "products", catalogSourceUrl: "https://optii.com.au/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://optii.com.au/products.json", feedPriceCurrency: "AUD" },
  { key: "offset-robotics", name: "Offset Robotics", group: "Specific Parts", website: "https://offsetrobotics.com/", domain: "offsetrobotics.com", catalogMode: "products", catalogSourceUrl: "https://offsetrobotics.com/", coverageState: "discovery_only" },
];

export const vendorByKey = new Map(VENDORS.map((vendor) => [vendor.key, vendor]));

export const publicVendors = VENDORS.map(({ domain: _domain, ...vendor }) => ({
  ...vendor,
  publicProductFeedUrl: vendor.publicProductFeedUrl ?? null,
}));

export function defaultProductFeedUrl(vendor: VendorConfig): string {
  return vendor.publicProductFeedUrl ??
    new URL("/products.json", vendor.website).toString();
}

export function vendorOwnsHost(hostname: string, vendor: VendorConfig): boolean {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return normalized === vendor.domain || normalized.endsWith(`.${vendor.domain}`);
}