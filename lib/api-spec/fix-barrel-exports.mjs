#!/usr/bin/env node
/**
 * Repair the `@workspace/api-zod` barrel after Orval regenerates it.
 *
 * Orval appends a re-export for the schema-types directory using the bare
 * directory path:
 *
 *     export * from './generated/types';
 *
 * `generated/types` is a DIRECTORY (Orval writes `generated/types/index.ts`
 * plus one file per schema). Node's ESM resolver does not perform
 * directory-index resolution, so that specifier throws
 * `ERR_MODULE_NOT_FOUND` and every test that imports `@workspace/api-zod`
 * fails to load. TypeScript and bundlers tolerate it, which is why it slips
 * through until the server runs its own test suite.
 *
 * Rewriting the specifier to the directory's `index` file keeps the barrel
 * equivalent and resolves under every resolver. The re-export is idempotent:
 * Orval deduplicates on the specifier string, so it will not re-append the
 * broken form once the corrected one is present.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const barrelPath = path.resolve(here, "..", "api-zod", "src", "index.ts");

const BROKEN = "export * from './generated/types';";
const FIXED = "export * from './generated/types/index';";

let source;
try {
  source = await readFile(barrelPath, "utf8");
} catch (error) {
  console.error(`Could not read ${barrelPath}: ${error?.message ?? error}`);
  process.exit(1);
}

if (!source.includes(BROKEN)) {
  console.log("api-zod barrel already resolves the schema types directory.");
  process.exit(0);
}

// Rewrite every occurrence and collapse the duplicates that a previous run may
// have left behind, so the barrel stays idempotent across regenerations.
const seen = new Set();
const lines = source.split("\n").filter((line) => {
  const normalized = line.trim();
  if (normalized !== BROKEN && normalized !== FIXED) return true;
  const specifier = normalized === BROKEN ? FIXED : FIXED;
  if (seen.has(specifier)) return false;
  seen.add(specifier);
  return true;
}).map((line) => (line.trim() === BROKEN ? FIXED : line));

await writeFile(barrelPath, lines.join("\n"), "utf8");
console.log(`Rewrote the api-zod barrel to "${FIXED}" (directory imports do not resolve under Node ESM).`);
