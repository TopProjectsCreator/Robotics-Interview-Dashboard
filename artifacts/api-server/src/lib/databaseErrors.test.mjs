import assert from "node:assert/strict";
import test from "node:test";
import { isDatabaseConnectionError } from "./databaseErrors.ts";

test("recognizes a connection failure wrapped by a database query error", () => {
  const driverError = Object.assign(new Error("(ENOTFOUND) tenant/user not found"), {
    code: "XX000",
  });
  const queryError = Object.assign(new Error("Failed query: select ..."), {
    cause: driverError,
  });

  assert.equal(isDatabaseConnectionError(queryError), true);
});

test("recognizes PostgreSQL connection SQLSTATEs", () => {
  assert.equal(isDatabaseConnectionError({ code: "08006", message: "connection failure" }), true);
});

test("does not classify schema or application errors as connection failures", () => {
  assert.equal(isDatabaseConnectionError(new Error('column "missing" does not exist')), false);
  assert.equal(isDatabaseConnectionError(new Error("invalid interviewer session")), false);
});
