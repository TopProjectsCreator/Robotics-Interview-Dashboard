import { describe, expect, it } from "vitest";

import { decodeHeader, scanObjFaces, validatePlyHeader } from "./meshHeader";

/**
 * Exercises the real three.js loaders against the fixtures the chat tests use,
 * so a fixture that only *looks* valid cannot pass unnoticed. The viewers rely on
 * these loaders, and they behave differently on text versus binary input.
 */

const OBJ_FIXTURE = `# unit square
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
vn 0 0 1
f 1//1 2//1 3//1 4//1
`;

/** The loaders need a standalone ArrayBuffer, not a view over one. */
function toBuffer(text: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(text);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

const PLY_ASCII = `ply
format ascii
element vertex 3
property float x
property float y
property float z
element face 1
property list uchar int vertex_indices
end_header
0 0 0
1 0 0
0 1 0
3 0 1 2
`;

/** A binary PLY: header, three float32 vertices, one uint8/uint32 face record. */
function plyBinary(): ArrayBuffer {
  const header = `ply
format binary_little_endian
element vertex 3
property float x
property float y
property float z
element face 1
property list uchar int vertex_indices
end_header
`;
  const headerBytes = new TextEncoder().encode(header);
  const vertexBytes = 3 * 3 * 4;
  const faceBytes = 1 + 4 + 3 * 4;
  const buffer = new ArrayBuffer(headerBytes.length + vertexBytes + faceBytes);
  const bytes = new Uint8Array(buffer);
  bytes.set(headerBytes, 0);
  const view = new DataView(buffer, headerBytes.length);
  const vertices = [0, 0, 0, 1, 0, 0, 0, 1, 0];
  vertices.forEach((value, index) => view.setFloat32(index * 4, value, true));
  let offset = vertexBytes;
  view.setUint8(offset, 3);
  offset += 1;
  [0, 1, 2].forEach((index) => {
    view.setUint32(offset, index, true);
    offset += 4;
  });
  return buffer;
}

describe("OBJ parsing", () => {
  it("produces geometry from the chat fixture", async () => {
    const { OBJLoader } = await import("three/addons/loaders/OBJLoader.js");
    const group = new OBJLoader().parse(OBJ_FIXTURE);

    let meshes = 0;
    group.traverse((child) => {
      const mesh = child as import("three").Mesh;
      if (!mesh.isMesh) return;
      meshes += 1;
      // OBJLoader emits non-indexed geometry, so an n-gon arrives already
      // triangulated into two triangles worth of unique vertices.
      expect(mesh.geometry.getAttribute("position").count).toBe(6);
      expect(mesh.geometry.getAttribute("position").count / 3).toBe(2);
    });
    expect(meshes).toBeGreaterThan(0);
  });

  it("agrees with the pre-parse face scan", () => {
    const scanned = scanObjFaces(OBJ_FIXTURE);
    expect(scanned.ok).toBe(true);
    if (!scanned.ok) return;
    expect(scanned.faceCount).toBe(1);
    expect(scanned.cornerCount).toBe(4);
  });

  it("is refused by the pre-parse scan when there are no faces", () => {
    expect(scanObjFaces(OBJ_FIXTURE.split("\n").slice(0, 5).join("\n")).ok).toBe(false);
  });
});

describe("PLY parsing", () => {
  it("produces geometry from the ASCII chat fixture", async () => {
    const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
    const geometry = new PLYLoader().parse(toBuffer(PLY_ASCII));
    expect(geometry.getAttribute("position").count).toBe(3);
    expect(geometry.getIndex()?.count).toBe(3);
  });

  it("produces geometry from a binary fixture", async () => {
    const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
    const geometry = new PLYLoader().parse(plyBinary());
    expect(geometry.getAttribute("position").count).toBe(3);
    expect(geometry.getIndex()?.count).toBe(3);
  });

  it("turns vertex colours into a geometry colour attribute", async () => {
    const { PLYLoader } = await import("three/addons/loaders/PLYLoader.js");
    const coloured = `ply
format ascii
element vertex 3
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
element face 1
property list uchar int vertex_indices
end_header
0 0 0 255 0 0
1 0 0 0 255 0
0 1 0 0 0 255
3 0 1 2
`;
    const geometry = new PLYLoader().parse(toBuffer(coloured));
    expect(geometry.getAttribute("color")).toBeDefined();
    expect(geometry.getAttribute("position").count).toBe(3);
  });

  it("agrees with the header validation used before parsing", () => {
    const header = decodeHeader(new TextEncoder().encode(PLY_ASCII));
    const validated = validatePlyHeader(header);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    expect(validated.header).toMatchObject({ format: "ascii", vertexCount: 3, faceCount: 1 });
  });

  it("refuses a binary fixture whose header overstates its face count", async () => {
    // PLYLoader would loop the declared count regardless of the body length, so
    // the pre-parse header check is the only thing that catches this.
    const hostile = PLY_ASCII.replace("element face 1", "element face 99999999");
    const header = decodeHeader(new TextEncoder().encode(hostile));
    const validated = validatePlyHeader(header);
    expect(validated.ok).toBe(false);
    expect(validated.ok === false && validated.reason).toMatch(/too many to preview/);
  });
});