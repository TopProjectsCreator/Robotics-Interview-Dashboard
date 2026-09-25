import assert from "node:assert/strict";
import test from "node:test";
import { assessPasswordExposure } from "./passwordExposurePolicy.ts";

test("allows passwords with no breach matches", () => {
  assert.deepEqual(assessPasswordExposure(0), { kind: "safe" });
});

test("warns for one or two matches until explicitly confirmed", () => {
  assert.deepEqual(assessPasswordExposure(1), { kind: "warning", count: 1 });
  assert.deepEqual(assessPasswordExposure(2), { kind: "warning", count: 2 });
  assert.deepEqual(assessPasswordExposure(1, true), { kind: "safe" });
  assert.deepEqual(assessPasswordExposure(2, true), { kind: "safe" });
});

test("blocks three or more matches even when confirmation is sent", () => {
  assert.deepEqual(assessPasswordExposure(3, true), { kind: "blocked", count: 3 });
  assert.deepEqual(assessPasswordExposure(42), { kind: "blocked", count: 42 });
});

test("rejects malformed exposure counts", () => {
  assert.throws(() => assessPasswordExposure(-1), RangeError);
  assert.throws(() => assessPasswordExposure(Number.NaN), RangeError);
});