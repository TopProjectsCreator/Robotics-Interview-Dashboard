export type PartsVendorCoverageState =
  | "feed_sync_required"
  | "discovery_only"
  | "access_restricted"
  | "custom_fabrication";

export type VendorGroup = "General Parts" | "Specific Parts" | "Machining Companies";

export type VendorConfig = {
  key: string;
  name: string;
  group: VendorGroup;
  website: string;
  domain: string;
  catalogMode: "products" | "custom_fabrication";
  catalogSourceUrl: string;
  coverageState: PartsVendorCoverageState;
  publicProductFeedUrl?: string;
};

export const VENDORS: VendorConfig[] = [
  { key: "andymark", name: "Andymark", group: "General Parts", website: "https://www.andymark.com/", domain: "andymark.com", catalogMode: "products", catalogSourceUrl: "https://andymark.com/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://andymark.com/products.json" },
  { key: "gobilda", name: "goBILDA", group: "General Parts", website: "https://www.gobilda.com/", domain: "gobilda.com", catalogMode: "products", catalogSourceUrl: "https://www.gobilda.com/", coverageState: "discovery_only" },
  { key: "grainger", name: "Grainger", group: "General Parts", website: "https://www.grainger.com/", domain: "grainger.com", catalogMode: "products", catalogSourceUrl: "https://www.grainger.com/", coverageState: "discovery_only" },
  { key: "rev-robotics", name: "REV Robotics", group: "General Parts", website: "https://www.revrobotics.com/", domain: "revrobotics.com", catalogMode: "products", catalogSourceUrl: "https://www.revrobotics.com/", coverageState: "discovery_only" },
  { key: "servocity", name: "ServoCity", group: "General Parts", website: "https://www.servocity.com/", domain: "servocity.com", catalogMode: "products", catalogSourceUrl: "https://www.servocity.com/", coverageState: "discovery_only" },
  { key: "studica", name: "Studica", group: "General Parts", website: "https://www.studica.com/", domain: "studica.com", catalogMode: "products", catalogSourceUrl: "https://www.studica.com/", coverageState: "discovery_only" },
  { key: "swyft", name: "Swyft", group: "Specific Parts", website: "https://swyftrobotics.com/", domain: "swyftrobotics.com", catalogMode: "products", catalogSourceUrl: "https://shop.swyftrobotics.com/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://shop.swyftrobotics.com/products.json" },
  { key: "ferra", name: "Ferra", group: "Specific Parts", website: "https://ferracomponents.com/", domain: "ferracomponents.com", catalogMode: "products", catalogSourceUrl: "https://ferracomponents.com/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://ferracomponents.com/products.json" },
  { key: "axon-robotics", name: "Axon Robotics", group: "Specific Parts", website: "https://axon-robotics.com/", domain: "axon-robotics.com", catalogMode: "products", catalogSourceUrl: "https://axon-robotics.com/", coverageState: "discovery_only" },
  { key: "bwtlink", name: "BWTLink", group: "Specific Parts", website: "https://bwtlink.com/", domain: "bwtlink.com", catalogMode: "products", catalogSourceUrl: "https://bwtlink.com/", coverageState: "discovery_only" },
  { key: "melonbotics", name: "Melonbotics", group: "Specific Parts", website: "https://melonbotics.com/", domain: "melonbotics.com", catalogMode: "products", catalogSourceUrl: "https://www.melonbotics.com/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://www.melonbotics.com/products.json" },
  { key: "misumi", name: "Misumi", group: "Specific Parts", website: "https://us.misumi-ec.com/", domain: "misumi-ec.com", catalogMode: "products", catalogSourceUrl: "https://us.misumi-ec.com/", coverageState: "discovery_only" },
  { key: "optii", name: "Optii", group: "Specific Parts", website: "https://optii.com.au/", domain: "optii.com.au", catalogMode: "products", catalogSourceUrl: "https://optii.com.au/products.json", coverageState: "feed_sync_required", publicProductFeedUrl: "https://optii.com.au/products.json" },
  { key: "offset-robotics", name: "Offset Robotics", group: "Specific Parts", website: "https://offsetrobotics.com/", domain: "offsetrobotics.com", catalogMode: "products", catalogSourceUrl: "https://offsetrobotics.com/", coverageState: "discovery_only" },
  { key: "mcmaster-carr", name: "McMaster-Carr", group: "Specific Parts", website: "https://www.mcmaster.com/", domain: "mcmaster.com", catalogMode: "products", catalogSourceUrl: "https://www.mcmaster.com/help/api/", coverageState: "access_restricted" },
  { key: "cncmadness", name: "CNCMadness", group: "Machining Companies", website: "https://cncmadness.com/", domain: "cncmadness.com", catalogMode: "custom_fabrication", catalogSourceUrl: "https://cncmadness.com/", coverageState: "custom_fabrication" },
  { key: "fabworks", name: "Fabworks", group: "Machining Companies", website: "https://fabworks.com/", domain: "fabworks.com", catalogMode: "custom_fabrication", catalogSourceUrl: "https://www.fabworks.com/", coverageState: "custom_fabrication" },
  { key: "oshcut", name: "Oshcut", group: "Machining Companies", website: "https://www.oshcut.com/", domain: "oshcut.com", catalogMode: "custom_fabrication", catalogSourceUrl: "https://www.oshcut.com/", coverageState: "custom_fabrication" },
  { key: "sendcutsend", name: "SendCutSend", group: "Machining Companies", website: "https://sendcutsend.com/", domain: "sendcutsend.com", catalogMode: "custom_fabrication", catalogSourceUrl: "https://cdn.sendcutsend.com/specs/sendcutsend-ordering-guide.md", coverageState: "custom_fabrication" },
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