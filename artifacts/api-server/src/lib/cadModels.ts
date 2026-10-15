const MIB = 1024 * 1024;

/**
 * CAD file kinds the CAD workspace renders as 3D. Everything here can be
 * rendered inline in the browser, either directly (GLB/STL/3MF) or through
 * the OpenCascade WASM reader (STEP/IGES/BREP), or via the server-side
 * Parasolid converter.
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

/**
 * Every file kind the CAD workspace library accepts. CAD kinds render as 3D;
 * reference kinds (images, video, documents, presentations, spreadsheets)
 * render inline exactly like chat attachments, so robot designs stored as
 * photos, PDFs, slides, or sheets are first-class citizens here.
 */
export type CadWorkspaceFileKind =
  | CadModelKind
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "presentation"
  | "spreadsheet"
  | "text";

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
 * Reference (non-CAD) extensions, keyed by lowercase extension without the
 * dot. These mirror the chat attachment support so anything that renders in
 * chat — photos of robots, build videos, design docs, slide decks, BOM
 * spreadsheets — also uploads to the CAD workspace.
 */
const REFERENCE_EXTENSION_KINDS: Record<string, Exclude<CadWorkspaceFileKind, CadModelKind>> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  bmp: "image",
  avif: "image",
  tif: "image",
  tiff: "image",
  heic: "image",
  heif: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
  m4v: "video",
  mkv: "video",
  avi: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  oga: "audio",
  m4a: "audio",
  flac: "audio",
  aac: "audio",
  pdf: "pdf",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",
  ppsx: "presentation",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  ods: "spreadsheet",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  txt: "text",
  md: "text",
  log: "text",
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

/** Canonical content type for reference kinds, mirroring chat attachments. */
export const WORKSPACE_KIND_CONTENT_TYPES: Record<Exclude<CadWorkspaceFileKind, CadModelKind>, string> = {
  image: "image/png",
  video: "video/mp4",
  audio: "audio/mpeg",
  pdf: "application/pdf",
  document: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  presentation: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  spreadsheet: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  text: "text/plain",
};

/** Canonical content type for every workspace kind (CAD + reference). */
export const CAD_WORKSPACE_KIND_CONTENT_TYPES: Record<CadWorkspaceFileKind, string> = {
  ...CAD_KIND_CONTENT_TYPES,
  ...WORKSPACE_KIND_CONTENT_TYPES,
};

/**
 * Explicit content types accepted per reference kind, beyond the generic
 * `application/octet-stream`/empty types browsers send on drag-and-drop.
 * Image/video/audio accept any subtype via prefix matching (see resolver).
 */
const REFERENCE_KIND_CONTENT_TYPES: Record<Exclude<CadWorkspaceFileKind, CadModelKind>, string[]> = {
  image: [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    "image/avif",
    "image/tiff",
    "image/heic",
    "image/heif",
    "application/octet-stream",
    "binary/octet-stream",
    "",
  ],
  video: [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "application/octet-stream",
    "binary/octet-stream",
    "",
  ],
  audio: [
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/flac",
    "audio/aac",
    "audio/x-wav",
    "application/octet-stream",
    "binary/octet-stream",
    "",
  ],
  pdf: ["application/pdf", "application/octet-stream", "binary/octet-stream", ""],
  document: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.oasis.opendocument.text",
    "application/rtf",
    "text/rtf",
    "application/octet-stream",
    "binary/octet-stream",
    "text/plain",
    "",
  ],
  presentation: [
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.presentation",
    "application/octet-stream",
    "binary/octet-stream",
    "",
  ],
  spreadsheet: [
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.oasis.opendocument.spreadsheet",
    "text/csv",
    "text/tab-separated-values",
    "application/octet-stream",
    "binary/octet-stream",
    "text/plain",
    "",
  ],
  text: [
    "text/plain",
    "text/csv",
    "text/tab-separated-values",
    "text/markdown",
    "application/octet-stream",
    "binary/octet-stream",
    "",
  ],
};

export const CAD_MODEL_ACCEPT =
  ".glb,.stl,.obj,.ply,.3mf,.step,.stp,.iges,.igs,.brep,.brp,.x_t,.x_b";

/** Every extension the CAD workspace accepts: CAD models plus reference files. */
export const CAD_WORKSPACE_ACCEPT =
  ".glb,.stl,.obj,.ply,.3mf,.step,.stp,.iges,.igs,.brep,.brp,.x_t,.x_b" +
  ",.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.avif,.tif,.tiff,.heic,.heif" +
  ",.mp4,.mov,.webm,.m4v,.mkv,.avi,.mp3,.wav,.ogg,.oga,.m4a,.flac,.aac" +
  ",.pdf,.doc,.docx,.odt,.rtf,.ppt,.pptx,.odp,.ppsx,.xls,.xlsx,.ods,.csv,.tsv,.txt,.md,.log";

export const CAD_WORKSPACE_ACCEPT_MESSAGE =
  "Choose a CAD model (GLB, STL, OBJ, PLY, 3MF, STEP, IGES, BREP, X_T, X_B) or an image, video, audio, PDF, document, presentation, spreadsheet, or text file.";

export function cadModelKind(fileName: string): CadModelKind | null {
  const extension = fileName.toLowerCase().split(".").pop();
  if (!extension) return null;
  return EXTENSION_KINDS[extension] ?? null;
}

/**
 * Every file kind the workspace accepts, CAD first then reference. The
 * extension is authoritative because browsers report vague types on drop.
 */
export function cadWorkspaceKind(fileName: string): CadWorkspaceFileKind | null {
  const extension = fileName.toLowerCase().split(".").pop();
  if (!extension) return null;
  return EXTENSION_KINDS[extension] ?? REFERENCE_EXTENSION_KINDS[extension] ?? null;
}

/** True for 3D model kinds; false for images, docs, sheets, and other refs. */
export function isCadModelKind(kind: CadWorkspaceFileKind): kind is CadModelKind {
  return kind in CAD_KIND_CONTENT_TYPES;
}

/** True when a declared content type is compatible with a workspace kind. */
export function isWorkspaceContentTypeCompatible(kind: CadWorkspaceFileKind, normalizedType: string): boolean {
  if (isCadModelKind(kind)) return KIND_CONTENT_TYPES[kind].includes(normalizedType);
  if (!normalizedType || normalizedType === "application/octet-stream" || normalizedType === "binary/octet-stream") return true;
  if (kind === "image") return normalizedType.startsWith("image/");
  if (kind === "video") return normalizedType.startsWith("video/");
  if (kind === "audio") return normalizedType.startsWith("audio/");
  return REFERENCE_KIND_CONTENT_TYPES[kind as Exclude<CadWorkspaceFileKind, CadModelKind>].includes(normalizedType);
}

export function cadModelMaxBytes(kind: CadModelKind | CadWorkspaceFileKind): number {
  // Parasolid and the B-Rep text formats are large but convert in the browser;
  // meshes are already renderable so they are capped lower.
  if (kind === "glb" || kind === "stl" || kind === "three-mf") return 100 * MIB;
  // OBJ is verbose ASCII and photogrammetry PLY can be very large, so both get
  // the mesh budget rather than the more generous B-Rep one.
  if (kind === "obj" || kind === "ply") return 100 * MIB;
  if (isCadModelKind(kind)) return 200 * MIB;
  // Reference files (images, video, docs, sheets) share chat's 100 MB budget
  // so a build video or a photo set of a robot never hits a surprise cap.
  return 100 * MIB;
}

/**
 * Resolves the kind for an upload. Returns an error string instead of throwing
 * so both the JSON route and the raw upload route can report it verbatim.
 */
export function resolveCadUploadKind(
  fileName: string,
  contentType: string,
): { kind: CadWorkspaceFileKind; contentType: string } | { error: string } {
  const trimmedName = fileName.trim();
  if (!trimmedName) return { error: "The file needs a name." };
  if (trimmedName.length > 255 || /[\\/\u0000-\u001f\u007f]/.test(trimmedName)) {
    return { error: "Use a file name without path separators or control characters." };
  }
  const kind = cadWorkspaceKind(trimmedName);
  if (!kind) {
    return { error: CAD_WORKSPACE_ACCEPT_MESSAGE };
  }
  const normalizedType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  if (isCadModelKind(kind)) {
    // An empty or generic type is fine; an explicit mismatched one is not, since
    // it usually means the wrong file was renamed.
    const allowed = KIND_CONTENT_TYPES[kind];
    if (normalizedType && !allowed.includes(normalizedType)) {
      return { error: `The file contents do not look like a ${kind.toUpperCase()} model.` };
    }
    return { kind, contentType: CAD_KIND_CONTENT_TYPES[kind] };
  }
  // Reference files: the extension is authoritative. Generic/empty types pass;
  // image/video/audio accept any subtype via prefix, others need an exact hit.
  if (!normalizedType || normalizedType === "application/octet-stream" || normalizedType === "binary/octet-stream") {
    return { kind, contentType: WORKSPACE_KIND_CONTENT_TYPES[kind] };
  }
  if (kind === "image" && normalizedType.startsWith("image/")) {
    return { kind, contentType: normalizedType };
  }
  if (kind === "video" && normalizedType.startsWith("video/")) {
    return { kind, contentType: normalizedType };
  }
  if (kind === "audio" && normalizedType.startsWith("audio/")) {
    return { kind, contentType: normalizedType };
  }
  const allowed = REFERENCE_KIND_CONTENT_TYPES[kind];
  if (!allowed.includes(normalizedType)) {
    return { error: `The file contents do not look like a ${kind} file.` };
  }
  const canonical = WORKSPACE_KIND_CONTENT_TYPES[kind];
  const specific = normalizedType !== "" && normalizedType !== "application/octet-stream" && normalizedType !== "binary/octet-stream"
    ? normalizedType
    : canonical;
  return { kind, contentType: specific };
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
export function cadFileMatchesKind(kind: CadModelKind | CadWorkspaceFileKind, data: Buffer): boolean {
  if (data.length === 0) return false;
  if (kind === "glb") return isValidGlb(data);
  if (kind === "stl") return isValidStl(data);
  if (kind === "obj") return isValidObj(data);
  if (kind === "ply") return isValidPly(data);
  if (kind === "three-mf") return isValidThreeMf(data);
  if (!isCadModelKind(kind)) {
    // Reference files render like chat attachments, which are permissive here
    // and surface real parse errors in the preview (XLSX, DOCX, images). A
    // light magic check keeps an obviously renamed file from uploading while
    // never rejecting a valid photo, video, PDF, slide deck, or spreadsheet.
    if (kind === "pdf") {
      if (data.length < 5) return false;
      const head = data.subarray(0, Math.min(8, data.length)).toString("latin1");
      if (head.startsWith("%PDF")) return true;
      // Be permissive: some producers omit the header on tiny exports.
      return data.length >= 16;
    }
    if (kind === "image" || kind === "video" || kind === "audio") return data.length >= 16;
    return data.length > 0;
  }
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
