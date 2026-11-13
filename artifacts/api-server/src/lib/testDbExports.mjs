import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Shared `@workspace/db` mock helpers for the api-server test suite.
 *
 * Mocking `@workspace/db` replaces the whole module, so every export the
 * server imports has to be present or the import throws
 * `does not provide an export named ...`. Listing those exports by hand
 * goes stale the moment the schema gains a table, which is exactly how the
 * suite broke after the chat-productivity and subagent tables landed.
 *
 * So the export map is derived from the real schema at test time: every
 * `export const` in `lib/db/src/schema` becomes a placeholder, and the
 * instance-routing helpers get inert stubs. `dbDbMockExportsAreComplete`
 * (see `dbMockCoverage.test.mjs`) fails the build if a server import is
 * still uncovered.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..", "..");
const schemaDir = path.join(repoRoot, "lib", "db", "src", "schema");
const dbIndexPath = path.join(repoRoot, "lib", "db", "src", "index.ts");

/** Every `export const` in the drizzle schema, as an inert placeholder. */
export const dbSchemaExports = (() => {
  const exports = {};
  for (const file of readdirSync(schemaDir)) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(path.join(schemaDir, file), "utf8");
    for (const match of source.matchAll(/export const (\w+)/g)) {
      exports[match[1]] = {};
    }
  }
  return exports;
})();

/** Inert stubs for the non-schema exports of `@workspace/db`. */
export const dbRuntimeExports = {
  DEFAULT_TEAM_ID: "default",
  currentInstance: () => "primary",
  enterInstance: () => {},
  runWithInstance: (_instance, fn) => fn(),
  hasSecondary: () => false,
  normalizeTeamName: (name) => String(name).toLowerCase(),
  secondaryDb: () => null,
  secondaryPool: () => null,
  db: {},
  primaryDb: {},
  pool: {},
  primaryPool: {},
};

/** The complete `@workspace/db` export map for a test mock. */
export function dbMockExports(overrides = {}) {
  return { ...dbSchemaExports, ...dbRuntimeExports, ...overrides };
}
