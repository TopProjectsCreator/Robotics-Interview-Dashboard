const MIB = 1024 * 1024;

/**
 * CAD file kinds the CAD workspace accepts. Everything here can be rendered
 * inline in the browser, either directly (GLB/STL/3MF) or through the OpenCascade
 * WASM reader (STEP/IGES/BREP), or via the server-side Parasolid converter.
 */
export type CadModelKind =
  | "glb"
  | "stl"
  | "obj"
  | "ply"
  | "three-mf"
  | "parasolid"
  | "step"
  | "iges"
  | "brep";

const EXTENSION_KINDS: Record<string, CadModelKind> = {
  glb: "glb",
  stl: "stl",
  obj: "obj",
  ply: "ply",
  "3mf": "three-mf",
  x_t: "parasolid",
  x_b: "parasolid",
  step: "step",
  stp: "step",
  iges: "iges",
  igs: "iges",
  brep: "brep",
  brp: "brep",
};

/**
 * Browsers report wildly different types for these files (often
 * `application/octet-stream` or an empty string from a drag-and-drop), so the
 * extension is authoritative and the content type only has to be *compatible*.
 */
const KIND_CONTENT_TYPES: Record<CadModelKind, string[]> = {
  glb: ["model/gltf-binary", "application/octet-stream", "binary/octet-stream"],
  stl: ["model/stl", "application/sla", "application/octet-stream", "binary/octet-stream", "text/plain"],
  // OBJ and PLY are text/binary meshes with no registered media type in wide use,
  // so the extension is authoritative and the content type is only advisory.
  obj: ["model/obj", "text/plain", "text/model/obj", "application/octet-stream", "binary/octet-stream"],
  ply: ["model/ply", "application/ply", "application/octet-stream", "binary/octet-stream"],
  "three-mf": ["model/3mf", "application/3mf", "application/vnd.ms-package.3dmanufacturing-3dmodel+xml", "application/octet-stream", "binary/octet-stream"],
  parasolid: ["model/x-parasolid", "application/x-parasolid", "application/octet-stream", "binary/octet-stream", "text/plain"],
  step: ["model/step", "application/step", "application/x-step", "application/octet-stream", "binary/octet-stream", "text/plain"],
  iges: ["model/iges", "application/iges", "application/octet-stream", "binary/octet-stream", "text/plain"],
  brep: ["model/brep", "application/octet-stream", "binary/octet-stream", "text/plain"],
};

/** Canonical content type per kind, used when the browser sends a vague one. */
export const CAD_KIND_CONTENT_TYPES: Record<CadModelKind, string> = {
  glb: "model/gltf-binary",
  stl: "model/stl",
  obj: "model/obj",
  ply: "model/ply",
  "three-mf": "model/3mf",
  parasolid: "model/x-parasolid",
  step: "model/step",
  iges: "model/iges",
  brep: "model/brep",
};

export const CAD_MODEL_ACCEPT =
  ".glb,.stl,.obj,.ply,.3mf,.step,.stp,.iges,.igs,.brep,.brp,.x_t,.x_b";

export function cadModelKind(fileName: string): CadModelKind | null {
  const extension = fileName.toLowerCase().split(".").pop();
  if (!extension) return null;
  return EXTENSION_KINDS[extension] ?? null;
}

export function cadModelMaxBytes(kind: CadModelKind): number {
  // Parasolid and the B-Rep text formats are large but convert in the browser;
  // meshes are already renderable so they are capped lower.
  if (kind === "glb" || kind === "stl" || kind === "three-mf") return 100 * MIB;
  // OBJ is verbose ASCII and photogrammetry PLY can be very large, so both get
  // the mesh budget rather than the more generous B-Rep one.
  if (kind === "obj" || kind === "ply") return 100 * MIB;
  return 200 * MIB;
}

/**
 * Resolves the kind for an upload. Returns an error string instead of throwing
 * so both the JSON route and the raw upload route can report it verbatim.
 */
export function resolveCadUploadKind(
  fileName: string,
  contentType: string,
): { kind: CadModelKind; contentType: string } | { error: string } {
  const trimmedName = fileName.trim();
  if (!trimmedName) return { error: "The file needs a name." };
  if (trimmedName.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(trimmedName)) {
    return { error: "Use a file name without path separators or control characters." };
  }
  const kind = cadModelKind(trimmedName);
  if (!kind) {
    return {
      error: "Choose a GLB, STL, OBJ, PLY, 3MF, STEP, IGES, BREP, X_T, or X_B file.",
    };
  }
  const normalizedType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  // An empty or generic type is fine; an explicit mismatched one is not, since
  // it usually means the wrong file was renamed.
  const allowed = KIND_CONTENT_TYPES[kind];
  if (normalizedType && !allowed.includes(normalizedType)) {
    return { error: `The file contents do not look like a ${kind.toUpperCase()} model.` };
  }
  return { kind, contentType: CAD_KIND_CONTENT_TYPES[kind] };
}

function isValidStl(data: Buffer): boolean {
  if (data.length >= 84) {
    const triangleCount = data.readUInt32LE(80);
    if (triangleCount > 0 && 84 + triangleCount * 50 === data.length) return true;
  }
  if (data.length < 20) return false;
  const header = data.subarray(0, Math.min(512, data.length)).toString("ascii");
  const ending = data.subarray(Math.max(0, data.length - 128)).toString("ascii");
  return /^\s*solid(?:\s|$)/i.test(header) &&
    /\bendsolid(?:\s|$)[\s\S]*$/i.test(ending.trim()) &&
    data.includes("facet") &&
    data.includes("vertex");
}

/**
 * A 3MF file is a ZIP archive whose entry names live uncompressed in the
 * headers, so scanning the raw bytes for the mandatory model part is a cheap
 * and reliable check without inflating the archive.
 */
function isValidThreeMf(data: Buffer): boolean {
  if (data.length < 4 || data[0] !== 0x50 || data[1] !== 0x4b) return false;
  if (data.readUInt16LE(2) !== 0x0403 && data.readUInt16LE(2) !== 0x0605) return false;
  return data.includes("3dmodel.model");
}

/**
 * OBJ has no magic bytes, so require at least one vertex and one face line.
 * This rejects a renamed GLB or a text document without inflating anything.
 */
function isValidObj(data: Buffer): boolean {
  const text = sampleAscii(data, 512 * 1024);
  if (!/^\s*v\s+[-\d.]/m.test(text)) return false;
  return /^\s*f\s+\d/m.test(text);
}

/**
 * PLY always begins with an ASCII `ply` line, including its binary variants,
 * and the header must declare a supported body format and terminate.
 */
function isValidPly(data: Buffer): boolean {
  if (data.length < 4) return false;
  if (data.subarray(0, 3).toString("ascii") !== "ply") return false;
  const header = sampleAscii(data, 512 * 1024);
  if (!/\r?\nformat\s+(ascii|binary_little_endian|binary_big_endian)\r?\n/.test(header)) {
    return false;
  }
  return header.includes("end_header");
}

/** Decodes a bounded prefix of a buffer, enough for any of these signatures. */
function sampleAscii(data: Buffer, maxBytes: number): string {
  return data.subarray(0, Math.min(data.length, maxBytes)).toString("latin1");
}

function isValidGlb(data: Buffer): boolean {
  return data.length >= 20 &&
    data.toString("ascii", 0, 4) === "glTF" &&
    data.readUInt32LE(4) === 2 &&
    data.readUInt32LE(8) === data.length;
}

/** Checks that the bytes match the kind the extension claims. */
export function cadFileMatchesKind(kind: CadModelKind, data: Buffer): boolean {
  if (data.length === 0) return false;
  if (kind === "glb") return isValidGlb(data);
  if (kind === "stl") return isValidStl(data);
  if (kind === "obj") return isValidObj(data);
  if (kind === "ply") return isValidPly(data);
  if (kind === "three-mf") return isValidThreeMf(data);
  if (kind === "parasolid") {
    const looksBinary = data.subarray(0, Math.min(data.length, 512)).includes(0);
    // X_T is ASCII text, X_B is a binary transmit stream. Only the text form is
    // cheap to distinguish, so accept anything non-empty at this layer and let
    // the converter report genuine parse failures.
    return looksBinary ? data.length >= 32 : data.length >= 16;
  }
  return true;
}

/** Trimmed, control-character-free label for a stored display name. */
export function cleanCadLabel(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}
