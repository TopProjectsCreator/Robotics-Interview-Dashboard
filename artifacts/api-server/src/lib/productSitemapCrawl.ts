/**
 * Sitemap-driven product crawling for suppliers that publish no machine-readable
 * product feed.
 *
 * goBILDA exposes no Shopify-style `products.json` and returns 404 for a root
 * `sitemap.xml`, but it does publish a BigCommerce product sitemap at
 * `/xmlsitemap.php?type=products&page=1` (2,387 URLs, page 2 and beyond empty)
 * and full schema.org `Product` JSON-LD on every product page. Together those
 * give the catalog two cheap primitives instead of a full re-crawl:
 *
 *   1. one sitemap fetch to learn the complete URL inventory, and
 *   2. a diff against `parts_catalog_items.product_url` to isolate new parts.
 *
 * The steady-state cost is therefore a single request per run no matter how
 * large the catalog grows. That matters because a full 2,387-page walk at the
 * provider's declared delay takes hours; after the first pass it should never
 * be repeated.
 *
 * The provider's robots.txt names AI agents and sets `Crawl-delay: 10` for them.
 * Product pages are not disallowed for any agent, but the delay is honoured here
 * for every product fetch so the collector stays a polite client. The sitemap
 * endpoint is not disallowed either; it exists precisely to be read.
 */

/** robots.txt declares `Crawl-delay: 10` for named AI agents on this host. */
export const PRODUCT_CRAWL_DELAY_MS = 10_000;

/** Keeps a single slice well inside a background tick. */
export const PRODUCT_CRAWL_DEFAULT_BUDGET = 25;

/**
 * Estimates time from the currently eligible page backlog, the per-page crawl
 * delay, and the scheduled wait before each future slice. Supplier response
 * time and other concurrent work can increase the actual duration.
 */
export function estimateSitemapCrawlSecondsRemaining(
  remainingPages: number,
  pageDelayMs: number,
  pageBudget: number,
  sliceDelayMs: number,
): number | null {
  if (
    !Number.isSafeInteger(remainingPages) ||
    remainingPages <= 0 ||
    !Number.isFinite(pageDelayMs) ||
    pageDelayMs < 0 ||
    !Number.isSafeInteger(pageBudget) ||
    pageBudget <= 0 ||
    !Number.isFinite(sliceDelayMs) ||
    sliceDelayMs < 0
  ) {
    return null;
  }

  const futureSlices = Math.ceil(remainingPages / pageBudget);
  return Math.ceil(
    (remainingPages * pageDelayMs + futureSlices * sliceDelayMs) / 1000,
  );
}

/** Prevent stale or non-crawling sync states from exposing an ETA. */
export function sitemapCrawlProgress(
  status: string,
  remainingPages: unknown,
  estimatedSecondsRemaining: unknown,
): { remainingPages: number; estimatedSecondsRemaining: number } | null {
  if (
    status !== "incomplete" ||
    typeof remainingPages !== "number" ||
    !Number.isSafeInteger(remainingPages) ||
    remainingPages <= 0 ||
    typeof estimatedSecondsRemaining !== "number" ||
    !Number.isSafeInteger(estimatedSecondsRemaining) ||
    estimatedSecondsRemaining <= 0
  ) return null;
  return { remainingPages, estimatedSecondsRemaining };
}

export type SitemapCrawlTarget = {
  /** Supplier domain, used to reject off-host URLs from a sitemap. */
  domain: string;
  /** Absolute https URL of the supplier's product sitemap. */
  sitemapUrl: string;
};

export type CrawledProduct = {
  name: string;
  sku: string | null;
  description: string | null;
  productUrl: string;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
  inStock: boolean;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\\u002f/gi, "/");
}

/**
 * Reads `<loc>` entries out of a sitemap document and keeps only https URLs on
 * the supplier's own host. A sitemap is an untrusted remote document, so an
 * entry pointing anywhere else is dropped rather than fetched.
 */
export function parseSitemapProductUrls(
  xml: string,
  target: Pick<SitemapCrawlTarget, "domain">,
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const domain = target.domain.toLowerCase().replace(/^www\./, "");
  for (const match of xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)) {
    const raw = decodeEntities(match[1] ?? "").trim();
    if (!raw) continue;
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    if (parsed.protocol !== "https:") continue;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== domain && !host.endsWith(`.${domain}`)) continue;
    const normalized = parsed.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    urls.push(normalized);
  }
  return urls;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function trimmedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = decodeEntities(value).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
}

/** schema.org availability values that mean the part can be ordered today. */
function availabilityIsInStock(value: unknown): boolean {
  const text = trimmedString(value, 200);
  if (!text) return true;
  const tail = text.split("/").pop() ?? text;
  return !/outofstock|discontinued|soldout|preorder|backorder/i.test(tail);
}

/**
 * Extracts the schema.org `Product` JSON-LD block shipped on supplier product
 * pages. goBILDA emits a complete Product/Offer object, so price, currency,
 * SKU, stock, image, and description all arrive in one parse instead of being
 * scraped out of presentation markup that changes with the theme.
 */
export function parseSchemaOrgProduct(html: string): CrawledProduct | null {
  for (const match of html.matchAll(
    /<script\b[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    const body = match[1];
    if (!body) continue;
    let payload: unknown;
    try {
      payload = JSON.parse(decodeEntities(body).trim());
    } catch {
      continue;
    }
    const candidates: unknown[] = Array.isArray(payload) ? payload : [payload];
    for (const candidate of candidates) {
      if (!isRecord(candidate)) continue;
      const type = candidate["@type"];
      const isProduct = Array.isArray(type)
        ? type.some((entry) => String(entry).toLowerCase() === "product")
        : String(type ?? "").toLowerCase() === "product";
      if (!isProduct) continue;

      const name = trimmedString(candidate.name, 250);
      const productUrl = trimmedString(candidate.url, 2000);
      if (!name || !productUrl) continue;

      const offers = Array.isArray(candidate.offers) ? candidate.offers[0] : candidate.offers;
      const offer = isRecord(offers) ? offers : {};
      const price = trimmedString(offer.price, 40);
      const currency = trimmedString(offer.priceCurrency, 8);
      const image = trimmedString(candidate.image, 2000);

      return {
        name,
        sku: trimmedString(candidate.sku, 200),
        description: trimmedString(candidate.description, 1200),
        productUrl,
        imageUrl: image && image.startsWith("https://") ? image : null,
        price,
        currency: price && currency && /^[A-Z]{3}$/.test(currency) ? currency : null,
        inStock: availabilityIsInStock(offer.availability),
      };
    }
  }
  return null;
}

/**
 * Fallback when a page carries no JSON-LD: the slug is still a stable, unique
 * identifier, which is all the catalog diff needs to avoid re-fetching a part
 * it already holds. Price and stock stay unset rather than guessed.
 */
export function productUrlSlug(productUrl: string): string | null {
  try {
    const path = new URL(productUrl).pathname.replace(/\/+$/, "");
    const last = path.split("/").pop();
    return last ? decodeURIComponent(last).toLowerCase() : null;
  } catch {
    return null;
  }
}

export function crawlDelay(ms: number = PRODUCT_CRAWL_DELAY_MS): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

async function fetchText(url: string, accept: string, timeoutMs: number): Promise<string> {
  const response = await fetch(url, {
    headers: { accept },
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Request returned ${response.status}.`);
  return response.text();
}

export async function fetchSitemapProductUrls(
  target: SitemapCrawlTarget,
): Promise<string[]> {
  const xml = await fetchText(target.sitemapUrl, "application/xml,text/xml,*/*", 30_000);
  return parseSitemapProductUrls(xml, target);
}

/**
 * Fetches and parses one product page. Throws on transport failure so the
 * caller can record a partial slice rather than silently dropping the part.
 */
export async function fetchProductPage(
  productUrl: string,
  target: Pick<SitemapCrawlTarget, "domain">,
): Promise<CrawledProduct | null> {
  const parsed = new URL(productUrl);
  const domain = target.domain.toLowerCase().replace(/^www\./, "");
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (parsed.protocol !== "https:" || (host !== domain && !host.endsWith(`.${domain}`))) {
    throw new Error("Product URL is outside the supplier website.");
  }
  const html = await fetchText(productUrl, "text/html", 30_000);
  return parseSchemaOrgProduct(html);
}
