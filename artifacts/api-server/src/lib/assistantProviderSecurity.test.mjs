import assert from "node:assert/strict";
import { test } from "node:test";
import {
  decryptAssistantProviderCredential,
  encryptAssistantProviderCredential,
  validateCompatibleEndpoint,
} from "./assistantProviderSecurity.ts";

test("team provider credentials are authenticated ciphertext, not recoverable from storage text", () => {
  const previous = process.env.AI_BYOK_ENCRYPTION_KEY;
  process.env.AI_BYOK_ENCRYPTION_KEY = "test-encryption-key-that-is-not-a-real-secret";
  try {
    const key = "provider-key-value";
    const encrypted = encryptAssistantProviderCredential(key);
    assert.match(encrypted, /^v1\./);
    assert.equal(encrypted.includes(key), false);
    assert.equal(decryptAssistantProviderCredential(encrypted), key);
    const tampered = encrypted.split(".");
    tampered[2] = `${tampered[2][0] === "A" ? "B" : "A"}${tampered[2].slice(1)}`;
    assert.throws(() => decryptAssistantProviderCredential(tampered.join(".")), /cannot be decrypted/);
    assert.throws(() => decryptAssistantProviderCredential("plaintext-key"), /cannot be decrypted/);
  } finally {
    if (previous === undefined) delete process.env.AI_BYOK_ENCRYPTION_KEY;
    else process.env.AI_BYOK_ENCRYPTION_KEY = previous;
  }
});

test("custom endpoints reject non-HTTPS, credentials, localhost, and private addresses", async () => {
  await assert.rejects(validateCompatibleEndpoint("http://api.example.test/v1"), /public HTTPS/);
  await assert.rejects(validateCompatibleEndpoint("https://user:pass@example.com/v1"), /embedded credentials/);
  await assert.rejects(validateCompatibleEndpoint("https://localhost/v1"), /public HTTPS/);
  await assert.rejects(validateCompatibleEndpoint("https://192.168.1.10/v1"), /public HTTPS/);
});

