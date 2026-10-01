import assert from "node:assert/strict";
import test from "node:test";
import {
  isChatAttachmentReferenced,
  messageReferencesChatAttachment,
} from "./chatAttachmentReferences.ts";

test("recognizes an attachment path in a chat message", () => {
  assert.equal(
    messageReferencesChatAttachment(
      "See [brief.pdf](/api/storage/objects/upload-12345678)",
      "/objects/upload-12345678",
    ),
    true,
  );
});

test("messages without attachments do not keep an object referenced", () => {
  assert.equal(isChatAttachmentReferenced("/objects/upload-12345678", [
    "A message without an attachment.",
    "Another ordinary message.",
  ]), false);
});

test("a second message referencing the same object keeps it from being deleted", () => {
  assert.equal(isChatAttachmentReferenced("/objects/upload-12345678", [
    "The message that was deleted is no longer in this list.",
    "See [brief.pdf](/api/storage/objects/upload-12345678)",
  ]), true);
});

test("a longer object id with the same prefix is not treated as a reference", () => {
  assert.equal(
    messageReferencesChatAttachment(
      "[other](/api/storage/objects/upload-123456789)",
      "/objects/upload-12345678",
    ),
    false,
  );
});