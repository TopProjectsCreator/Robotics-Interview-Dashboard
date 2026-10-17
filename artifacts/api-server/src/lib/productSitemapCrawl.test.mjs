import assert from "node:assert/strict";
import test from "node:test";

// productSitemapCrawl.ts has no relative imports, so Node's type stripping can
// load it without the extension-resolution hooks the seed tests need.
const {
  parseSitemapProductUrls,
  parseSchemaOrgProduct,
  productUrlSlug,
} = await import("./productSitemapCrawl.ts");

const TARGET = { domain: "gobilda.com" };

/**
 * Shape captured from https://www.gobilda.com/xmlsitemap.php?type=products&page=1.
 * The live document is a single flat urlset with no <lastmod> entries.
 */
const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url>
        <loc>https://www.gobilda.com/worm-gear-set-24-1-ratio-6mm-d-bore-worm/</loc>
      </url><url>
        <loc>https://www.gobilda.com/outlaw-chassis-kit/</loc>
      </url><url>
        <loc>https://www.gobilda.com/worm-gear-set-24-1-ratio-6mm-d-bore-worm/</loc>
      </url><url>
        <loc>http://www.gobilda.com/insecure-part/</loc>
      </url><url>
        <loc>https://evil-example.com/copied-part/</loc>
      </url></urlset>`;

/**
 * Shape captured from a live goBILDA product page. The page also ships a
 * BreadcrumbList block, which must be ignored in favour of the Product block.
 */
const PRODUCT_HTML = `<html><head>
<script type="application/ld+json">
{ "@context": "https://schema.org", "@type": "BreadcrumbList",
  "itemListElement": [ { "@type": "ListItem", "position": 1,
    "item": { "@id": "https:\\u002f\\u002fwww.gobilda.com\\u002f", "name": "Home" } } ] }
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Worm Gear Set (24:1 Ratio, 6mm D-Bore Worm)",
  "sku": "3204-0001-0001",
  "url" : "https://www.gobilda.com/worm-gear-set-24-1-ratio-6mm-d-bore-worm/",
  "description": "This worm gear set works with a 6mm D-shaft as the input to the worm.",
  "image": "https://cdn11.bigcommerce.com/s-x56mtydx1w/images/stencil/2400x2400/products/1036/5034/3204-0001-0001__27623__21557.1701992408.jpg?c=1",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "USD",
    "price": "24.99",
    "itemCondition": "https://schema.org/NewCondition",
    "availability": "https://schema.org/OutOfStock",
    "url": "https://www.gobilda.com/worm-gear-set-24-1-ratio-6mm-d-bore-worm/",
    "priceValidUntil": "2027-10-17"
  }
}
</script></head><body></body></html>`;

test("sitemap parsing keeps only same-host https product URLs and de-duplicates", () => {
  const urls = parseSitemapProductUrls(SITEMAP, TARGET);
  assert.deepEqual(urls, [
    "https://www.gobilda.com/worm-gear-set-24-1-ratio-6mm-d-bore-worm/",
    "https://www.gobilda.com/outlaw-chassis-kit/",
  ]);
});

test("sitemap parsing drops off-host and non-https entries", () => {
  const urls = parseSitemapProductUrls(SITEMAP, TARGET);
  assert.ok(!urls.some((url) => url.includes("evil-example.com")));
  assert.ok(!urls.some((url) => url.startsWith("http://")));
});

test("sitemap parsing tolerates a host that merely ends with the domain", () => {
  const xml = `<urlset><url><loc>https://notgobilda.com/part/</loc></url></urlset>`;
  assert.deepEqual(parseSitemapProductUrls(xml, TARGET), []);
});

test("product JSON-LD yields every catalog field including stock state", () => {
  const product = parseSchemaOrgProduct(PRODUCT_HTML);
  assert.ok(product, "expected a Product block");
  assert.equal(product.name, "Worm Gear Set (24:1 Ratio, 6mm D-Bore Worm)");
  assert.equal(product.sku, "3204-0001-0001");
  assert.equal(product.price, "24.99");
  assert.equal(product.currency, "USD");
  assert.equal(product.inStock, false, "OutOfStock must not read as in stock");
  assert.ok(product.imageUrl.startsWith("https://"));
  assert.ok(product.description.length > 0);
});

test("in-stock availability reads as in stock", () => {
  const html = PRODUCT_HTML.replace("schema.org/OutOfStock", "schema.org/InStock");
  assert.equal(parseSchemaOrgProduct(html).inStock, true);
});

test("a Product block without offers still yields identity fields", () => {
  const html = `<script type="application/ld+json">
    { "@type": "Product", "name": "Bracket", "sku": "1234-0001-0001",
      "url": "https://www.gobilda.com/bracket/" }</script>`;
  const product = parseSchemaOrgProduct(html);
  assert.equal(product.name, "Bracket");
  assert.equal(product.sku, "1234-0001-0001");
  assert.equal(product.price, null);
  assert.equal(product.currency, null);
  assert.equal(product.inStock, true, "unknown availability defaults to orderable");
});

test("a non-https image is dropped rather than stored", () => {
  const html = PRODUCT_HTML.replace(
    "https://cdn11.bigcommerce.com",
    "http://cdn11.bigcommerce.com",
  );
  assert.equal(parseSchemaOrgProduct(html).imageUrl, null);
});

test("pages with no Product block return null instead of throwing", () => {
  assert.equal(parseSchemaOrgProduct("<html><body>Not a product</body></html>"), null);
  assert.equal(parseSchemaOrgProduct(""), null);
});

test("a malformed JSON-LD block does not abort a later valid one", () => {
  const html = `<script type="application/ld+json">{ not json </script>${PRODUCT_HTML}`;
  assert.ok(parseSchemaOrgProduct(html));
});

test("product URL slugs are stable identifiers", () => {
  assert.equal(
    productUrlSlug("https://www.gobilda.com/worm-gear-set-24-1-ratio-6mm-d-bore-worm/"),
    "worm-gear-set-24-1-ratio-6mm-d-bore-worm",
  );
  assert.equal(productUrlSlug("not a url"), null);
});
