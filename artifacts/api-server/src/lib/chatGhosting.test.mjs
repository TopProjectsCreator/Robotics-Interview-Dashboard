import assert from "node:assert/strict";
import test from "node:test";
import { chatGhostState, resolveChatGhostTransition } from "./chatGhosting.ts";

test("a persisted ghosted tombstone is recognized as an already-completed action", () => {
  assert.equal(chatGhostState({
    deletedAt: new Date("2026-09-30T12:05:00.000Z"),
    ghostedAt: new Date("2026-09-30T12:06:00.000Z"),
  }), "already-ghosted");
});

test("only deleted, unghosted messages need a first ghost transition", () => {
  assert.equal(chatGhostState({
    deletedAt: new Date("2026-09-30T12:05:00.000Z"),
    ghostedAt: null,
  }), "needs-ghost");
});

test("missing and non-deleted messages remain distinguishable from completed ghosting", () => {
  assert.equal(chatGhostState(undefined), "missing");
  assert.equal(chatGhostState({
    deletedAt: null,
    ghostedAt: null,
  }), "not-deleted");
});

test("a lost concurrent transition is successful only after reading ghosted state", async () => {
  let persistedReadCount = 0;
  const outcome = await resolveChatGhostTransition(
    async () => false,
    async () => {
      persistedReadCount += 1;
      return {
        deletedAt: new Date("2026-09-30T12:05:00.000Z"),
        ghostedAt: new Date("2026-09-30T12:06:00.000Z"),
      };
    },
  );

  assert.equal(outcome, "already-ghosted");
  assert.equal(persistedReadCount, 1);
});

test("a successful first transition does not re-read state or repeat cleanup", async () => {
  let persistedReadCount = 0;
  const outcome = await resolveChatGhostTransition(
    async () => true,
    async () => {
      persistedReadCount += 1;
      return null;
    },
  );

  assert.equal(outcome, "transitioned");
  assert.equal(persistedReadCount, 0);
});
