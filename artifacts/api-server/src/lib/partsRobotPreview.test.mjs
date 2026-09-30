import assert from "node:assert/strict";
import test from "node:test";
import {
  partsPreviewKind,
  partsPreviewMaxBytes,
  validatePartsPreviewFile,
} from "./partsRobotPreview.ts";

test("accepts supported image and CAD extension/content-type pairs", () => {
  for (const [name, type, expectedKind] of [
    ["robot.jpg", "image/jpeg", "image"],
    ["robot.png", "image/png", "image"],
    ["robot.webp", "image/webp", "image"],
    ["robot.gif", "image/gif", "image"],
    ["robot.glb", "model/gltf-binary", "glb"],
    ["robot.stl", "model/stl", "stl"],
    ["robot.x_t", "model/x-parasolid", "parasolid"],
    ["robot.x_b", "model/x-parasolid", "parasolid"],
  ]) {
    assert.equal(partsPreviewKind(name, type), expectedKind);
  }
});

test("enforces content types, safe file names, signatures, and per-format size limits", () => {
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(validatePartsPreviewFile("robot.png", "image/png", pngHeader), null);
  assert.match(
    validatePartsPreviewFile("robot.png", "image/png", Buffer.from("not a png")),
    /contents do not match/,
  );
  assert.match(
    validatePartsPreviewFile("robot.png", "image/jpeg", pngHeader),
    /Choose a JPEG/,
  );
  assert.match(
    validatePartsPreviewFile("../robot.png", "image/png", pngHeader),
    /file name/,
  );
  assert.equal(partsPreviewMaxBytes("robot.png", "image/png"), 25 * 1024 * 1024);
});

test("validates GLB headers, STL content, and Parasolid text uploads", () => {
  const glb = Buffer.alloc(28);
  glb.write("glTF", 0, "ascii");
  glb.writeUInt32LE(2, 4);
  glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(8, 12);
  glb.writeUInt32LE(0x4e4f534a, 16);
  glb.write("{}", 20, "ascii");
  assert.equal(validatePartsPreviewFile("model.glb", "model/gltf-binary", glb), null);
  assert.match(
    validatePartsPreviewFile("model.glb", "model/gltf-binary", Buffer.from("bad")),
    /valid GLB/,
  );

  const stl = Buffer.from("solid model\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid model\n");
  assert.equal(validatePartsPreviewFile("model.stl", "model/stl", stl), null);
  assert.match(
    validatePartsPreviewFile("model.stl", "model/stl", Buffer.from("not stl")),
    /valid STL/,
  );

  assert.equal(validatePartsPreviewFile("model.x_t", "model/x-parasolid", Buffer.from("**ABCDEFGHIJKLMNOPQRSTUVWXYZ")), null);
  assert.match(
    validatePartsPreviewFile("model.x_t", "model/x-parasolid", Buffer.from([0, 1, 2, 3])),
    /Parasolid text model/,
  );
});