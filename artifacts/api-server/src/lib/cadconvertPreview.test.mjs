import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCadconvertFaceSummary,
  requireCompleteCadconvertFaceSummary,
} from "./cadconvertPreview.ts";

test("accepts a complete face summary with grouped counts", () => {
  const output =
    "source.x_t -> preview.glb (212.79 MB) 258 bodies, 41,589/41,589 faces, 10,215,626 triangles in 216.3 s";

  assert.deepEqual(parseCadconvertFaceSummary(output), {
    meshedFaces: 41_589,
    totalFaces: 41_589,
    triangles: 10_215_626,
  });
  assert.doesNotThrow(() => requireCompleteCadconvertFaceSummary(output));
});

test("rejects a conversion that leaves faces out", () => {
  const output = "preview.glb 258 bodies, 41,587/41,589 faces, 10,215,000 triangles";

  assert.throws(() => requireCompleteCadconvertFaceSummary(output), /every source face/);
});

test("rejects output without a final face summary", () => {
  assert.equal(parseCadconvertFaceSummary("conversion finished"), null);
  assert.throws(() => requireCompleteCadconvertFaceSummary("conversion finished"), /every source face/);
});

test("uses the last face summary when progress output contains interim totals", () => {
  const output = [
    "interim: 100/110 faces, 2,000 triangles",
    "done: 110/110 faces, 2,500 triangles",
  ].join("\n");

  assert.deepEqual(parseCadconvertFaceSummary(output), {
    meshedFaces: 110,
    totalFaces: 110,
    triangles: 2_500,
  });
});