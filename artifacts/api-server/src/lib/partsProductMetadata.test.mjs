import assert from "node:assert/strict";
import test from "node:test";
import {
  extractProductPageMetadata,
  extractVerifiedProductMetadata,
} from "./partsProductMetadata.ts";

const productJsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Product",
  name: "8 mm Shaft Collar",
  description: "An aluminum shaft collar with a clamping screw.",
  sku: "COLLAR-8",
  image: "https://cdn.example.com/collar.jpg",
  offers: {
    "@type": "Offer",
    price: "4.50",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
});

test("extracts product details only when supplier markup includes image and priced offer", () => {
  const html = `<html><head><meta property="og:type" content="product"></head><body><script type="application/ld+json">${productJsonLd}</script></body></html>`;
  assert.deepEqual(
    extractVerifiedProductMetadata(html, "https://shop.example.com/products/collar", "8 mm Shaft Collar | Shop"),
    {
      title: "8 mm Shaft Collar",
      description: "An aluminum shaft collar with a clamping screw.",
      sku: "COLLAR-8",
      imageUrl: "https://cdn.example.com/collar.jpg",
      price: "4.50",
      currency: "USD",
      priceIsStartingAt: false,
      inStock: true,
    },
  );
});

test("rejects PDFs, category pages, and structured data without an image or offer", () => {
  const category = `<script type="application/ld+json">${productJsonLd}</script>`;
  assert.equal(
    extractVerifiedProductMetadata(category, "https://shop.example.com/categories/shafts", "Shafts"),
    null,
  );
  assert.equal(
    extractVerifiedProductMetadata(category, "https://shop.example.com/manual.pdf", "Manual"),
    null,
  );

  const incompleteProduct = JSON.stringify({
    "@type": "Product",
    name: "Unpriced item",
    description: "Product description",
    image: "https://cdn.example.com/item.jpg",
  });
  assert.equal(
    extractVerifiedProductMetadata(
      `<meta property="og:type" content="product"><script type="application/ld+json">${incompleteProduct}</script>`,
      "https://shop.example.com/products/unpriced",
      "Unpriced item",
    ),
    null,
  );
});

test("keeps verified product pages when the supplier does not publish price, image, or description", () => {
  const product = JSON.stringify({
    "@type": "Product",
    name: "Unpriced actuator bracket",
    sku: "BRACKET-ACT-1",
  });
  const html = `<meta property="og:type" content="product"><script type="application/ld+json">${product}</script>`;
  const pageUrl = "https://shop.example.com/products/actuator-bracket";
  assert.deepEqual(
    extractProductPageMetadata(html, pageUrl, "Unpriced actuator bracket"),
    {
      title: "Unpriced actuator bracket",
      description: "",
      sku: "BRACKET-ACT-1",
      imageUrl: null,
      price: null,
      currency: null,
      priceIsStartingAt: false,
      inStock: true,
    },
  );
  assert.equal(
    extractVerifiedProductMetadata(html, pageUrl, "Unpriced actuator bracket"),
    null,
  );
});

test("rejects collection pages with product cards and marks unavailable offers out of stock", () => {
  const collection = JSON.stringify({
    "@type": "CollectionPage",
    "@graph": [JSON.parse(productJsonLd)],
  });
  assert.equal(
    extractVerifiedProductMetadata(
      `<script type="application/ld+json">${collection}</script>`,
      "https://shop.example.com/parts",
      "8 mm Shaft Collar",
    ),
    null,
  );

  const outOfStockProduct = JSON.stringify({
    ...JSON.parse(productJsonLd),
    offers: { "@type": "Offer", price: "4.50", priceCurrency: "USD", availability: "https://schema.org/OutOfStock" },
  });
  assert.deepEqual(
    extractVerifiedProductMetadata(
      `<meta property="og:type" content="product"><script type="application/ld+json">${outOfStockProduct}</script>`,
      "https://shop.example.com/products/unavailable",
      "8 mm Shaft Collar",
    ),
    {
      title: "8 mm Shaft Collar",
      description: "An aluminum shaft collar with a clamping screw.",
      sku: "COLLAR-8",
      imageUrl: "https://cdn.example.com/collar.jpg",
      price: "4.50",
      currency: "USD",
      priceIsStartingAt: false,
      inStock: false,
    },
  );
});

test("supports supplier product price metadata and marks variant ranges as starting prices", () => {
  const rangedProduct = JSON.stringify({
    "@type": "Product",
    name: "Motor Mount",
    description: "Adjustable motor mount.",
    image: "https://cdn.example.com/mount.jpg",
    offers: [
      { "@type": "Offer", price: "12.00", priceCurrency: "USD" },
      { "@type": "Offer", price: "18.00", priceCurrency: "USD" },
    ],
  });
  const result = extractVerifiedProductMetadata(
    `<meta property="og:type" content="product"><script type="application/ld+json">${rangedProduct}</script>`,
    "https://shop.example.com/products/mount",
    "Motor Mount",
  );
  assert.equal(result?.price, "12.00");
  assert.equal(result?.priceIsStartingAt, true);
});

test("selects the current product from a page graph with unrelated product cards", () => {
  const currentProduct = {
    ...JSON.parse(productJsonLd),
    mainEntityOfPage: "https://shop.example.com/products/collar",
  };
  const recommendation = {
    ...JSON.parse(productJsonLd),
    name: "6 mm Shaft Collar",
    sku: "COLLAR-6",
    mainEntityOfPage: "https://shop.example.com/products/collar-6mm",
  };
  const html = `<meta property="og:type" content="product"><script type="application/ld+json">${JSON.stringify({ "@graph": [recommendation, currentProduct] })}</script>`;
  const result = extractVerifiedProductMetadata(
    html,
    "https://shop.example.com/products/collar",
    "8 mm Shaft Collar | Shop",
  );
  assert.equal(result?.title, "8 mm Shaft Collar");
  assert.equal(result?.sku, "COLLAR-8");
});

test("uses a later valid HTTPS product image and a structured price specification", () => {
  const item = {
    ...JSON.parse(productJsonLd),
    image: ["javascript:bad-image", "https://cdn.example.com/collar-large.jpg"],
    offers: {
      "@type": "Offer",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "5.25",
        priceCurrency: "USD",
      },
    },
  };
  const html = `<meta property="og:type" content="product"><script type="application/ld+json">${JSON.stringify(item)}</script>`;
  const result = extractVerifiedProductMetadata(
    html,
    "https://shop.example.com/products/collar",
    "8 mm Shaft Collar",
  );
  assert.equal(result?.imageUrl, "https://cdn.example.com/collar-large.jpg");
  assert.equal(result?.price, "5.25");
  assert.equal(result?.currency, "USD");
});