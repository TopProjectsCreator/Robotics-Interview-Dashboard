import assert from "node:assert/strict";
import test from "node:test";
import {
  applyWhiteboardOperations,
  buildTextListWhiteboardOperations,
  generatedImageObjectPath,
} from "./whiteboardAssistantOperations.ts";

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

test("creates a text roster layout containing every supplied name", () => {
  const names = ["Ada Lovelace", "Grace Hopper", "Katherine Johnson"];
  const operations = buildTextListWhiteboardOperations("Applicant roster", names);
  const created = applyWhiteboardOperations([], operations);

  assert.equal(created.elements.length, names.length + 1);
  assert.deepEqual(created.elements.slice(1).map((element) => element.text), names);
  assert.equal(created.elements[0].text, "Applicant roster · 3");
});

test("adds a stored generated image with an Excalidraw file reference", () => {
  const dataURL = "data:image/png;base64,aGVsbG8=";
  const created = applyWhiteboardOperations([], [{
    type: "add_image",
    imageDataUrl: dataURL,
    imageMimeType: "image/png",
  }]);

  assert.equal(created.changed, 1);
  const image = created.elements[0];
  assert.equal(image.type, "image");
  assert.equal(image.status, "saved");
  assert.equal(created.files[image.fileId].dataURL, dataURL);
  assert.equal(created.files[image.fileId].mimeType, "image/png");
});

test("only accepts generated-image object paths from the app storage endpoint", () => {
  const id = "fae3fe5e-c323-4ae8-8598-8a1a4be9b283";
  assert.equal(
    generatedImageObjectPath(`/api/storage/objects/generated/${id}`),
    `/objects/generated/${id}`,
  );
  assert.equal(
    generatedImageObjectPath(`https://example.com/api/storage/objects/generated/${id}`),
    null,
  );
  assert.equal(
    generatedImageObjectPath(`/api/storage/objects/uploads/${id}`),
    null,
  );
});