import assert from "node:assert/strict";
import test from "node:test";
import {
  SHOW_SVG_MAX_CHARS,
  normalizeShowSvg,
  resolveShowSvg,
  showSvgApprovedResult,
  showSvgNotPreviewedResult,
  showSvgPreviewResult,
  validateShowSvg,
} from "./assistantSvg.ts";

const SAFE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="teal" /><text x="5" y="5">Hi</text></svg>';

test("accepts a self-contained SVG diagram", () => {
  assert.equal(validateShowSvg(SAFE_SVG), null);
  assert.equal(validateShowSvg(`  ${SAFE_SVG}  `), null);
});

test("rejects empty and non-SVG payloads", () => {
  assert.match(validateShowSvg("") ?? "", /empty/);
  assert.match(validateShowSvg("   ") ?? "", /empty/);
  assert.match(validateShowSvg(undefined) ?? "", /empty/);
  assert.match(validateShowSvg("<div>hi</div>") ?? "", /complete <svg>/);
  assert.match(validateShowSvg("<svg viewBox=\"0 0 1 1\">") ?? "", /complete <svg>/);
});

test("rejects oversized SVGs", () => {
  const huge = `<svg>${"x".repeat(SHOW_SVG_MAX_CHARS)}</svg>`;
  assert.match(validateShowSvg(huge) ?? "", /characters/);
});

test("rejects scripts, handlers, external references, and forbidden elements", () => {
  assert.match(validateShowSvg('<svg><script>alert(1)</script></svg>') ?? "", /<script>/);
  assert.match(validateShowSvg('<svg onload="alert(1)"></svg>') ?? "", /event handler/);
  assert.match(validateShowSvg('<svg><a href="https://example.com">x</a></svg>') ?? "", /<a> link/);
  assert.match(validateShowSvg('<svg><use xlink:href="#icon" /></svg>') ?? "", /href/);
  assert.match(validateShowSvg('<svg><image src="https://example.com/x.png" /></svg>') ?? "", /src/);
  assert.match(validateShowSvg('<svg><foreignObject></foreignObject></svg>') ?? "", /foreignObject/);
  assert.match(validateShowSvg('<svg><style>rect{fill:red}</style></svg>') ?? "", /<style>/);
  assert.match(validateShowSvg('<svg><rect fill="url(javascript:alert(1))" /></svg>') ?? "", /javascript:/);
});

test("normalizes surrounding whitespace and builds preview/approval messages", () => {
  assert.equal(normalizeShowSvg(`\n  ${SAFE_SVG}\n`), SAFE_SVG);
  const preview = showSvgPreviewResult(SAFE_SVG, "Ranking");
  assert.match(preview, /NOT sent to the admin yet/);
  assert.match(preview, /Are you sure this is good to send to the user\?/);
  assert.match(preview, /confirm=true/);
  assert.ok(preview.includes(SAFE_SVG));
  assert.match(showSvgPreviewResult(SAFE_SVG, ""), /^SVG preview \(/);
  assert.match(showSvgApprovedResult("Ranking"), /"Ranking".*sent to the admin/);
  assert.match(showSvgNotPreviewedResult(), /not been previewed/);
});

test("requires a preview before a send and only sends after confirmation", () => {
  const state = { previews: new Set(), approved: [] };

  // Confirming something never previewed is rejected; nothing is sent.
  const notPreviewed = resolveShowSvg(state, SAFE_SVG, true, "Ranking");
  assert.equal(notPreviewed.kind, "not-previewed");
  assert.deepEqual(state.approved, []);

  // The first (unconfirmed) call previews it back to the model.
  const preview = resolveShowSvg(state, SAFE_SVG, false, "Ranking");
  assert.equal(preview.kind, "previewed");
  assert.match(preview.message, /Are you sure this is good to send to the user\?/);
  assert.deepEqual(state.approved, []);

  // A confirm on different markup is still not the previewed SVG.
  const changed = resolveShowSvg(state, SAFE_SVG.replace("Hi", "Bye"), true);
  assert.equal(changed.kind, "not-previewed");

  // Confirming the exact previewed markup sends it once.
  const approved = resolveShowSvg(state, SAFE_SVG, true, "Ranking");
  assert.equal(approved.kind, "approved");
  assert.match(approved.message, /sent to the admin/);
  assert.deepEqual(state.approved, [SAFE_SVG]);

  // Re-sending the same SVG is a no-op.
  assert.equal(resolveShowSvg(state, SAFE_SVG, true).kind, "already-sent");
  assert.deepEqual(state.approved, [SAFE_SVG]);
});

test("rejects invalid SVGs before previewing or sending", () => {
  const state = { previews: new Set(), approved: [] };
  const invalid = resolveShowSvg(state, "<svg><script>x</script></svg>", false);
  assert.equal(invalid.kind, "invalid");
  assert.deepEqual([...state.previews], []);
  assert.deepEqual(state.approved, []);
});
