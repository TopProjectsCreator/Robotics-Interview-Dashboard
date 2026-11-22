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
 * equivalent and resolves under every resolver. It also resolves the
 * generated query/path parameter type collision for board asset uploads.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const barrelPath = path.resolve(here, "..", "api-zod", "src", "index.ts");

const BROKEN = "export * from './generated/types';";
const FIXED = "export * from './generated/types/index';";
const BOARD_ASSET_PARAM_EXPORTS = [
  "// Orval emits this parameter schema and a generated parameter type with the same name.",
  "export { UploadBoardCardAssetParams } from './generated/api';",
  "export type { UploadBoardCardAssetParams as UploadBoardCardAssetPathParams } from './generated/types/uploadBoardCardAssetParams';",
].join("\n");

let source;
try {
  source = await readFile(barrelPath, "utf8");
} catch (error) {
  console.error(`Could not read ${barrelPath}: ${error?.message ?? error}`);
  process.exit(1);
}

// Rewrite every occurrence and collapse duplicates, so the barrel stays
// idempotent across regenerations.
const seen = new Set();
let lines = source.split("\n").filter((line) => {
  const normalized = line.trim();
  if (normalized !== BROKEN && normalized !== FIXED) return true;
  if (seen.has(FIXED)) return false;
  seen.add(FIXED);
  return true;
}).map((line) => (line.trim() === BROKEN ? FIXED : line));

lines = lines.filter((line) =>
  !line.includes("UploadBoardCardAssetParams") &&
  !line.includes("UploadBoardCardAssetPathParams") &&
  !line.includes("Orval emits this parameter schema"),
);
lines.splice(lines.findIndex((line) => line.trim() === "export * from './generated/api';"), 0, ...BOARD_ASSET_PARAM_EXPORTS.split("\n"));

await writeFile(barrelPath, lines.join("\n"), "utf8");
console.log(`Rewrote the api-zod barrel to resolve generated exports and Node ESM directory imports.`);
