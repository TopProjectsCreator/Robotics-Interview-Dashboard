import test from "node:test";
import assert from "node:assert/strict";
import {
  canFallbackNewTeamToPrimary,
  isTransientDatabaseAvailabilityError,
} from "./databaseAvailability.ts";

test("classifies temporary database and pooler availability failures", () => {
  assert.equal(isTransientDatabaseAvailabilityError({ status: 429 }), true);
  assert.equal(isTransientDatabaseAvailabilityError({ statusCode: 503 }), true);
  assert.equal(isTransientDatabaseAvailabilityError({ code: "53300" }), true);
  assert.equal(isTransientDatabaseAvailabilityError({ code: "08006" }), true);
  assert.equal(isTransientDatabaseAvailabilityError({
    cause: { code: "ECONNRESET" },
  }), true);
});

test("does not classify data or validation errors as availability failures", () => {
  assert.equal(isTransientDatabaseAvailabilityError({ code: "23505" }), false);
  assert.equal(isTransientDatabaseAvailabilityError({ code: "23514" }), false);
  assert.equal(isTransientDatabaseAvailabilityError({ status: 400 }), false);
  assert.equal(isTransientDatabaseAvailabilityError(new Error("invalid input")), false);
});

test("new-team fallback requires a known secondary team list", () => {
  assert.equal(canFallbackNewTeamToPrimary({ status: 429 }, false), false);
  assert.equal(canFallbackNewTeamToPrimary({ status: 429 }, true), true);
  assert.equal(canFallbackNewTeamToPrimary({ code: "23505" }, true), false);
});
