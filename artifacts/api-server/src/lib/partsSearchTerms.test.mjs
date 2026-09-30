import assert from "node:assert/strict";
import test from "node:test";
import {
  catalogSearchVariants,
  isRelevantCatalogSearchResult,
} from "./partsSearchTerms.ts";

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

test("requires a broad one-word query to appear in the product title", () => {
  assert.equal(
    isRelevantCatalogSearchResult(
      "field",
      "High torque motor",
      "Designed for reliable use on the field, with a compact gearbox.",
    ),
    false,
  );
  assert.equal(
    isRelevantCatalogSearchResult(
      "field",
      "Field Control System",
      "A controller for managing a robotics competition field.",
    ),
    true,
  );
});

test("accepts multiword product matches split between title and opening description", () => {
  assert.equal(
    isRelevantCatalogSearchResult(
      "shaft collar",
      "5/16 in Round Bore Split Collar Clamp",
      "Aluminum clamp-on shaft collar for a CIM motor shaft.",
    ),
    true,
  );
  assert.equal(
    isRelevantCatalogSearchResult(
      "shaft collar",
      "Round Bore Split Collar Clamp",
      `${"Clamp for secure mounting. ".repeat(20)}This is a shaft collar.`,
    ),
    false,
  );
  assert.equal(
    isRelevantCatalogSearchResult(
      "hex shaft",
      "Hex Shaft",
      "A six-sided shaft for robotics.",
    ),
    true,
  );
});

test("matches common singular and plural product terms", () => {
  assert.equal(
    isRelevantCatalogSearchResult(
      "bearing",
      "Flanged Bearings",
      "Sealed bearing for compact assemblies.",
    ),
    true,
  );
});