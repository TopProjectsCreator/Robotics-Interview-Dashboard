import assert from "node:assert/strict";
import test from "node:test";
import { decodeChatNotificationCursor, encodeChatNotificationCursor } from "./chatNotificationCursor.ts";

test("chat notification cursors preserve timestamp precision and message identity", () => {
  const cursor = {
    createdAt: "2026-10-30T12:34:56.123456Z",
    id: "message-id",
  };

  assert.deepEqual(decodeChatNotificationCursor(encodeChatNotificationCursor(cursor.createdAt, cursor.id)), cursor);
});

test("chat notification cursor parser rejects malformed values", () => {
  assert.equal(decodeChatNotificationCursor("not-a-cursor"), null);
  assert.equal(decodeChatNotificationCursor(Buffer.from(JSON.stringify({
    createdAt: "not-a-time",
    id: "message-id",
  })).toString("base64url")), null);
  assert.equal(decodeChatNotificationCursor(Buffer.from(JSON.stringify({
    createdAt: "2026-10-30T12:34:56.123456Z",
    id: null,
  })).toString("base64url")), null);
});
