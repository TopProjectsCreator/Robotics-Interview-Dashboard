import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateLineTotal,
  isPriceSnapshotStale,
  isValidCurrencyCode,
  isValidMoneyAmount,
  moneyFromDatabase,
  summarizeSavedCosts,
} from "./partsCosting.ts";

test("calculates saved line totals using quantity and cents precision", () => {
  assert.equal(calculateLineTotal(3, 2.35, "USD"), 7.05);
  assert.equal(calculateLineTotal(1, 0, "USD"), 0);
});

test("keeps missing and invalid saved costs unknown instead of counting them as zero", () => {
  assert.equal(calculateLineTotal(2, null, null), null);
  assert.equal(calculateLineTotal(2, 4.5, null), null);
  assert.equal(calculateLineTotal(0, 4.5, "USD"), null);
  assert.deepEqual(
    summarizeSavedCosts([
      { quantity: 2, unitCost: 4.5, currency: "USD" },
      { quantity: 3, unitCost: 2, currency: "EUR" },
      { quantity: 1, unitCost: null, currency: null },
    ]),
    {
      subtotalsByCurrency: [
        { currency: "EUR", amount: 6 },
        { currency: "USD", amount: 9 },
      ],
      unpricedPartCount: 1,
    },
  );
});

test("validates saved money amounts and ISO currency codes", () => {
  assert.equal(isValidMoneyAmount(1.2), true);
  assert.equal(isValidMoneyAmount(1.234), false);
  assert.equal(isValidMoneyAmount(-1), false);
  assert.equal(isValidMoneyAmount(Number.NaN), false);
  assert.equal(isValidCurrencyCode("CAD"), true);
  assert.equal(isValidCurrencyCode("usd"), false);
  assert.equal(moneyFromDatabase("10.50"), 10.5);
  assert.equal(moneyFromDatabase("not-money"), null);
});

test("marks only snapshots older than the 30-day threshold as stale", () => {
  const now = Date.parse("2026-09-30T00:00:00.000Z");
  assert.equal(isPriceSnapshotStale("2026-09-01T00:00:00.000Z", now), false);
  assert.equal(isPriceSnapshotStale("2026-08-30T00:00:00.000Z", now), true);
  assert.equal(isPriceSnapshotStale("not-a-date", now), true);
});