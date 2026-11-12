import assert from "node:assert/strict";
import test from "node:test";
import {
  parseUcpAmount,
  parseUcpCurrency,
  parseUcpAvailability,
  normalizeUcpDescription,
  mapUcpProduct,
  parseUcpSearchResponse,
  callUcpMcpTool,
  fetchUcpCatalogSnapshot,
  gidNumericId,
} from "./ucpCatalog.ts";

const limelightProduct = {
  id: "gid://shopify/Product/5604572889248",
  title: "LimeLight Vision Camera",
  description: { plain: "Limelight 4 is an all-new smart camera for FRC." },
  url: "https://wcproducts.com/products/limelight-vision-camera",
  categories: [{ value: "gid://shopify/TaxonomyCategory/tg-5-9", taxonomy: "shopify" }],
  tags: ["MiscElectronics", "New2020"],
  media: [{ type: "image", url: "https://cdn.example.com/ll4.png" }],
  variants: [
    {
      id: "gid://shopify/ProductVariant/36124521758880",
      sku: "",
      title: "Default Title",
      price: { amount: 39999, currency: "USD" },
      availability: { available: true },
      media: [],
    },
  ],
};

test("minor-unit amounts parse to major-unit decimal strings and reject junk", () => {
  assert.equal(parseUcpAmount(39999), "399.99");
  assert.equal(parseUcpAmount(0), "0.00");
  assert.equal(parseUcpAmount("18999"), "189.99");
  assert.equal(parseUcpAmount(5), "0.05");
  assert.equal(parseUcpAmount(-100), null);
  assert.equal(parseUcpAmount(10_000_000_000), null); // above the supplier_price ceiling
  assert.equal(parseUcpAmount(1.5), null);
  assert.equal(parseUcpAmount(null), null);
  assert.equal(parseUcpAmount("5 dollars"), null);
});

test("currency must be ISO 4217 uppercase", () => {
  assert.equal(parseUcpCurrency("usd"), "USD");
  assert.equal(parseUcpCurrency("AUD"), "AUD");
  assert.equal(parseUcpCurrency("USDD"), null);
  assert.equal(parseUcpCurrency("U1D"), null);
});

test("availability maps status vocabularies and available flags", () => {
  assert.equal(parseUcpAvailability({ available: true, status: "backorder" }), "backorder");
  assert.equal(parseUcpAvailability({ available: true, status: "in_stock" }), "in_stock");
  assert.equal(parseUcpAvailability({ available: false, status: "out_of_stock" }), "out_of_stock");
  assert.equal(parseUcpAvailability({ available: true, status: "Discontinued" }), "discontinued");
  // Unknown fulfillment status but known boolean: boolean wins, never guesses.
  assert.equal(parseUcpAvailability({ available: false }), "out_of_stock");
  assert.equal(parseUcpAvailability({ available: true }), "in_stock");
  assert.equal(parseUcpAvailability({ status: "weird-status" }), null);
  assert.equal(parseUcpAvailability(undefined), null);
});

test("descriptions prefer plain text and strip markup", () => {
  assert.equal(normalizeUcpDescription({ plain: "Hello <b>world</b>" }), "Hello world");
  assert.equal(normalizeUcpDescription({ html: "<p>Line one<br>Line two</p>" }), "Line one Line two");
  assert.equal(normalizeUcpDescription("plain string"), "plain string");
  assert.equal(normalizeUcpDescription({ plain: "" }), null);
});

test("products map to sellable rows with https images and minor-unit prices", () => {
  const product = mapUcpProduct(limelightProduct);
  assert.ok(product);
  assert.equal(product.title, "LimeLight Vision Camera");
  assert.equal(product.category, "MiscElectronics / New2020"); // tags preferred over taxonomy GIDs
  assert.equal(product.imageUrl, "https://cdn.example.com/ll4.png");
  assert.equal(product.variants.length, 1);
  const variant = product.variants[0];
  assert.equal(variant.price, "399.99");
  assert.equal(variant.currency, "USD");
  assert.equal(variant.stockStatus, "in_stock");
  assert.equal(variant.sku, null);
});

test("search responses validate shape and carry pagination", () => {
  const page = parseUcpSearchResponse({ products: [limelightProduct], pagination: { has_next_page: true, cursor: "abc", total_count: 1584 } });
  assert.equal(page.products.length, 1);
  assert.equal(page.hasNextPage, true);
  assert.equal(page.cursor, "abc");
  assert.equal(page.totalCount, 1584);
  assert.throws(() => parseUcpSearchResponse({ nope: true }));
});

test("GID numeric ids extract for Shopify ?variant= deep links", () => {
  assert.equal(gidNumericId("gid://shopify/ProductVariant/36124521758880"), "36124521758880");
  assert.equal(gidNumericId("gid://shopify/Product/5604572889248"), "5604572889248");
  assert.equal(gidNumericId("not-a-gid"), null);
});

const mcpContent = (payload) => ({
  ok: true,
  status: 200,
  async text() {
    return JSON.stringify({ jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: JSON.stringify(payload) }] } });
  },
});

test("UCP MCP calls unwrap the tool envelope and surface tool errors", async () => {
  const happy = await callUcpMcpTool(
    "https://example.com/mcp",
    "https://example.com/profile.json",
    "search_catalog",
    { catalog: { filters: {} } },
    10_000,
    async () => mcpContent({ products: [], pagination: { has_next_page: false } }),
  );
  assert.deepEqual(happy, { products: [], pagination: { has_next_page: false } });

  await assert.rejects(
    callUcpMcpTool(
      "http://insecure.example.com/mcp",
      "https://example.com/profile.json",
      "search_catalog",
      {},
      10_000,
      async () => mcpContent({}),
    ),
    /HTTPS/,
  );

  await assert.rejects(
    callUcpMcpTool(
      "https://example.com/mcp",
      "https://example.com/profile.json",
      "search_catalog",
      {},
      10_000,
      async () => ({ ok: true, status: 200, async text() { return JSON.stringify({ jsonrpc: "2.0", id: 1, error: { message: "UCP discovery failed" } }); } }),
    ),
    /UCP discovery failed/,
  );

  await assert.rejects(
    callUcpMcpTool(
      "https://example.com/mcp",
      "https://example.com/profile.json",
      "search_catalog",
      {},
      10_000,
      async () => ({ ok: true, status: 200, async text() { return JSON.stringify({ jsonrpc: "2.0", id: 1, result: { isError: true, content: [{ type: "text", text: "profile_malformed" }] } }); } }),
    ),
    /profile_malformed/,
  );
});

test("catalog snapshot browses the purchasable and unavailable passes until has_next_page is false", async () => {
  let calls = 0;
  const products = (handles) => handles.map((handle, i) => ({
    ...limelightProduct,
    id: `gid://shopify/Product/${handle.replace(/[^a-z0-9]/gi, "x")}`,
    handle,
    url: `https://example.com/products/${handle}`,
  }));
  const fetchImpl = async (_url, init) => {
    calls += 1;
    const body = JSON.parse(init.body);
    const { filters } = body.params.arguments.catalog;
    const cursor = body.params.arguments.catalog.pagination?.cursor;
    // Second pass asks for unavailable items; return a distinct product there.
    if (filters?.available === false) {
      return mcpContent({ products: products(["soldout"]), pagination: { has_next_page: false } });
    }
    if (!cursor) {
      return mcpContent({ products: products(["a", "b"]), pagination: { has_next_page: true, cursor: "next" } });
    }
    return mcpContent({ products: products(["c"]), pagination: { has_next_page: false } });
  };
  const snapshot = await fetchUcpCatalogSnapshot(
    "https://example.com/mcp",
    "https://example.com/profile.json",
    { fetchImpl },
  );
  assert.equal(calls, 3);
  assert.deepEqual(
    snapshot.products.map((p) => p.handle).sort(),
    ["a", "b", "c", "soldout"].sort(),
  );
  assert.equal(snapshot.truncated, false);
});
