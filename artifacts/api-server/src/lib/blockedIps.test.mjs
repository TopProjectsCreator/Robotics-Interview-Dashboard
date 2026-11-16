import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});

const queries = [];
const pool = {
  async query(statement, values = []) {
    queries.push({ statement, values });
    if (statement.includes('from "team_blocked_ips"')) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  },
};

mock.module("@workspace/db", { namedExports: { pool } });

const { normalizeIp } = await import("./blockedIps.ts");

test("IPv4 addresses are validated and canonicalized", () => {
  assert.equal(normalizeIp("192.168.1.20"), "192.168.1.20");
  assert.equal(normalizeIp("010.0.0.1"), "10.0.0.1");
  assert.equal(normalizeIp(" 8.8.8.8 "), "8.8.8.8");
  assert.equal(normalizeIp("255.255.255.255"), "255.255.255.255");
});

test("IPv4 octet out of range is rejected", () => {
  assert.equal(normalizeIp("256.1.1.1"), null);
  assert.equal(normalizeIp("1.2.3.256"), null);
  assert.equal(normalizeIp("1.2.3"), null);
  assert.equal(normalizeIp("1.2.3.4.5"), null);
});

test("IPv6 addresses are validated and canonicalized to one form", () => {
  assert.equal(normalizeIp("::1"), "::1");
  assert.equal(normalizeIp("0:0:0:0:0:0:0:1"), "::1");
  assert.equal(normalizeIp("0000:0000:0000:0000:0000:0000:0000:0001"), "::1");
  assert.equal(normalizeIp("2001:0db8:0000:0000:0000:ff00:0042:8329"), "2001:db8::ff00:42:8329");
  assert.equal(normalizeIp("2001:DB8::FF00:42:8329"), "2001:db8::ff00:42:8329");
  assert.equal(normalizeIp("fe80::a1b2:c3d4:e5f6:7890"), "fe80::a1b2:c3d4:e5f6:7890");
  assert.equal(normalizeIp("::"), "::");
});

test("the all-zero compression is placed on the longest zero run", () => {
  assert.equal(normalizeIp("1:0:0:0:0:0:0:2"), "1::2");
  assert.equal(normalizeIp("1:0:0:2:0:0:0:3"), "1:0:0:2::3");
});

test("IPv6 with bad groups or too many groups is rejected", () => {
  assert.equal(normalizeIp("1:2:3:4:5:6:7"), null);
  assert.equal(normalizeIp("1:2:3:4:5:6:7:8:9"), null);
  assert.equal(normalizeIp("gggg::1"), null);
  assert.equal(normalizeIp("12345::"), null);
  assert.equal(normalizeIp("1::2::3"), null);
  assert.equal(normalizeIp("1:2::3::4"), null);
});

test("IPv4-mapped IPv6 collapses to plain IPv4", () => {
  assert.equal(normalizeIp("::ffff:192.168.0.1"), "192.168.0.1");
  assert.equal(normalizeIp("::FFFF:192.168.0.1"), "192.168.0.1");
  assert.equal(normalizeIp("::ffff:999.168.0.1"), null);
});

test("bracketed IPv6 (as copied from URLs) is accepted", () => {
  assert.equal(normalizeIp("[::1]"), "::1");
  assert.equal(normalizeIp("[2001:db8::ff00:42:8329]"), "2001:db8::ff00:42:8329");
});

test("non-IP strings are rejected", () => {
  assert.equal(normalizeIp(""), null);
  assert.equal(normalizeIp(undefined), null);
  assert.equal(normalizeIp(null), null);
  assert.equal(normalizeIp(42), null);
  assert.equal(normalizeIp("example.com"), null);
  assert.equal(normalizeIp("10.0.0.1/24"), null);
  assert.equal(normalizeIp("10.0.0.1:8080"), null);
});

test("block lookups always use the caller team's id", async () => {
  const { isLoginIpBlocked } = await import("./blockedIps.ts");
  await isLoginIpBlocked("team-a", "10.0.0.9");
  const lookup = queries.find((entry) => entry.statement.includes('from "team_blocked_ips"'));
  assert.ok(lookup, "expected a lookup against the blocklist");
  assert.match(lookup.statement, /"team_id" = \$1 and "ip" = \$2/);
  assert.deepEqual(lookup.values, ["team-a", "10.0.0.9"]);
});

test.after(() => mock.restoreAll());
