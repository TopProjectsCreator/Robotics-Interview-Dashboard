import assert from "node:assert/strict";
import test from "node:test";
import { extractVerifiedProductMetadata } from "./partsProductMetadata.ts";

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

test("rejects collection pages with product cards and unavailable offers", () => {
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
  assert.equal(
    extractVerifiedProductMetadata(
      `<meta property="og:type" content="product"><script type="application/ld+json">${outOfStockProduct}</script>`,
      "https://shop.example.com/products/unavailable",
      "8 mm Shaft Collar",
    ),
    null,
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