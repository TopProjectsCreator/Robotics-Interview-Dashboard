import assert from "node:assert/strict";
import test from "node:test";
import { ADMIN_SESSION_TTL_MS, isAdminSessionExpired } from "./adminSessionPolicy.ts";

test("admin sessions remain valid for 30 days, then expire", () => {
  const issuedAt = 1_800_000_000_000;
  assert.equal(ADMIN_SESSION_TTL_MS, 30 * 24 * 60 * 60 * 1000);
  assert.equal(isAdminSessionExpired(issuedAt, issuedAt + ADMIN_SESSION_TTL_MS - 1), false);
  assert.equal(isAdminSessionExpired(issuedAt, issuedAt + ADMIN_SESSION_TTL_MS + 1), true);
});

test("invalid and far-future session timestamps are rejected", () => {
  assert.equal(isAdminSessionExpired(Number.NaN, 1_800_000_000_000), true);
  assert.equal(isAdminSessionExpired(1_800_000_061_000, 1_800_000_000_000), true);
});
