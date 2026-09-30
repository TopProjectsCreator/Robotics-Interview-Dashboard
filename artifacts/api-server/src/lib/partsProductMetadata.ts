export type ProductPageMetadata = {
  title: string;
  description: string;
  sku: string | null;
  imageUrl: string | null;
  price: string | null;
  currency: string | null;
  priceIsStartingAt: boolean;
  inStock: boolean;
};

export type VerifiedProductMetadata = ProductPageMetadata & {
  imageUrl: string;
  price: string;
  currency: string;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f\d]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanDescription(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = decodeHtml(value)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.slice(0, 1200) : null;
}

function tagAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attributes.set(
      match[1].toLowerCase(),
      decodeHtml(match[2] ?? match[3] ?? match[4] ?? ""),
    );
  }
  return attributes;
}

function pageMetadata(html: string, key: string): string | null {
  const expected = key.toLowerCase();
  for (const match of html.matchAll(/<(meta|link)\b[^>]*>/gi)) {
    const attributes = tagAttributes(match[0]);
    const identity =
      attributes.get("property")?.toLowerCase() ??
      attributes.get("name")?.toLowerCase() ??
      (attributes.get("rel")?.toLowerCase() === "canonical" ? "canonical" : null);
    if (identity === expected) {
      return attributes.get(expected === "canonical" ? "href" : "content") ?? null;
    }
  }
  return null;
}

function typeNames(value: unknown): string[] {
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.split(/[\/#]/).pop()?.toLowerCase() ?? "");
}

function collectJsonLdNodes(value: unknown, products: JsonRecord[], pageTypes: Set<string>) {
  if (Array.isArray(value)) {
    value.forEach((entry) => collectJsonLdNodes(entry, products, pageTypes));
    return;
  }
  if (!isRecord(value)) return;
  const types = typeNames(value["@type"]);
  types.forEach((type) => pageTypes.add(type));
  if (types.includes("product")) products.push(value);
  for (const [key, child] of Object.entries(value)) {
    if (key !== "@context" && key !== "offers" && key !== "image") {
      collectJsonLdNodes(child, products, pageTypes);
    }
  }
}

function absoluteHttpsUrl(value: unknown, baseUrl: string): string | null {
  const raw = typeof value === "string" ? value : isRecord(value)
    ? value.url ?? value.contentUrl
    : null;
  if (typeof raw !== "string" || !raw.trim()) return null;
  try {
    const parsed = new URL(raw, baseUrl);
    return parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function samePage(first: string, second: string): boolean {
  try {
    const left = new URL(first);
    const right = new URL(second);
    const normalizedPath = (path: string) => path.replace(/\/+$/, "") || "/";
    return left.origin === right.origin && normalizedPath(left.pathname) === normalizedPath(right.pathname);
  } catch {
    return false;
  }
}

function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function candidateTitleMatches(candidateTitle: string, productTitle: string): boolean {
  const product = normalizeTitle(productTitle);
  if (!product || product.length < 4) return false;
  return candidateTitle
    .split(/[|–—]/)
    .some((part) => normalizeTitle(part) === product);
}

function isBlockedPagePath(pathname: string): boolean {
  return /\.(pdf|docx?|xlsx?|pptx?)$/i.test(pathname) ||
    pathname === "/" ||
    /\/(article|articles|category|categories|collections|docs?|documentation|downloads?|events?|guides|blogs?|news|pages|resources?|manuals?|documents?|search|support|tags?)(\/|$)/i.test(pathname);
}

function productDeclaredPage(product: JsonRecord): string | null {
  const page = product.mainEntityOfPage;
  if (typeof page === "string") return page;
  if (isRecord(page) && typeof page["@id"] === "string") return page["@id"];
  return typeof product.url === "string" ? product.url : null;
}

function parsePrice(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!/^\d{1,9}(?:\.\d{1,4})?$/.test(raw)) return null;
  return raw;
}

function productPrice(product: JsonRecord, html: string): {
  price: string;
  currency: string;
  priceIsStartingAt: boolean;
  inStock: boolean;
} | null {
  const offers = Array.isArray(product.offers)
    ? product.offers.filter(isRecord)
    : isRecord(product.offers) ? [product.offers] : [];
  const quotes = offers.flatMap((offer) => {
    const isAggregate = typeNames(offer["@type"]).includes("aggregateoffer");
    const specifications = Array.isArray(offer.priceSpecification)
      ? offer.priceSpecification.filter(isRecord)
      : isRecord(offer.priceSpecification) ? [offer.priceSpecification] : [];
    const candidates = [
      {
        price: parsePrice(isAggregate ? offer.lowPrice ?? offer.price : offer.price ?? offer.lowPrice),
        currency: typeof offer.priceCurrency === "string" ? offer.priceCurrency.trim().toUpperCase() : null,
      },
      ...specifications.map((specification) => ({
        price: parsePrice(specification.price ?? specification.minPrice),
        currency: typeof specification.priceCurrency === "string"
          ? specification.priceCurrency.trim().toUpperCase()
          : typeof offer.priceCurrency === "string" ? offer.priceCurrency.trim().toUpperCase() : null,
      })),
    ];
    const candidate = candidates.find((entry) =>
      entry.price && entry.currency && /^[A-Z]{3}$/.test(entry.currency),
    );
    if (!candidate?.price || !candidate.currency) return [];
    const { price, currency } = candidate;
    const availability = typeof offer.availability === "string"
      ? offer.availability.toLowerCase()
      : "";
    const outOfStock = /outofstock|soldout|discontinued|preorderonly|out_of_stock|sold_out/.test(availability);
    const highPrice = parsePrice(offer.highPrice);
    return [{ price, currency, hasRange: Boolean(highPrice && highPrice !== price), inStock: !outOfStock }];
  });

  if (quotes.length > 0) {
    const currencies = new Set(quotes.map((quote) => quote.currency));
    if (currencies.size !== 1) return null;
    const sorted = quotes.sort((left, right) => Number(left.price) - Number(right.price));
    const distinctPrices = new Set(sorted.map((quote) => quote.price));
    const inStockQuotes = sorted.filter((quote) => quote.inStock);
    const chosen = inStockQuotes.length > 0 ? inStockQuotes[0] : sorted[0];
    return {
      price: chosen.price,
      currency: chosen.currency,
      priceIsStartingAt: distinctPrices.size > 1 || sorted.some((quote) => quote.hasRange),
      inStock: inStockQuotes.length > 0,
    };
  }

  const price = parsePrice(pageMetadata(html, "product:price:amount"));
  const currency = pageMetadata(html, "product:price:currency")?.toUpperCase() ?? null;
  if (!price || !currency || !/^[A-Z]{3}$/.test(currency)) return null;
  return { price, currency, priceIsStartingAt: false, inStock: true };
}

export function extractProductPageMetadata(
  html: string,
  pageUrl: string,
  searchTitle: string,
): ProductPageMetadata | null {
  let parsedPage: URL;
  try {
    parsedPage = new URL(pageUrl);
  } catch {
    return null;
  }
  if (parsedPage.protocol !== "https:" || isBlockedPagePath(parsedPage.pathname)) return null;

  const products: JsonRecord[] = [];
  const pageTypes = new Set<string>();
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try {
      collectJsonLdNodes(JSON.parse(match[1].replace(/^\s*<!--|-->\s*$/g, "")), products, pageTypes);
    } catch {
      // Ignore malformed structured data blocks; other blocks may still describe the product.
    }
  }

  if (
    products.length === 0 ||
    [...pageTypes].some((type) => [
      "itemlist",
      "collectionpage",
      "searchresultspage",
      "article",
      "blogposting",
      "newsarticle",
    ].includes(type))
  ) {
    return null;
  }

  const pageProducts = products.filter((candidate) => {
    const declaredPage = productDeclaredPage(candidate);
    return declaredPage !== null && samePage(declaredPage, pageUrl);
  });
  const titleMatches = products.filter((candidate) =>
    typeof candidate.name === "string" && candidateTitleMatches(searchTitle, candidate.name),
  );
  const product =
    pageProducts.length === 1
      ? pageProducts[0]
      : pageProducts.length > 1
        ? null
        : products.length === 1
          ? products[0]
          : titleMatches.length === 1 ? titleMatches[0] : null;
  if (!product) return null;
  const declaredPage = productDeclaredPage(product);
  const canonical = pageMetadata(html, "canonical");
  const ogType = pageMetadata(html, "og:type")?.toLowerCase();
  const isSameProductPage =
    (declaredPage && samePage(declaredPage, pageUrl)) ||
    (canonical && samePage(canonical, pageUrl)) ||
    ogType === "product" ||
    (
      parsedPage.pathname.split("/").filter(Boolean).length > 1 &&
      candidateTitleMatches(searchTitle, typeof product.name === "string" ? product.name : "")
    );
  if (!isSameProductPage) return null;

  const title = typeof product.name === "string" ? product.name.trim().slice(0, 250) : "";
  const description =
    cleanDescription(product.description) ??
    cleanDescription(pageMetadata(html, "og:description")) ??
    cleanDescription(pageMetadata(html, "description"));
  const imageValues = Array.isArray(product.image) ? product.image : [product.image];
  const imageUrl = [
    ...imageValues,
    pageMetadata(html, "og:image"),
  ]
    .map((image) => absoluteHttpsUrl(image, pageUrl))
    .find((image): image is string => image !== null) ?? null;
  const price = productPrice(product, html);
  const sku = typeof product.sku === "string" && product.sku.trim()
    ? product.sku.trim().slice(0, 200)
    : null;

  if (!title) return null;
  return {
    title,
    description: description ?? "",
    sku,
    imageUrl,
    price: price?.price ?? null,
    currency: price?.currency ?? null,
    priceIsStartingAt: price?.priceIsStartingAt ?? false,
    inStock: price?.inStock ?? true,
  };
}

export function extractVerifiedProductMetadata(
  html: string,
  pageUrl: string,
  searchTitle: string,
): VerifiedProductMetadata | null {
  const metadata = extractProductPageMetadata(html, pageUrl, searchTitle);
  if (
    !metadata?.description ||
    !metadata.imageUrl ||
    !metadata.price ||
    !metadata.currency
  ) {
    return null;
  }
  return {
    ...metadata,
    imageUrl: metadata.imageUrl,
    price: metadata.price,
    currency: metadata.currency,
  };
}