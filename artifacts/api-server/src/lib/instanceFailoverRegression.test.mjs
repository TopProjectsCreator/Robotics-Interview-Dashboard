import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { isDatabaseConnectionError } from "../lib/databaseErrors.ts";

test("pg-pool connection acquisition timeout counts as a connection error", () => {
  assert.equal(
    isDatabaseConnectionError(new Error("timeout exceeded when trying to connect")),
    true,
  );
  assert.equal(
    isDatabaseConnectionError(new Error("canceling statement due to statement timeout")),
    false,
    "a slow query must not be mistaken for an unavailable instance",
  );
});

test("health probes start before schema and schema successes do not override them", () => {
  const source = readFileSync(
    fileURLToPath(new URL("../index.ts", import.meta.url)),
    "utf8",
  );
  assert.match(
    source,
    /startInstanceHealthProbes\(\);\s*\n\s*attemptSchema\(\);/,
    "probes must start before the initial schema migration begins",
  );
  assert.doesNotMatch(
    source,
    /markInstanceSuccess\(/,
    "schema statements must not reset probe failure counts",
  );
});
