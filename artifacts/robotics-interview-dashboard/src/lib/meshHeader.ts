/**
 * Structural checks for the plain mesh formats (OBJ and PLY) before three.js
 * gets the bytes.
 *
 * These matter because both loaders trust the file: `OBJLoader` counts face
 * tokens, and `PLYLoader`'s binary path loops `element face N` times with no
 * bounds checking beyond a DataView throw. A file declaring millions of faces
 * therefore spins the tab instead of erroring, so the declared counts have to be
 * checked first.
 *
 * Everything here is pure so the rules can be unit tested without a canvas.
 */

/** Matches the other inline viewers, which cap preview geometry. */
export const MESH_PREVIEW_MAX_TRIANGLES = 3_000_000;
/** Guard on the header text we will scan, so a huge file is not read into memory. */
const MAX_HEADER_SCAN_BYTES = 256 * 1024;

export type PlyFormat = "ascii" | "binary_little_endian" | "binary_big_endian";

export type PlyHeader = {
  format: PlyFormat;
  vertexCount: number;
  faceCount: number;
  /** True when the file declares colours, which PLYLoader turns into geometry colours. */
  hasVertexColors: boolean;
};

export type PlyHeaderResult =
  | { ok: true; header: PlyHeader }
  | { ok: false; reason: string };

const PLY_MAGIC = /^ply\s*(\r\n|\r|\n)/;
const PLY_END_HEADER = /end_header(\r\n|\r|\n)/;
const PLY_FORMATS = new Set<PlyFormat>([
  "ascii",
  "binary_little_endian",
  "binary_big_endian",
]);

/**
 * Reads the PLY header, which is always ASCII regardless of the body format, and
 * reports the declared element counts.
 */
export function parsePlyHeader(text: string): PlyHeaderResult {
  if (!PLY_MAGIC.test(text)) {
    return { ok: false, reason: "This file does not start with the PLY header." };
  }
  const end = PLY_END_HEADER.exec(text);
  if (!end) {
    return { ok: false, reason: "This PLY file has no end_header line." };
  }
  const headerText = text.slice(0, end.index);
  const lines = headerText.split(/\r\n|\r|\n/);

  const formatLine = lines.find((line) => line.startsWith("format "));
  const format = formatLine?.slice("format ".length).trim() as PlyFormat | undefined;
  if (!format || !PLY_FORMATS.has(format)) {
    return { ok: false, reason: "This PLY file declares an unsupported format." };
  }

  let vertexCount = 0;
  let faceCount = 0;
  for (const line of lines) {
    const match = /^element\s+(\S+)\s+(\d+)\s*$/.exec(line);
    if (!match) continue;
    const count = Number(match[2]);
    if (!Number.isSafeInteger(count) || count < 0) {
      return { ok: false, reason: "This PLY file declares an unreadable element size." };
    }
    if (match[1] === "vertex") vertexCount = count;
    if (match[1] === "face") faceCount = count;
  }

  return {
    ok: true,
    header: {
      format,
      vertexCount,
      faceCount,
      hasVertexColors: /^property\s+\S+\s+\S*\s*(red|r)\s*$/m.test(headerText),
    },
  };
}

/**
 * Rejects a PLY whose declared geometry is too large to preview before the
 * loader allocates for it.
 */
export function validatePlyHeader(text: string): PlyHeaderResult {
  const parsed = parsePlyHeader(text);
  if (!parsed.ok) return parsed;
  const { vertexCount, faceCount } = parsed.header;
  // PLYLoader keeps only triangles, so the declared face count is the triangle
  // count. A file with faces but no vertices cannot be rendered at all.
  if (faceCount === 0 || vertexCount === 0) {
    return { ok: false, reason: "No renderable geometry was found in this PLY file." };
  }
  if (faceCount > MESH_PREVIEW_MAX_TRIANGLES) {
    return {
      ok: false,
      reason: `This model has ${Math.round(faceCount / 1000)}k triangles, too many to preview in the browser. Download the file instead.`,
    };
  }
  return parsed;
}

export type ObjScanResult =
  | { ok: true; faceCount: number; cornerCount: number }
  | { ok: false; reason: string };

/**
 * Counts OBJ faces and their total corner references.
 *
 * Corner count is used rather than face count because OBJ permits n-gons: the
 * triangle count of an n-gon fan is corners - 2, so bounding corners bounds
 * triangles without trusting the file's topology.
 *
 * Unlike PLY, OBJLoader loops over the text rather than a declared count, so it
 * cannot hang. That makes this an early-rejection aid rather than the only
 * defence, and it is worth scanning the whole file: truncating the scan would
 * undercount a large file and silently never trip the budget.
 */
export function scanObjFaces(text: string): ObjScanResult {
  let faceCount = 0;
  let cornerCount = 0;
  let sawVertex = false;

  for (const line of text.split("\n")) {
    if (line.startsWith("v ") || line.startsWith("v\t")) sawVertex = true;
    if (line.startsWith("f ") || line.startsWith("f\t")) {
      faceCount += 1;
      cornerCount += line.trim().split(/\s+/).length - 1;
      if (cornerCount > MESH_PREVIEW_MAX_TRIANGLES) {
        return {
          ok: false,
          reason: `This model has more than ${Math.round(MESH_PREVIEW_MAX_TRIANGLES / 1000)}k triangles, too many to preview in the browser. Download the file instead.`,
        };
      }
    }
  }

  if (faceCount === 0 || !sawVertex) {
    return { ok: false, reason: "No renderable geometry was found in this OBJ file." };
  }
  return { ok: true, faceCount, cornerCount };
}

/** Reads the leading slice of a byte array as text, for header-only inspection. */
export function decodeHeader(bytes: Uint8Array): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, MAX_HEADER_SCAN_BYTES));
  return new TextDecoder("utf-8", { fatal: false }).decode(slice);
}