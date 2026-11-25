import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const source = readFileSync(
  fileURLToPath(new URL("../index.ts", import.meta.url)),
  "utf8",
);

test("already-applied ADD COLUMN migrations are skipped before taking ACCESS EXCLUSIVE", () => {
  const start = source.indexOf("function skipAppliedAddColumn");
  assert.notEqual(start, -1);
  const helper = source.slice(start, start + 1100);
  assert.match(helper, /information_schema\.columns/);
  assert.match(helper, /column_name = '\$\{column\}'/);
  assert.match(helper, /execute 'alter table/);
  assert.match(
    source,
    /\.\.\.privateTableRlsStatements,\s*\]\.map\(skipAppliedAddColumn\)\.map\(skipAppliedCreateTrigger\)\.map\(skipAppliedCreateIndex\)\.map\(withSchemaLockTimeout\);/,
    "all startup schema statements must pass through the guard",
  );
});

test("existing revision triggers are not recreated on a busy table", () => {
  const start = source.indexOf("function skipAppliedCreateTrigger");
  assert.notEqual(start, -1);
  const helper = source.slice(start, start + 900);
  assert.match(helper, /pg_trigger/);
  assert.match(helper, /tgrelid/);
  assert.match(
    source,
    /\.map\(skipAppliedAddColumn\)\.map\(skipAppliedCreateTrigger\)/,
  );
});

test("every schema statement has a short DB-side lock timeout backstop", () => {
  const start = source.indexOf("function withSchemaLockTimeout");
  assert.notEqual(start, -1);
  const helper = source.slice(start, start + 500);
  assert.match(helper, /set local lock_timeout/);
  assert.doesNotMatch(source, /privateTableRlsStatements\) \{\s*\n\s*await withSchemaTimeout\(pool\.query\(sql\)/);
});

test("RLS enablement is skipped when the table already has it", () => {
  const start = source.indexOf("IF to_regclass('public.${tableName}') IS NOT NULL THEN");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 700);
  assert.match(block, /relrowsecurity/);
  assert.match(block, /ENABLE ROW LEVEL SECURITY/);
});
