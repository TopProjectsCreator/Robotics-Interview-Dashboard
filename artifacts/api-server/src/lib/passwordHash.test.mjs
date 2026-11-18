import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try { return nextResolve(specifier, context); }
    catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});
const { hashPassword, passwordHashMatches } = await import("./passwordHash.ts");

test("async password derivation preserves old hashes, random salts, work factors and exact passwords", async () => {
  const password = "MiXeD case password \u{1f916} ";
  const salt = randomBytes(16);
  const oldHash = `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
  assert.equal(await passwordHashMatches(password, oldHash), true);
  assert.equal(await passwordHashMatches(password.toLowerCase(), oldHash), false);
  assert.equal(await passwordHashMatches(password.trim(), oldHash), false);
  const [first, second] = await Promise.all([hashPassword(password), hashPassword(password)]);
  assert.notEqual(first, second);
  for (const encoded of [first, second]) {
    assert.match(encoded, /^[a-f0-9]{32}:[a-f0-9]{128}$/);
    const [saltHex, hashHex] = encoded.split(":");
    assert.equal(scryptSync(password, Buffer.from(saltHex, "hex"), 64).toString("hex"), hashHex);
    assert.equal(await passwordHashMatches(password, encoded), true);
  }
  for (const invalid of [null, "", "broken", ":empty", "aa:bb"]) {
    assert.equal(await passwordHashMatches(password, invalid), false);
  }
});
