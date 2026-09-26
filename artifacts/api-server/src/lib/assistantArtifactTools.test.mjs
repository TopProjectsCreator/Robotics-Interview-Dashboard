import assert from "node:assert/strict";
import test from "node:test";
import { applyWhiteboardOperations } from "./whiteboardAssistantOperations.ts";

test("assistant whiteboard operations add and update Excalidraw text elements", () => {
  const added = applyWhiteboardOperations([], [{
    type: "add_text",
    text: "Interview plan",
    x: 40,
    y: 60,
    fontSize: 24,
  }]);
  assert.equal(added.changed, 1);
  assert.equal(added.elements.length, 1);
  const element = added.elements[0];
  assert.equal(element.type, "text");
  assert.equal(element.text, "Interview plan");
  assert.equal(element.originalText, "Interview plan");
  assert.equal(element.x, 40);
  assert.equal(element.version, 1);
  assert.equal(typeof element.versionNonce, "number");

  const updated = applyWhiteboardOperations(added.elements, [{
    type: "update_text",
    elementId: element.id,
    text: "Revised plan",
  }]);
  assert.equal(updated.elements[0].text, "Revised plan");
  assert.equal(updated.elements[0].version, 2);
});

test("assistant whiteboard operations add shapes, soft-delete, and abort invalid batches", () => {
  const added = applyWhiteboardOperations([], [{
    type: "add_rectangle",
    x: 10,
    y: 20,
    width: 240,
    height: 120,
    backgroundColor: "#ffffff",
  }]);
  const shape = added.elements[0];
  assert.equal(shape.type, "rectangle");
  assert.equal(shape.backgroundColor, "#ffffff");

  const removed = applyWhiteboardOperations(added.elements, [{
    type: "delete_element",
    elementId: shape.id,
  }]);
  assert.equal(removed.elements[0].isDeleted, true);
  assert.equal(removed.elements[0].version, 2);

  const invalidBatch = applyWhiteboardOperations([], [
    { type: "add_text", text: "Would not be saved" },
    { type: "update_text", elementId: "missing", text: "No target" },
  ]);
  assert.equal(invalidBatch.elements, undefined);
  assert.match(invalidBatch.error, /not found/);
});