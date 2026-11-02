import assert from "node:assert/strict";
import test from "node:test";

import { UpdateChatMessageBody } from "../../../../lib/api-zod/src/generated/api.ts";

test("chat message edits accept up to 4,000 characters", () => {
  assert.equal(UpdateChatMessageBody.safeParse({ message: "x".repeat(4000) }).success, true);
  assert.equal(UpdateChatMessageBody.safeParse({ message: "x".repeat(4001) }).success, false);
});
