import assert from "node:assert/strict";
import test from "node:test";
import { assistantChatPostAuthorizationFailure } from "./interviewChatAuthorization.ts";

test("rejects assistant chat posts attributed to a different interviewer", () => {
  assert.deepEqual(
    assistantChatPostAuthorizationFailure("AI assistant", "Jordan", "Alex"),
    {
      status: 403,
      error: "Assistant messages must be tied to the signed-in interviewer.",
    },
  );
});

test("accepts the signed-in interviewer label case-insensitively for assistant posts", () => {
  assert.equal(assistantChatPostAuthorizationFailure("AI assistant", " alex ", "Alex"), null);
});

test("does not apply assistant-label validation to interviewer-authored chat posts", () => {
  assert.equal(assistantChatPostAuthorizationFailure("Alex", "Jordan", "Alex"), null);
});