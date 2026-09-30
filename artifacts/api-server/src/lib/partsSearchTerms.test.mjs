import assert from "node:assert/strict";
import test from "node:test";
import { catalogSearchVariants } from "./partsSearchTerms.ts";

test("expands millimeter size searches to common supplier catalog notation", () => {
  const variants = catalogSearchVariants("8mm");
  assert.deepEqual(variants, ["8mm", "8 mm", "M8", "M 8"]);
});

test("preserves the rest of a query while expanding metric size notation", () => {
  const variants = catalogSearchVariants("M8 bolts");
  assert.deepEqual(variants, ["M8 bolts", "8mm bolts", "8 mm bolts", "M 8 bolts"]);
});

test("leaves non-metric searches unchanged", () => {
  assert.deepEqual(catalogSearchVariants("shaft collar"), ["shaft collar"]);
});