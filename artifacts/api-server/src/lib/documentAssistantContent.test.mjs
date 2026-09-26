import assert from "node:assert/strict";
import test from "node:test";
import * as Y from "yjs";
import {
  applyDocumentAssistantContent,
  documentDocFromEnvelope,
  documentPlainText,
} from "./documentAssistantContent.ts";

test("assistant document content appends structured text to a collaborative Yjs fragment", () => {
  const doc = new Y.Doc();
  applyDocumentAssistantContent(doc, "append", "# Interview plan\n\n- Confirm availability\n- Share next steps");

  assert.equal(
    documentPlainText(doc),
    "# Interview plan\n\n- Confirm availability\n- Share next steps",
  );

  const envelope = JSON.stringify({
    kind: "document",
    yState: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
  });
  const restored = documentDocFromEnvelope(envelope);
  assert.equal(documentPlainText(restored), documentPlainText(doc));
  restored.destroy();
  doc.destroy();
});

test("assistant document replacement replaces prior content and supports an empty document", () => {
  const doc = new Y.Doc();
  applyDocumentAssistantContent(doc, "append", "Old paragraph");
  applyDocumentAssistantContent(doc, "replace", "Revised paragraph");
  assert.equal(documentPlainText(doc), "Revised paragraph");

  applyDocumentAssistantContent(doc, "replace", "");
  assert.equal(documentPlainText(doc), "");
  doc.destroy();
});