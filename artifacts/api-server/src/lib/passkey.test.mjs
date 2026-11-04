import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticationOriginFor,
  expectedOriginsForLogin,
  expectedRpIdsForLogin,
  normalizeOrigin,
  originFromResponse,
  readPasskeyChallenge,
  webauthnRPID,
} from "./passkey.ts";

const ORIGINAL_WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN;

function withConfiguredOrigin(origin, fn) {
  if (origin === undefined) delete process.env.WEBAUTHN_ORIGIN;
  else process.env.WEBAUTHN_ORIGIN = origin;
  try {
    fn();
  } finally {
    if (ORIGINAL_WEBAUTHN_ORIGIN === undefined) delete process.env.WEBAUTHN_ORIGIN;
    else process.env.WEBAUTHN_ORIGIN = ORIGINAL_WEBAUTHN_ORIGIN;
  }
}

function clientDataJSON(origin) {
  return Buffer.from(JSON.stringify({ type: "webauthn.create", challenge: "c", origin }), "utf8").toString("base64url");
}

test("normalizeOrigin keeps only the http(s) origin", () => {
  assert.equal(normalizeOrigin("https://app.example.com/dashboard?x=1"), "https://app.example.com");
  assert.equal(normalizeOrigin("https://app.example.com/"), "https://app.example.com");
  assert.equal(normalizeOrigin("http://localhost:5173/auth"), "http://localhost:5173");
  assert.equal(normalizeOrigin("  https://mirror.example.com/a/b  "), "https://mirror.example.com");
});

test("normalizeOrigin rejects non-http(s) and malformed values", () => {
  for (const value of ["", "   ", null, undefined, "not a url", "//example.com", "javascript:alert(1)", "ftp://example.com", "example.com/path"]) {
    assert.equal(normalizeOrigin(value), null, `expected null for ${String(value)}`);
  }
});

test("originFromResponse reads the authenticator-reported origin", () => {
  assert.equal(originFromResponse({ clientDataJSON: clientDataJSON("https://app.example.com/auth") }), "https://app.example.com");
  assert.equal(originFromResponse({ clientDataJSON: clientDataJSON("https://mirror.example.com/") }), "https://mirror.example.com");
});

test("originFromResponse gives null for malformed responses", () => {
  for (const response of [null, undefined, {}, { clientDataJSON: "" }, { clientDataJSON: "!!!" }, { clientDataJSON: clientDataJSON("ftp://x") }, "str"]) {
    assert.equal(originFromResponse(response), null);
  }
});

test("webauthnRPID is the hostname of an origin", () => {
  assert.equal(webauthnRPID("https://app.example.com"), "app.example.com");
  assert.equal(webauthnRPID("http://localhost:5173"), "localhost");
  assert.equal(webauthnRPID("garbage"), "localhost");
});

test("authenticationOriginFor offers the stored origin when every passkey shares one", () => {
  withConfiguredOrigin(undefined, () => {
    assert.equal(
      authenticationOriginFor({ currentOrigin: "https://mirror.example.com", credentialOrigins: ["https://app.example.com"] }),
      "https://app.example.com",
    );
    assert.equal(
      authenticationOriginFor({ currentOrigin: "https://mirror.example.com", credentialOrigins: ["https://app.example.com", "https://app.example.com/"] }),
      "https://app.example.com",
    );
  });
});

test("authenticationOriginFor falls back to the current origin for legacy or mixed origins", () => {
  withConfiguredOrigin(undefined, () => {
    assert.equal(authenticationOriginFor({ currentOrigin: "https://mirror.example.com", credentialOrigins: [null, undefined] }), "https://mirror.example.com");
    assert.equal(authenticationOriginFor({ currentOrigin: "https://mirror.example.com", credentialOrigins: [] }), "https://mirror.example.com");
    assert.equal(
      authenticationOriginFor({ currentOrigin: "https://mirror.example.com", credentialOrigins: ["https://app.example.com", "https://mirror.example.com"] }),
      "https://mirror.example.com",
    );
  });
});

test("authenticationOriginFor lets the deployment override win", () => {
  withConfiguredOrigin("https://canonical.example.com", () => {
    assert.equal(
      authenticationOriginFor({ currentOrigin: "https://mirror.example.com", credentialOrigins: ["https://app.example.com"] }),
      "https://canonical.example.com",
    );
  });
});

test("expectedOriginsForLogin accepts the mirror origin and the origin the passkey was made on", () => {
  withConfiguredOrigin(undefined, () => {
    assert.deepEqual(
      expectedOriginsForLogin({
        challengeOrigin: "https://mirror.example.com",
        currentOrigin: "https://mirror.example.com",
        storedOrigin: "https://app.example.com",
      }),
      ["https://mirror.example.com", "https://app.example.com"],
    );
  });
});

test("expectedOriginsForLogin still trusts a legacy credential with no stored origin", () => {
  withConfiguredOrigin(undefined, () => {
    assert.deepEqual(
      expectedOriginsForLogin({ challengeOrigin: "https://app.example.com", currentOrigin: "https://app.example.com", storedOrigin: null }),
      ["https://app.example.com"],
    );
    assert.deepEqual(
      expectedOriginsForLogin({ challengeOrigin: "https://mirror.example.com", currentOrigin: "https://mirror.example.com", storedOrigin: null }),
      ["https://mirror.example.com"],
    );
  });
});

test("expectedRpIdsForLogin derives one RP ID per accepted origin", () => {
  withConfiguredOrigin(undefined, () => {
    assert.deepEqual(
      expectedRpIdsForLogin({
        challengeOrigin: "https://mirror.example.com",
        currentOrigin: "https://mirror.example.com",
        storedOrigin: "https://app.example.com",
      }),
      ["mirror.example.com", "app.example.com"],
    );
  });
});

test("expectedOriginsForLogin includes the configured override when one is set", () => {
  withConfiguredOrigin("https://canonical.example.com", () => {
    assert.deepEqual(
      expectedOriginsForLogin({
        challengeOrigin: "https://app.example.com",
        currentOrigin: "https://mirror.example.com",
        storedOrigin: "https://app.example.com",
      }),
      ["https://app.example.com", "https://canonical.example.com", "https://mirror.example.com"],
    );
  });
});

test("readPasskeyChallenge keeps the pinned origin and drops unknown fields", () => {
  const raw = JSON.stringify({
    mode: "register",
    challenge: "c",
    interviewerId: "acct-1",
    origin: "https://app.example.com/auth",
    rpId: "app.example.com",
    evil: "https://evil.example.com",
  });
  const req = { cookies: { passkey_challenge: raw }, get: () => undefined };
  assert.deepEqual(readPasskeyChallenge(req), {
    mode: "register",
    challenge: "c",
    interviewerId: "acct-1",
    origin: "https://app.example.com",
    rpId: "app.example.com",
  });
});

test("readPasskeyChallenge drops a non-url origin from a tampered cookie", () => {
  const raw = JSON.stringify({ mode: "login", challenge: "c", origin: "javascript:alert(1)" });
  const req = { cookies: { passkey_challenge: raw }, get: () => undefined };
  const parsed = readPasskeyChallenge(req);
  assert.equal(parsed.mode, "login");
  assert.equal(parsed.origin, undefined);
});

test("readPasskeyChallenge rejects a bogus challenge", () => {
  for (const raw of ["", "not-json", JSON.stringify({ mode: "login" }), JSON.stringify({ mode: "other", challenge: "c" })]) {
    const req = { cookies: { passkey_challenge: raw }, get: () => undefined };
    assert.equal(readPasskeyChallenge(req), null, `expected null for ${raw}`);
  }
  assert.equal(readPasskeyChallenge({ cookies: {}, get: () => undefined }), null);
});
