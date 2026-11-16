import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  isValidTinyUrlAlias,
  normalizeTinyUrlAlias,
  normalizeTinyUrlTarget,
  tinyUrlPath,
  TINY_URL_TEAM_LIMIT,
} = await import("./tinyUrls.ts");

test("aliases are stored lowercase and capped at 64 chars", () => {
  assert.equal(normalizeTinyUrlAlias("TryOuts"), "tryouts");
  assert.equal(normalizeTinyUrlAlias("  code-day  "), "code-day");
  assert.equal(normalizeTinyUrlAlias("a"), "a");
  assert.equal(normalizeTinyUrlAlias("x".repeat(64)), "x".repeat(64));
  assert.equal(normalizeTinyUrlAlias("x".repeat(65)), null);
});

test("aliases must start with a letter or number and use only [a-z0-9_-]", () => {
  assert.equal(normalizeTinyUrlAlias("1st-try"), "1st-try");
  assert.equal(normalizeTinyUrlAlias("try_outs-2026"), "try_outs-2026");
  assert.equal(normalizeTinyUrlAlias("-tryouts"), null);
  assert.equal(normalizeTinyUrlAlias("_tryouts"), null);
  assert.equal(normalizeTinyUrlAlias("try outs"), null);
  assert.equal(normalizeTinyUrlAlias("try/outs"), null);
  assert.equal(normalizeTinyUrlAlias("try.outs"), null);
  assert.equal(normalizeTinyUrlAlias("tryou?ts"), null);
  assert.equal(normalizeTinyUrlAlias(""), null);
});

test("pasted short links are reduced to their alias", () => {
  assert.equal(normalizeTinyUrlAlias("/t/tryouts"), "tryouts");
  assert.equal(normalizeTinyUrlAlias("t/tryouts"), "tryouts");
  assert.equal(normalizeTinyUrlAlias("https://team.example.com/t/tryouts"), "tryouts");
  assert.equal(normalizeTinyUrlAlias("http://team.example.com/t/tryouts/"), "tryouts");
  assert.equal(normalizeTinyUrlAlias("https://team.example.com/t/TryOuts"), "tryouts");
  // A path past the alias is not an alias, not a link to our namespace.
  assert.equal(normalizeTinyUrlAlias("https://team.example.com/t/tryouts/extra/path"), null);
  assert.equal(normalizeTinyUrlAlias("https://evil.example.com/not-t/tryouts"), null);
});

test("isValidTinyUrlAlias enforces the stored form only", () => {
  assert.equal(isValidTinyUrlAlias("tryouts"), true);
  assert.equal(isValidTinyUrlAlias("a"), true);
  assert.equal(isValidTinyUrlAlias("TryOuts"), false);
  assert.equal(isValidTinyUrlAlias("-tryouts"), false);
  assert.equal(isValidTinyUrlAlias(""), false);
  assert.equal(isValidTinyUrlAlias("x".repeat(65)), false);
});

test("targets must be absolute http(s) URLs without userinfo", () => {
  assert.equal(normalizeTinyUrlTarget("https://team.example.com/signup"), "https://team.example.com/signup");
  assert.equal(normalizeTinyUrlTarget("http://192.168.1.20:8080/tryouts"), "http://192.168.1.20:8080/tryouts");
  assert.equal(normalizeTinyUrlTarget("HTTPS://TEAM.EXAMPLE.COM/PATH"), "https://team.example.com/PATH");
  assert.equal(normalizeTinyUrlTarget("javascript:alert(1)"), null);
  assert.equal(normalizeTinyUrlTarget("data:text/html,<h1>hi</h1>"), null);
  assert.equal(normalizeTinyUrlTarget("file:///etc/passwd"), null);
  assert.equal(normalizeTinyUrlTarget("ftp://files.example.com/x"), null);
  assert.equal(normalizeTinyUrlTarget("https://user:pass@team.example.com/"), null);
  assert.equal(normalizeTinyUrlTarget(""), null);
  assert.equal(normalizeTinyUrlTarget(`https://team.example.com/${"a".repeat(2060)}`), null);
});

test("bare domains are upgraded to https", () => {
  assert.equal(normalizeTinyUrlTarget("team.example.com/signup"), "https://team.example.com/signup");
  assert.equal(normalizeTinyUrlTarget("team.example.com"), "https://team.example.com/");
  assert.equal(normalizeTinyUrlTarget("example.com/a?b=c&d=e#frag"), "https://example.com/a?b=c&d=e#frag");
  assert.equal(normalizeTinyUrlTarget("localhost:3000/console"), "https://localhost:3000/console");
});

test("tinyUrlPath builds the /t/ redirect path", () => {
  assert.equal(tinyUrlPath("tryouts"), "/t/tryouts");
});

test("team limit stays a sane positive bound", () => {
  assert.ok(Number.isInteger(TINY_URL_TEAM_LIMIT) && TINY_URL_TEAM_LIMIT > 0 && TINY_URL_TEAM_LIMIT <= 1000);
});
