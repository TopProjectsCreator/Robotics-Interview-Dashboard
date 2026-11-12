import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePublishedFtcTeamPrice,
  isPartsOrderQuantityAllowed,
  readMaxPartsOrderItems,
  readFtcPricingPreference,
  saveMaxPartsOrderItems,
  saveFtcPricingPreference,
  selectSupplierPrice,
  shopifyFeedVariantPrice,
} from "./partsPricing.ts";

test("parses explicit FTC price labels and preserves each published amount", () => {
  const cases = [
    ['<span>FTC Team Price: $17.49</span>', "17.49"],
    ['<div>FTC Price USD 13.25</div>', "13.25"],
    ['<p>Team price for FTC: $3.12</p>', "3.12"],
  ];
  for (const [html, expected] of cases) {
    assert.equal(parsePublishedFtcTeamPrice(html), expected);
  }
});

test("does not infer an FTC discount or read hidden markup as a published price", () => {
  assert.equal(
    parsePublishedFtcTeamPrice('<p>Regular price $24.99</p><p>Save 30% with FTC</p>'),
    null,
  );
  assert.equal(
    parsePublishedFtcTeamPrice('<script>FTC Team Price: $12.00</script><p>Price: $24.00</p>'),
    null,
  );
});

test("selects the published FTC price when enabled and falls back to regular price", () => {
  assert.deepEqual(selectSupplierPrice("24.99", "17.49", true), {
    price: "17.49",
    priceType: "ftc",
  });
  assert.deepEqual(selectSupplierPrice("24.99", null, true), {
    price: "24.99",
    priceType: "regular",
  });
  assert.deepEqual(selectSupplierPrice("24.99", "17.49", false), {
    price: "24.99",
    priceType: "regular",
  });
});

test("team FTC pricing preference persists independently by team", async () => {
  const settings = new Map();
  const queries = [];
  const query = async (statement, values = []) => {
    queries.push({ statement, values });
    if (statement.includes("select")) {
      const preference = settings.get(values[0]);
      return { rows: preference === undefined ? [] : [{ useFtcPricing: preference }] };
    }
    if (statement.includes("insert")) {
      settings.set(values[0], values[1]);
      return { rows: [{ useFtcPricing: values[1] }] };
    }
    throw new Error(`Unexpected pricing preference statement: ${statement}`);
  };

  assert.equal(await readFtcPricingPreference(query, "team-a"), false);
  assert.equal(await saveFtcPricingPreference(query, "team-a", true), true);
  assert.equal(await readFtcPricingPreference(query, "team-a"), true);
  assert.equal(await readFtcPricingPreference(query, "team-b"), false);
  assert.ok(queries.every(({ statement }) => statement.includes('"team_id" = $1') || statement.includes('("team_id"')));
  assert.deepEqual(settings, new Map([["team-a", true]]));
});

test("team order quantity limits persist independently and enforce the boundary", async () => {
  const settings = new Map();
  const queries = [];
  const query = async (statement, values = []) => {
    queries.push({ statement, values });
    if (statement.includes("select")) {
      const maxOrderItems = settings.get(values[0]) ?? null;
      return { rows: [{ maxOrderItems }] };
    }
    if (statement.includes("insert")) {
      settings.set(values[0], values[1]);
      return { rows: [{ maxOrderItems: values[1] }] };
    }
    throw new Error(`Unexpected order limit statement: ${statement}`);
  };

  assert.equal(await readMaxPartsOrderItems(query, "team-a"), null);
  assert.equal(await isPartsOrderQuantityAllowed(query, "team-a", 500), true);
  assert.equal(await saveMaxPartsOrderItems(query, "team-a", 3), 3);
  assert.equal(await readMaxPartsOrderItems(query, "team-a"), 3);
  assert.equal(await isPartsOrderQuantityAllowed(query, "team-a", 3), true);
  assert.equal(await isPartsOrderQuantityAllowed(query, "team-a", 4), false);
  assert.equal(await readMaxPartsOrderItems(query, "team-b"), null);
  assert.equal(await saveMaxPartsOrderItems(query, "team-a", null), null);
  assert.equal(await isPartsOrderQuantityAllowed(query, "team-a", 500), true);
  assert.deepEqual(settings, new Map([["team-a", null]]));
  assert.ok(queries.every(({ statement }) => statement.includes('"team_id" = $1') || statement.includes('("team_id"')));
});

test("shopify feed variant prices are accepted only in major-unit decimal shape", () => {
  assert.equal(shopifyFeedVariantPrice("399.99"), "399.99");
  assert.equal(shopifyFeedVariantPrice("1249"), "1249");
  assert.equal(shopifyFeedVariantPrice("0.99"), "0.99");
  assert.equal(shopifyFeedVariantPrice(399.99), "399.99");
  assert.equal(shopifyFeedVariantPrice("17.493"), "17.493");
});

test("shopify feed variant prices reject anything that could reach SQL malformed", () => {
  assert.equal(shopifyFeedVariantPrice(""), null);
  assert.equal(shopifyFeedVariantPrice("399,99"), null);
  assert.equal(shopifyFeedVariantPrice("1,249.00"), null);
  assert.equal(shopifyFeedVariantPrice("$399.99"), null);
  assert.equal(shopifyFeedVariantPrice("USD 399.99"), null);
  assert.equal(shopifyFeedVariantPrice("-5"), null);
  assert.equal(shopifyFeedVariantPrice("NaN"), null);
  assert.equal(shopifyFeedVariantPrice(null), null);
  assert.equal(shopifyFeedVariantPrice(undefined), null);
  assert.equal(shopifyFeedVariantPrice("99999999.99"), "99999999.99");
  assert.equal(shopifyFeedVariantPrice("99999999999.99"), null);
});
