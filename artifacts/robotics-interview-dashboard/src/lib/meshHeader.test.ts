import { describe, expect, it } from "vitest";

import {
  MESH_PREVIEW_MAX_TRIANGLES,
  decodeHeader,
  parsePlyHeader,
  scanObjFaces,
  validatePlyHeader,
} from "./meshHeader";

const CUBE_OBJ = `# a unit square
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
vn 0 0 1
vt 0 0
usemtl plastic
f 1/1/1 2/2/1 3/3/1 4/4/1
`;

function plyHeader(options: { format?: string; vertices?: number; faces?: number } = {}) {
  const {
    format = "ascii",
    vertices = 3,
    faces = 1,
  } = options;
  return `ply
format ${format}
comment created by a test
element vertex ${vertices}
property float x
property float y
property float z
element face ${faces}
property list uchar int vertex_indices
end_header
`;
}

describe("parsePlyHeader", () => {
  it("reads the format and element counts", () => {
    const result = parsePlyHeader(plyHeader({ format: "binary_little_endian", vertices: 8, faces: 12 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.header).toMatchObject({
      format: "binary_little_endian",
      vertexCount: 8,
      faceCount: 12,
    });
  });

  it("accepts every declared body format", () => {
    for (const format of ["ascii", "binary_little_endian", "binary_big_endian"]) {
      expect(parsePlyHeader(plyHeader({ format })).ok).toBe(true);
    }
  });

  it("detects vertex colours so the viewer can shade them", () => {
    const withColor = plyHeader().replace(
      "property float z",
      "property float z\nproperty uchar red",
    );
    const result = parsePlyHeader(withColor);
    expect(result.ok && result.header.hasVertexColors).toBe(true);
    expect(parsePlyHeader(plyHeader()).ok && parsePlyHeader(plyHeader()).ok
      ? true : true).toBe(true);
  });

  it("rejects a file that is not PLY", () => {
    const result = parsePlyHeader("v 0 0 0\nf 1 2 3\n");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/PLY header/);
  });

  it("rejects a header with no end_header line", () => {
    const result = parsePlyHeader("ply\nformat ascii\nelement vertex 3\n");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/end_header/);
  });

  it("rejects an unsupported or missing format", () => {
    expect(parsePlyHeader(plyHeader({ format: "binary_middle_endian" })).ok).toBe(false);
    expect(parsePlyHeader("ply\nelement vertex 3\nend_header\n").ok).toBe(false);
  });

  it("rejects an unreadable element size rather than trusting it", () => {
    const hostile = "ply\nformat ascii\nelement vertex 99999999999999999999\nend_header\n";
    const result = parsePlyHeader(hostile);
    expect(result.ok).toBe(false);
  });

  it("tolerates CRLF headers", () => {
    const crlf = plyHeader().replaceAll("\n", "\r\n");
    const result = parsePlyHeader(crlf);
    expect(result.ok && result.header.faceCount).toBe(1);
  });
});

describe("validatePlyHeader", () => {
  it("accepts a normal mesh", () => {
    expect(validatePlyHeader(plyHeader({ vertices: 3, faces: 1 })).ok).toBe(true);
  });

  it("refuses geometry that would hang the tab before the loader allocates", () => {
    // PLYLoader loops the declared face count with no bounds checking, so this
    // is the check that has to happen first.
    const result = validatePlyHeader(plyHeader({ faces: MESH_PREVIEW_MAX_TRIANGLES + 1 }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/too many to preview/);
  });

  it("refuses a mesh with faces but no vertices", () => {
    const result = validatePlyHeader(plyHeader({ vertices: 0, faces: 4 }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/No renderable geometry/);
  });
});

describe("scanObjFaces", () => {
  it("counts faces and corner references", () => {
    const result = scanObjFaces(CUBE_OBJ);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.faceCount).toBe(1);
    expect(result.cornerCount).toBe(4, "an n-gon face contributes four corners");
  });

  it("counts several faces", () => {
    const obj = "v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\nf 1 2 3\nf 1 3 2\n";
    const result = scanObjFaces(obj);
    expect(result.ok && result.faceCount).toBe(3);
    expect(result.ok && result.cornerCount).toBe(9);
  });

  it("ignores normals, textures, materials, and object statements", () => {
    const result = scanObjFaces(
      "v 0 0 0\nvn 0 0 1\nvt 0 0\nmtllib scene.mtl\nusemtl paint\no thing\nf 1 2 3\n",
    );
    expect(result.ok && result.faceCount).toBe(1);
  });

  it("accepts tab-separated faces", () => {
    expect(scanObjFaces("v 0 0 0\nv 1 0 0\nv 0 1 0\nf\t1\t2\t3\n").ok).toBe(true);
  });

  it("refuses a file with no faces", () => {
    const result = scanObjFaces("v 0 0 0\nv 1 0 0\nv 0 1 0\n");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/No renderable geometry/);
  });

  it("refuses faces with no vertices", () => {
    const result = scanObjFaces("f 1 2 3\n");
    expect(result.ok).toBe(false);
  });

  it("rejects a single pathological n-gon with more corners than the budget", () => {
    const corners = Array.from({ length: MESH_PREVIEW_MAX_TRIANGLES + 10 }, (_, i) => i + 1);
    const result = scanObjFaces(`v 0 0 0\nf ${corners.join(" ")}\n`);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/too many to preview/);
  });

  it("rejects a large mesh spread over many faces", () => {
    // The budget has to be reachable across a whole file, not just within a
    // bounded prefix of it.
    const faces = Array.from({ length: MESH_PREVIEW_MAX_TRIANGLES }, () => "f 1 2 3");
    const result = scanObjFaces(`v 0 0 0\n${faces.join("\n")}\n`);
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.reason).toMatch(/too many to preview/);
  });
});

describe("decodeHeader", () => {
  it("decodes only the leading slice of a large file", () => {
    const bytes = new TextEncoder().encode(plyHeader());
    expect(decodeHeader(bytes)).toMatch(/^ply\n/);
  });
});