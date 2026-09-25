import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import test from "node:test";
import { getPwnedPasswordCount } from "./pwnedPasswords.ts";

function createPasswordHash() {
  const password = randomBytes(32).toString("hex");
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  return { password, sha1, prefix: sha1.slice(0, 5), suffix: sha1.slice(5) };
}

test("uses only the SHA-1 range prefix and matches the suffix locally", async () => {
  const { password, prefix, suffix } = createPasswordHash();
  let requestedUrl = "";
  let requestHeaders;
  const count = await getPwnedPasswordCount(password, async (input, init) => {
    requestedUrl = String(input);
    requestHeaders = new Headers(init?.headers);
    return new Response(`${suffix}:2\r\n`, { status: 200 });
  });

  assert.equal(count, 2);
  assert.equal(new URL(requestedUrl).pathname, `/range/${prefix}`);
  assert.equal(requestedUrl.includes(password), false);
  assert.equal(requestHeaders.get("User-Agent"), "RoboticsInterviewDashboard-PasswordSafety/1.0");
  assert.equal(requestHeaders.get("Add-Padding"), "true");
});

test("returns zero when the local suffix is not in the range response", async () => {
  const { password, suffix } = createPasswordHash();
  const otherSuffix = `${suffix[0] === "0" ? "1" : "0"}${suffix.slice(1)}`;

  const count = await getPwnedPasswordCount(
    password,
    async () => new Response(`${otherSuffix}:8\r\n`, { status: 200 }),
  );

  assert.equal(count, 0);
});

test("fails closed on invalid occurrence counts and upstream errors", async () => {
  const { password, suffix } = createPasswordHash();

  await assert.rejects(
    getPwnedPasswordCount(password, async () => new Response(`${suffix}:\r\n`, { status: 200 })),
    /invalid occurrence count/,
  );
  await assert.rejects(
    getPwnedPasswordCount(password, async () => new Response("unavailable", { status: 503 })),
    /HTTP 503/,
  );
});