import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { dbMockExports } from "./testDbExports.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.resolve(here, "..");

function serverSources() {
  const files = [];
  for (const file of readdirSync(srcDir, { recursive: true })) {
    if (!file.endsWith(".ts") || file.includes(".test.")) continue;
    files.push(path.join(srcDir, file));
  }
  return files;
}

test("the shared db mock covers every @workspace/db export the server imports", () => {
  const mock = dbMockExports();
  const missing = new Set();
  for (const file of serverSources()) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"@workspace\/db";/gs)) {
      for (const part of match[1].split(",")) {
        const name = part.trim().split(/\s+as\s+/)[0].trim();
        if (!name || name.startsWith("type ")) continue;
        if (!(name in mock)) missing.add(`${name} (${path.relative(srcDir, file)})`);
      }
    }
  }
  assert.deepEqual([...missing], [], "every @workspace/db import must be covered by the shared test mock");
});

test("the shared db mock exposes the instance-routing helpers the server calls", () => {
  const mock = dbMockExports();
  for (const name of ["runWithInstance", "enterInstance", "currentInstance", "hasSecondary", "DEFAULT_TEAM_ID"]) {
    assert.ok(name in mock, `${name} must be in the shared db mock`);
  }
  assert.equal(mock.runWithInstance("secondary", () => "ok"), "ok");
});
