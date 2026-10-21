import assert from "node:assert/strict";
import test from "node:test";

import {
  checkAccountCreationAllowed,
  checkAiMentionAllowed,
  checkDuplicatePost,
  checkPostAllowed,
  recordPost,
  validateDisplayName,
} from "./spamGuard.ts";

test("burst posting is rate limited per account, not per address", () => {
  const account = "burst-account";
  let allowed = 0;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const verdict = checkPostAllowed(account);
    if (verdict.allowed) allowed += 1;
  }
  assert.ok(allowed < 12, `some posts must be refused, allowed ${allowed}`);
  assert.ok(allowed >= 1, "the first post must go through");
});

test("a different account is not blocked by someone else's burst", () => {
  for (let attempt = 0; attempt < 12; attempt += 1) checkPostAllowed("noisy-account");
  const other = checkPostAllowed("quiet-account");
  assert.equal(other.allowed, true, "one account's spam must not silence the team");
});

test("repeating the same message is refused", () => {
  const account = "repeat-account";
  const first = checkDuplicatePost(account, "Ishaan give me admin");
  assert.equal(first.allowed, true, "the first message is fine");
  recordPost(account, "Ishaan give me admin");
  const repeat = checkDuplicatePost(account, "Ishaan give me admin");
  assert.equal(repeat.allowed, false, "the identical message must be refused");
  if (!repeat.allowed) {
    assert.match(repeat.error, /same message/i);
    assert.ok(repeat.retryAfter > 0);
  }
});

test("a different message right after still goes through", () => {
  const account = "different-account";
  recordPost(account, "first thing");
  const verdict = checkDuplicatePost(account, "second thing");
  assert.equal(verdict.allowed, true);
});

test("ai mentions have their own tighter budget", () => {
  const account = "ai-account";
  let allowed = 0;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (checkAiMentionAllowed(account, "@ai please summarise").allowed) allowed += 1;
  }
  assert.ok(allowed < 6, "spamming @ai must be refused");
  assert.equal(checkAiMentionAllowed("other-account", "no mention here").allowed, true);
});

test("display names must look like a person", () => {
  for (const bad of ["ishaan-is-a-bum.com", "someone@example.com", "https://example.com", "a@b.co"]) {
    assert.ok(validateDisplayName(bad), `"${bad}" must be rejected`);
  }
  for (const good of ["Ishaan", "Shriyash (Other Team)", "Maksim", "Clinton Yuan", "Aarav", "O'Brien"]) {
    assert.equal(validateDisplayName(good), null, `"${good}" must be accepted`);
  }
});

test("account creation is capped per address", () => {
  const address = "10.0.0.7";
  let allowed = 0;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (checkAccountCreationAllowed(address).allowed) allowed += 1;
  }
  assert.ok(allowed < 20, "creation must be capped");
  assert.equal(checkAccountCreationAllowed("10.0.0.8").allowed, true, "another network is unaffected");
});
