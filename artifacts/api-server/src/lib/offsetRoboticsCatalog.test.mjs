import assert from "node:assert/strict";
import test from "node:test";

import {
  collectOffsetRoboticsCatalog,
  parseOffsetRoboticsCollectionPage,
  parseOffsetRoboticsCollections,
} from "./offsetRoboticsCatalog.ts";

function page(props) {
  return `<script data-page="app" type="application/json">${JSON.stringify({ props })}</script>`;
}

function homePage(collections) {
  return page({
    storeNav: {
      header: [{
        type: "catalog",
        catalog: {
          collections: collections.map((path, index) => ({
            name: `Collection ${index + 1}`,
            url: path,
          })),
        },
      }],
    },
  });
}

test("Offset navigation yields distinct official collection URLs only", () => {
  const html = homePage([
    "/catalog/structure/parts",
    "/catalog/motion/parts",
    "/catalog/structure/parts",
    "https://outside.example/catalog/ignored",
  ]);
  assert.deepEqual(
    parseOffsetRoboticsCollections(html).map((collection) => collection.url),
    [
      "https://offsetrobotics.com/catalog/structure/parts",
      "https://offsetrobotics.com/catalog/motion/parts",
    ],
  );
});

test("Offset collection records preserve current listing price, stock, and safe URLs", () => {
  const html = page({
    defaultCurrency: "USD",
    products: [
      {
        name: "Threaded Square Beam",
        slug: "threaded-square-beam",
        url: "/product/threaded-square-beam",
        default_image: "/media-cache/1/card.webp",
        price_min: 3.59,
        price_max: 3.59,
        stock_status: "in_stock",
        view_status: "public",
      },
      {
        name: "Variant Bundle",
        slug: "variant-bundle",
        url: "/product/variant-bundle",
        price_min: 2,
        price_max: 4,
      },
      {
        name: "Private",
        slug: "private",
        url: "/product/private",
        view_status: "hidden",
      },
      {
        name: "External",
        slug: "external",
        url: "https://outside.example/product/external",
      },
    ],
  });
  assert.deepEqual(
    parseOffsetRoboticsCollectionPage(
      html,
      "https://offsetrobotics.com/catalog/structure/parts",
      "Structure",
    ),
    [{
      externalKey: "threaded-square-beam",
      name: "Threaded Square Beam",
      category: "Structure",
      productUrl: "https://offsetrobotics.com/product/threaded-square-beam",
      imageUrl: "https://offsetrobotics.com/media-cache/1/card.webp",
      supplierPrice: "3.59",
      supplierPriceCurrency: "USD",
      stockStatus: "in_stock",
    }, {
      externalKey: "variant-bundle",
      name: "Variant Bundle",
      category: "Structure",
      productUrl: "https://offsetrobotics.com/product/variant-bundle",
      imageUrl: null,
      supplierPrice: null,
      supplierPriceCurrency: null,
      stockStatus: null,
    }],
  );
});

test("Offset full sync requires all site-listed collections and keeps partial progress", async () => {
  const collections = Array.from({ length: 12 }, (_, index) => `/catalog/group/collection-${index + 1}`);
  const fetchImpl = async (input) => {
    const url = String(input);
    const html = url === "https://offsetrobotics.com/"
      ? homePage(collections)
      : page({
          defaultCurrency: "USD",
          products: [{
            name: `Product ${new URL(url).pathname.split("-").at(-1)}`,
            slug: `product-${new URL(url).pathname.split("-").at(-1)}`,
            url: `/product/product-${new URL(url).pathname.split("-").at(-1)}`,
            view_status: "public",
          }],
        });
    return new Response(html, { status: 200 });
  };
  const result = await collectOffsetRoboticsCatalog({ fetchImpl, requestDelayMs: 0 });
  assert.equal(result.collectionsFound, 12);
  assert.equal(result.collectionsFetched, 12);
  assert.equal(result.failedCollections.length, 0);
  assert.equal(result.records.length, 12);

  await assert.rejects(
    collectOffsetRoboticsCatalog({
      fetchImpl: async () => new Response(homePage(["/catalog/group/one"]), { status: 200 }),
      requestDelayMs: 0,
    }),
    /at least 12 are required/,
  );
});
