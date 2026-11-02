import assert from "node:assert/strict";
import test from "node:test";
import {
  parsePublishedFtcTeamPrice,
  readFtcPricingPreference,
  saveFtcPricingPreference,
  selectSupplierPrice,
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
