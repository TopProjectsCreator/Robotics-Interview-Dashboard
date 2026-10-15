import { unzipSync, strFromU8 } from "fflate";

/**
 * A 3MF file is a ZIP archive of XML parts, so rendering it needs no CAD
 * kernel: unzip the archive, read the model part, and build a triangle soup.
 * This module is pure so it can be tested without a DOM or a WebGL context.
 */

export type ThreeMfMesh = {
  /** Interleaved-free xyz triples, already in world space. */
  positions: Float32Array;
  /** Triangle corner indices into `positions`. */
  indices: Uint32Array;
  /** Per-corner RGBA bytes, when the source file carried colours. */
  colors?: Uint8Array;
};

export type ThreeMfModel = {
  meshes: ThreeMfMesh[];
  triangleCount: number;
  /** The archive's declared unit, normalised to millimetres. */
  unitScaleToMillimetres: number;
  /** Object names, kept for provenance in the UI. */
  names: string[];
};

/**
 * A 3MF model can nest arbitrarily deep through component transforms. Cap the
 * depth so a cyclic or malicious file cannot spin forever or blow the stack.
 */
const MAX_COMPONENT_DEPTH = 32;
/** Guards against exponential component reuse ("fractal" assemblies). */
const MAX_INSTANCES = 50_000;
/** Enough for previews; matches the triangle budget the other viewers use. */
const MAX_TRIANGLES = 3_000_000;

const UNIT_TO_MM: Record<string, number> = {
  micron: 0.001,
  millimeter: 1,
  centimeter: 10,
  inch: 25.4,
  foot: 304.8,
  meter: 1000,
};

/** Column-major 4x4 as 3MF serialises transforms. */
type Matrix4 = Float64Array;

function identityMatrix(): Matrix4 {
  return new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}

function multiplyMatrices(a: Matrix4, b: Matrix4): Matrix4 {
  const out = new Float64Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0;
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[column * 4 + k];
      out[column * 4 + row] = sum;
    }
  }
  return out;
}

/**
 * Decodes a 3MF transform: nine row-major rotation values followed by a
 * translation, which is packed into a column-major 4x4 so composition and point
 * transforms share one representation. The translation therefore moves from the
 * 3MF tail (indices 9-11) into the matrix's last column (indices 12-14).
 */
function parseTransform(value: string | null): Matrix4 {
  if (!value) return identityMatrix();
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length !== 12 || parts.some((entry) => !Number.isFinite(entry))) {
    return identityMatrix();
  }
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22, tx, ty, tz] = parts;
  return new Float64Array([
    m00, m10, m20, 0,
    m01, m11, m21, 0,
    m02, m12, m22, 0,
    tx, ty, tz, 1,
  ]);
}

function applyMatrix(point: [number, number, number], m: Matrix4): [number, number, number] {
  const [x, y, z] = point;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

/**
 * Converts per-triangle colours from 3MF's #RRGGBB or #RRGGBBAA strings into a
 * flat RGBA byte array matching the vertex count.
 */
function parseColors(triangles: Element[], colors: Element[] | null): Uint8Array | null {
  if (triangles.length === 0) return null;
  const rgba = new Uint8Array(triangles.length * 3 * 4);
  let written = 0;
  for (let i = 0; i < triangles.length; i += 1) {
    const display = triangles[i].getAttribute("color");
    const source = display ?? colors?.[i]?.getAttribute("color") ?? null;
    const match = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(source ?? "");
    if (!match) {
      written += 12;
      continue;
    }
    const [r, g, b, a] = [
      parseInt(match[1].slice(0, 2), 16),
      parseInt(match[1].slice(2, 4), 16),
      parseInt(match[1].slice(4, 6), 16),
      match[2] === undefined ? 255 : parseInt(match[2], 16),
    ];
    for (let corner = 0; corner < 3; corner += 1) {
      rgba[written] = r;
      rgba[written + 1] = g;
      rgba[written + 2] = b;
      rgba[written + 3] = a;
      written += 4;
    }
  }
  return rgba;
}

/**
 * Reads one `<object>` into world-space geometry. Objects are either a mesh, a
 * tree of components referencing other objects, or both.
 */
function readObject(
  objectElement: Element,
  objectsById: Map<string, Element>,
  transform: Matrix4,
  out: ThreeMfMesh[],
  budget: { triangles: number; instances: number },
  depth: number,
): void {
  if (depth > MAX_COMPONENT_DEPTH || budget.instances > MAX_INSTANCES) return;
  budget.instances += 1;

  const directMesh = Array.from(objectElement.children).find(
    (child) => child.localName === "mesh",
  ) as Element | undefined;

  if (directMesh) {
    const vertices = Array.from(directMesh.getElementsByTagName("vertex"));
    const triangleElements = Array.from(directMesh.getElementsByTagName("triangle"));
    if (vertices.length > 0 && triangleElements.length > 0) {
      const positions = new Float32Array(vertices.length * 3);
      for (let i = 0; i < vertices.length; i += 1) {
        const vertex = vertices[i];
        const x = Number(vertex.getAttribute("x"));
        const y = Number(vertex.getAttribute("y"));
        const z = Number(vertex.getAttribute("z"));
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
        const world = applyMatrix([x, y, z], transform);
        positions[i * 3] = world[0];
        positions[i * 3 + 1] = world[1];
        positions[i * 3 + 2] = world[2];
      }
      const indices = new Uint32Array(triangleElements.length * 3);
      for (let i = 0; i < triangleElements.length; i += 1) {
        const triangle = triangleElements[i];
        const v1 = Number(triangle.getAttribute("v1"));
        const v2 = Number(triangle.getAttribute("v2"));
        const v3 = Number(triangle.getAttribute("v3"));
        indices[i * 3] = Number.isFinite(v1) ? v1 : 0;
        indices[i * 3 + 1] = Number.isFinite(v2) ? v2 : 0;
        indices[i * 3 + 2] = Number.isFinite(v3) ? v3 : 0;
      }
      const colorElements = Array.from(directMesh.getElementsByTagName("color"));
      const colors = parseColors(triangleElements, colorElements);
      out.push(
        colors
          ? { positions, indices, colors }
          : { positions, indices },
      );
      budget.triangles += triangleElements.length;
    }
  }

  const components = Array.from(objectElement.children).find(
    (child) => child.localName === "components",
  );
  if (!components) return;

  for (const component of Array.from(components.children)) {
    if (component.localName !== "component") continue;
    const objectId = component.getAttribute("objectid");
    if (!objectId) continue;
    const referenced = objectsById.get(objectId);
    if (!referenced) continue;
    const childTransform = multiplyMatrices(
      transform,
      parseTransform(component.getAttribute("transform")),
    );
    readObject(referenced, objectsById, childTransform, out, budget, depth + 1);
  }
}

/** Reads the root `<model>` element of a 3MF part. */
export function parseThreeMfModelXml(xml: string, fileName = "model.3mf"): ThreeMfModel {
  const parser = new DOMParser();
  const document_ = parser.parseFromString(xml, "application/xml");
  const parseError = document_.getElementsByTagName("parsererror")[0];
  if (parseError) {
    throw new Error("This 3MF file contains malformed model data.");
  }
  const model = document_.getElementsByTagName("model")[0];
  if (!model) {
    throw new Error("This 3MF file has no model definition.");
  }

  const objectsById = new Map<string, Element>();
  for (const objectElement of Array.from(model.getElementsByTagName("object"))) {
    const id = objectElement.getAttribute("id");
    if (id && !objectsById.has(id)) objectsById.set(id, objectElement);
  }

  const unit = (model.getAttribute("unit") ?? "millimeter").toLowerCase();
  const unitScaleToMillimetres = UNIT_TO_MM[unit] ?? 1;

  const build = model.getElementsByTagName("build")[0];
  const items = build
    ? Array.from(build.children).filter((child) => child.localName === "item")
    : [];

  const meshes: ThreeMfMesh[] = [];
  const names: string[] = [];
  const budget = { triangles: 0, instances: 0 };

  if (items.length > 0) {
    // A build item selects the objects actually printed, each with its own
    // transform, so the whole model is placed through the same code path.
    for (const item of items) {
      const objectId = item.getAttribute("objectid");
      if (!objectId) continue;
      const objectElement = objectsById.get(objectId);
      if (!objectElement) continue;
      if (budget.triangles >= MAX_TRIANGLES) break;
      const transform = multiplyMatrices(
        identityMatrix(),
        parseTransform(item.getAttribute("transform")),
      );
      readObject(objectElement, objectsById, transform, meshes, budget, 0);
      const name = objectElement.getAttribute("name");
      if (name) names.push(name);
    }
  } else {
    // Some exporters omit <build>; fall back to every root object so the model
    // still shows up rather than appearing empty.
    for (const objectElement of objectsById.values()) {
      if (budget.triangles >= MAX_TRIANGLES) break;
      readObject(objectElement, objectsById, identityMatrix(), meshes, budget, 0);
      const name = objectElement.getAttribute("name");
      if (name) names.push(name);
    }
  }

  // Drop degenerate output: a 3MF with no usable triangles is not renderable.
  const usable = meshes.filter(
    (mesh) => mesh.indices.length >= 3 && mesh.positions.length >= 9,
  );
  if (usable.length === 0) {
    throw new Error("No renderable geometry was found in this 3MF file.");
  }

  return {
    meshes: usable,
    triangleCount: usable.reduce((total, mesh) => total + mesh.indices.length / 3, 0),
    unitScaleToMillimetres,
    names,
  };
}

/**
 * Unzips a 3MF archive and parses its model part. Only the parts needed for
 * geometry are inflated; thumbnails and colour textures are ignored, so a large
 * textured print does not pay to decompress its images.
 */
export function parseThreeMf(bytes: Uint8Array): ThreeMfModel {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch {
    throw new Error("This file could not be opened as a 3MF archive.");
  }
  const modelPath = Object.keys(entries).find((name) =>
    /(^|\/)3d\/[^/]*\.model$/i.test(name),
  );
  if (!modelPath) {
    throw new Error("This 3MF archive has no model file.");
  }
  const xml = strFromU8(entries[modelPath]);
  return parseThreeMfModelXml(xml, modelPath);
}

export const THREE_MF_MAX_TRIANGLES = MAX_TRIANGLES;
export const THREE_MF_UNIT = "3MF";
