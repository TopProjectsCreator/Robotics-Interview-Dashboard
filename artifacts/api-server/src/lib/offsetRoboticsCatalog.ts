const OFFSET_DOMAIN = "offsetrobotics.com";
const OFFSET_HOME = "https://offsetrobotics.com/";
const OFFSET_MIN_COLLECTIONS = 12;

type JsonObject = Record<string, unknown>;

export type OffsetRoboticsCollection = {
  label: string;
  url: string;
};

export type OffsetRoboticsCatalogRecord = {
  externalKey: string;
  name: string;
  category: string;
  productUrl: string;
  imageUrl: string | null;
  supplierPrice: string | null;
  supplierPriceCurrency: string | null;
  stockStatus: string | null;
};

export type OffsetRoboticsCatalogResult = {
  records: OffsetRoboticsCatalogRecord[];
  collectionsFound: number;
  collectionsFetched: number;
  failedCollections: string[];
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeOffsetUrl(raw: unknown, base: string): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = new URL(raw, base);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== OFFSET_DOMAIN) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function appPageProps(html: string): JsonObject | null {
  const match = /<script\b[^>]*data-page=["']app["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!match?.[1]) return null;
  try {
    const parsed: unknown = JSON.parse(match[1]);
    return isObject(parsed) && isObject(parsed.props) ? parsed.props : null;
  } catch {
    return null;
  }
}

export function parseOffsetRoboticsCollections(html: string): OffsetRoboticsCollection[] {
  const props = appPageProps(html);
  const storeNav = props?.storeNav;
  const header = isObject(storeNav) ? storeNav.header : null;
  if (!Array.isArray(header)) return [];

  const collections = new Map<string, OffsetRoboticsCollection>();
  for (const item of header) {
    if (!isObject(item) || item.type !== "catalog" || !isObject(item.catalog)) continue;
    const list = item.catalog.collections;
    if (!Array.isArray(list)) continue;
    for (const value of list) {
      if (!isObject(value)) continue;
      const url = safeOffsetUrl(value.url, OFFSET_HOME);
      const label = typeof value.name === "string" ? value.name.trim() : "";
      if (!url || !label || !new URL(url).pathname.startsWith("/catalog/")) continue;
      collections.set(url, { label, url });
    }
  }
  return [...collections.values()];
}

function productPrice(product: JsonObject): { price: string | null; currency: string | null } {
  const minimum = typeof product.price_min === "number" ? product.price_min : null;
  const maximum = typeof product.price_max === "number" ? product.price_max : null;
  if (
    minimum === null ||
    maximum === null ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum < 0 ||
    maximum !== minimum
  ) {
    return { price: null, currency: null };
  }
  return { price: String(minimum), currency: "USD" };
}

export function parseOffsetRoboticsCollectionPage(
  html: string,
  pageUrl: string,
  category: string,
): OffsetRoboticsCatalogRecord[] | null {
  const props = appPageProps(html);
  if (!props || !Array.isArray(props.products)) return null;
  const defaultCurrency =
    typeof props.defaultCurrency === "string" && /^[A-Z]{3}$/.test(props.defaultCurrency)
      ? props.defaultCurrency
      : "USD";
  const records = new Map<string, OffsetRoboticsCatalogRecord>();

  for (const rawProduct of props.products) {
    if (!isObject(rawProduct)) continue;
    if (rawProduct.view_status !== undefined && rawProduct.view_status !== "public") continue;
    const name = typeof rawProduct.name === "string" ? rawProduct.name.trim() : "";
    const slug = typeof rawProduct.slug === "string" ? rawProduct.slug.trim() : "";
    const productUrl = safeOffsetUrl(rawProduct.url, pageUrl);
    if (!name || !slug || !productUrl || !new URL(productUrl).pathname.startsWith("/product/")) continue;

    const price = productPrice(rawProduct);
    const imageUrl = safeOffsetUrl(rawProduct.default_image, pageUrl);
    const rawStock = typeof rawProduct.stock_status === "string"
      ? rawProduct.stock_status.toLowerCase()
      : null;
    const stockStatus = rawStock && [
      "in_stock",
      "backorder",
      "preorder",
      "out_of_stock",
      "discontinued",
    ].includes(rawStock)
      ? rawStock
      : null;

    records.set(slug.toLowerCase(), {
      externalKey: slug.toLowerCase().slice(0, 500),
      name: name.slice(0, 250),
      category,
      productUrl,
      imageUrl,
      supplierPrice: price.price,
      supplierPriceCurrency: price.price ? defaultCurrency : null,
      stockStatus,
    });
  }
  return [...records.values()];
}

async function fetchOfficialHtml(
  url: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  let requested = new URL(url);
  for (let redirects = 0; redirects <= 4; redirects += 1) {
    if (
      requested.protocol !== "https:" ||
      requested.username ||
      requested.password ||
      requested.hostname.toLowerCase().replace(/^www\./, "") !== OFFSET_DOMAIN
    ) {
      throw new Error("Offset catalog request must stay on its official HTTPS domain.");
    }
    const response = await fetchImpl(requested, {
      headers: { accept: "text/html,application/xhtml+xml" },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Offset catalog returned a redirect without a destination.");
      requested = new URL(location, requested);
      continue;
    }
    if (!response.ok) throw new Error(`Offset catalog returned HTTP ${response.status}.`);
    const finalUrl = response.url ? new URL(response.url) : requested;
    if (
      finalUrl.protocol !== "https:" ||
      finalUrl.username ||
      finalUrl.password ||
      finalUrl.hostname.toLowerCase().replace(/^www\./, "") !== OFFSET_DOMAIN
    ) {
      throw new Error("Offset catalog redirected outside its official domain.");
    }
    return response.text();
  }
  throw new Error("Offset catalog exceeded its redirect limit.");
}

function pause(milliseconds: number): Promise<void> {
  return milliseconds <= 0
    ? Promise.resolve()
    : new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * Reads Offset Robotics' public navigation and all 12 site-listed collections.
 * Collection pages contain the current listing data, so no search provider or
 * product-detail crawl is needed for catalog enumeration.
 */
export async function collectOffsetRoboticsCatalog(options: {
  fetchImpl?: typeof fetch;
  requestDelayMs?: number;
} = {}): Promise<OffsetRoboticsCatalogResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const requestDelayMs = options.requestDelayMs ?? 500;
  const homeHtml = await fetchOfficialHtml(OFFSET_HOME, fetchImpl);
  const collections = parseOffsetRoboticsCollections(homeHtml);
  if (collections.length < OFFSET_MIN_COLLECTIONS) {
    throw new Error(`Offset catalog exposed ${collections.length} collections; at least ${OFFSET_MIN_COLLECTIONS} are required for a complete sync.`);
  }

  const records = new Map<string, OffsetRoboticsCatalogRecord>();
  const failedCollections: string[] = [];
  let collectionsFetched = 0;
  for (const collection of collections) {
    await pause(requestDelayMs);
    try {
      const html = await fetchOfficialHtml(collection.url, fetchImpl);
      const parsed = parseOffsetRoboticsCollectionPage(html, collection.url, collection.label);
      if (!parsed) {
        failedCollections.push(collection.url);
        continue;
      }
      collectionsFetched += 1;
      for (const record of parsed) records.set(record.externalKey, record);
    } catch {
      failedCollections.push(collection.url);
    }
  }

  return {
    records: [...records.values()],
    collectionsFound: collections.length,
    collectionsFetched,
    failedCollections,
  };
}
