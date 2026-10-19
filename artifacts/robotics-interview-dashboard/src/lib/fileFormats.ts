/**
 * One classifier for every file preview in the app.
 *
 * This module used to exist three times over: `attachmentKind` in App.tsx,
 * `workspaceAttachmentKind` in WorkspaceFileViewer.tsx, and `cadRenderFormat`
 * in cadFormats.ts. The first two were hand-maintained copies of each other
 * (despite a comment claiming they stayed in sync) and the third disagreed
 * with both about precedence. A fourth partial copy lived in
 * PartsRobotDetailsDialog.tsx. When the supported vocabulary grew, some copies
 * learned about a format and others did not, which is how `.pptx` ended up
 * accepted by the uploader but rendering as an empty box.
 *
 * The rule now lives here, once:
 *   1. Extension wins. Browsers report vague or missing content types for most
 *      of these (`.ts`, `.yaml`, `.py` all arrive as `""`), so the filename is
 *      the more reliable signal.
 *   2. Content type is the fallback, for uploads whose name carries no
 *      extension at all.
 *   3. `image/`, `video/` and `audio/` prefixes catch subtypes we do not name.
 *   4. Magic bytes, when the caller has already fetched the head of the file,
 *      catch archives uploaded with a missing or wrong extension.
 *   5. Anything still unknown is a "document" — never a blank iframe.
 */

/** Everything the app knows how to render, or name honestly. */
export type FileFormat =
  | "archive"
  | "audio"
  | "brep"
  | "document"
  | "glb"
  | "iges"
  | "image"
  | "obj"
  | "parasolid"
  | "pdf"
  | "ply"
  | "presentation"
  | "spreadsheet"
  | "stl"
  | "step"
  | "text"
  | "three-mf"
  | "video";

/** Archive containers we can open in the browser. */
export const ARCHIVE_EXTENSIONS = [
  "7z",
  "bz2",
  "gz",
  "rar",
  "tar",
  "tgz",
  "xz",
  "zip",
] as const;

export const ARCHIVE_CONTENT_TYPES = [
  "application/gzip",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-bzip2",
  "application/x-gzip",
  "application/x-rar-compressed",
  "application/x-tar",
  "application/x-xz",
  "application/zip",
  "application/zstd",
] as const;

/**
 * Formats that must go through the OCCT WASM kernel rather than three.js.
 * STEP, IGES and BREP are all B-rep solids that only OpenCascade can read.
 */
const OCCT_FORMATS: ReadonlySet<FileFormat> = new Set(["step", "iges", "brep"]);

/** True for 3D model formats; false for images, docs, sheets, media, archives. */
export function isCadRenderFormat(format: FileFormat): boolean {
  return (
    format === "glb" ||
    format === "stl" ||
    format === "obj" ||
    format === "ply" ||
    format === "three-mf" ||
    format === "parasolid" ||
    OCCT_FORMATS.has(format)
  );
}

/** True when the format needs the OpenCascade kernel, which is slow to load. */
export function isOcctFormat(format: FileFormat): boolean {
  return OCCT_FORMATS.has(format);
}

/** True when a file can be expanded into a browsable tree of entries. */
export function isArchiveFormat(format: FileFormat): boolean {
  return format === "archive";
}

/**
 * True when the renderer needs the original file to live at a fetchable URL.
 * Parasolid is converted to GLB by the server, so an extracted archive entry
 * (which only exists as a blob URL in the tab) cannot be previewed.
 */
export function needsServerRoundTrip(format: FileFormat): boolean {
  return format === "parasolid";
}

const EXTENSION_FORMATS: Record<string, FileFormat> = {
  // 3D models.
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

  // Images.
  jpg: "image",
  jpeg: "image",
  jfif: "image",
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
  ico: "image",

  // Media.
  mp4: "video",
  m4v: "video",
  mov: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  ogv: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  oga: "audio",
  m4a: "audio",
  flac: "audio",
  aac: "audio",
  opus: "audio",
  wma: "audio",

  // Documents.
  pdf: "pdf",
  doc: "document",
  docx: "document",
  odt: "document",
  rtf: "document",
  epub: "document",
  ppt: "presentation",
  pptx: "presentation",
  odp: "presentation",
  ppsx: "presentation",
  key: "presentation",
  xls: "spreadsheet",
  xlsx: "spreadsheet",
  xlsm: "spreadsheet",
  ods: "spreadsheet",
  numbers: "spreadsheet",

  // Archives.
  zip: "archive",
  tar: "archive",
  gz: "archive",
  tgz: "archive",
  bz2: "archive",
  xz: "archive",
  zst: "archive",
  "7z": "archive",
  rar: "archive",

  // Text. Note `ts` is TypeScript here, not an MPEG transport stream: in a
  // chat or workspace upload the source file is what someone means. It used
  // to map to "text/tab-separated-values", which made every .ts upload render
  // as a comma-delimited grid.
  txt: "text",
  text: "text",
  log: "text",
  md: "text",
  markdown: "text",
  mdx: "text",
  csv: "spreadsheet",
  tsv: "spreadsheet",
  json: "text",
  json5: "text",
  jsonc: "text",
  yaml: "text",
  yml: "text",
  toml: "text",
  ini: "text",
  cfg: "text",
  conf: "text",
  env: "text",
  properties: "text",
  xml: "text",
  xsd: "text",
  xsl: "text",
  html: "text",
  htm: "text",
  css: "text",
  scss: "text",
  less: "text",
  js: "text",
  jsx: "text",
  mjs: "text",
  cjs: "text",
  ts: "text",
  tsx: "text",
  py: "text",
  rb: "text",
  go: "text",
  rs: "text",
  java: "text",
  kt: "text",
  kts: "text",
  swift: "text",
  c: "text",
  h: "text",
  cc: "text",
  cpp: "text",
  cxx: "text",
  hpp: "text",
  hh: "text",
  cs: "text",
  php: "text",
  sh: "text",
  bash: "text",
  zsh: "text",
  fish: "text",
  ps1: "text",
  bat: "text",
  cmd: "text",
  sql: "text",
  graphql: "text",
  gql: "text",
  proto: "text",
  diff: "text",
  patch: "text",
  urdf: "text",
  xacro: "text",
  sdf: "text",
  world: "text",
  launch: "text",
  rosbag: "archive",
  db3: "archive",
  cmake: "text",
  gradle: "text",
  dockerfile: "text",
  makefile: "text",
  mk: "text",
  gitignore: "text",
  lock: "text",
  rtf2: "text",
};

/**
 * Compound extensions that a naive `split(".").pop()` would misread.
 * `.tar.gz` must be an archive even though the last segment is "gz", and the
 * format is still "archive" either way — the archive reader sniffs the real
 * container from magic bytes. The table exists so callers asking about a full
 * suffix get the right answer.
 */
const COMPOUND_EXTENSIONS: Record<string, FileFormat> = {
  "tar.gz": "archive",
  "tar.bz2": "archive",
  "tar.xz": "archive",
  "tar.zst": "archive",
};

const CONTENT_TYPE_FORMATS: Record<string, FileFormat> = {
  // 3D models.
  "model/gltf-binary": "glb",
  "model/gltf+json": "archive", // .gltf is JSON beside external .bin/textures.
  "model/stl": "stl",
  "application/sla": "stl",
  "model/obj": "obj",
  "model/ply": "ply",
  "application/ply": "ply",
  "model/3mf": "three-mf",
  "application/3mf": "three-mf",
  "application/vnd.ms-package.3dmanufacturing-3dmodel+xml": "three-mf",
  "model/x-parasolid": "parasolid",
  "model/step": "step",
  "application/step": "step",
  "application/x-step": "step",
  "model/iges": "iges",
  "application/iges": "iges",
  "model/brep": "brep",

  // Documents.
  "application/pdf": "pdf",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "document",
  "application/vnd.oasis.opendocument.text": "document",
  "application/rtf": "document",
  "text/rtf": "document",
  "application/vnd.ms-powerpoint": "presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "presentation",
  "application/vnd.oasis.opendocument.presentation": "presentation",
  "application/vnd.ms-excel": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.template": "spreadsheet",
  "application/vnd.oasis.opendocument.spreadsheet": "spreadsheet",
  "application/epub+zip": "document",

  // Text. `text/csv` stays a spreadsheet so it renders as a table.
  "text/csv": "spreadsheet",
  "text/tab-separated-values": "spreadsheet",
  "text/plain": "text",
  "text/markdown": "text",
  "text/html": "text",
  "text/css": "text",
  "application/json": "text",
  "application/ld+json": "text",
  "application/xml": "text",
  "application/yaml": "text",
  "application/x-yaml": "text",
  "application/toml": "text",
  "application/javascript": "text",
  "application/x-javascript": "text",
  "application/ecmascript": "text",
  "application/typescript": "text",
  "application/x-sh": "text",
  "application/x-shellscript": "text",
  "application/sql": "text",
  "application/x-httpd-php": "text",
  "application/graphql": "text",
};

const TEXT_CONTENT_TYPE = "text/plain";

/** Strips `;charset=…` and lowercases, so MIME strings compare cleanly. */
export function normalizeFileContentType(type: string | null | undefined): string {
  return (type ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
}

/** Lowercased extension without the dot, or "" when the name has none. */
export function fileExtension(fileName: string): string {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

/** True when `fileName` ends with a compound suffix such as `.tar.gz`. */
export function hasCompoundArchiveExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return Object.keys(COMPOUND_EXTENSIONS).some((suffix) => lower.endsWith(`.${suffix}`));
}

/**
 * Resolves a format, or null when nothing recognises the file. Null is what the
 * CAD uploader needs so it can reject an unsupported file outright; callers
 * that want a guaranteed value should use `classifyFile` instead.
 *
 * `head` is an optional prefix of the file's bytes. Passing it lets archive
 * sniffing override a misleading extension, which is what makes an uploaded
 * `.zip` whose type is `application/octet-stream` still open.
 */
export function resolveFileFormat(
  fileName: string,
  contentType?: string | null,
  head?: Uint8Array | null,
): FileFormat | null {
  const extension = fileExtension(fileName);
  if (EXTENSION_FORMATS[extension]) return EXTENSION_FORMATS[extension];

  const normalizedType = normalizeFileContentType(contentType);
  if (CONTENT_TYPE_FORMATS[normalizedType]) return CONTENT_TYPE_FORMATS[normalizedType];

  if (normalizedType.startsWith("image/")) return "image";
  if (normalizedType.startsWith("video/")) return "video";
  if (normalizedType.startsWith("audio/")) return "audio";
  if ((ARCHIVE_CONTENT_TYPES as readonly string[]).includes(normalizedType)) return "archive";

  // Last resort: a file with no usable extension and no useful MIME type is
  // often still an archive. This is checked last so a real `.stl` that happens
  // to start with the same bytes as a zip header is not misread.
  if (head && head.length >= 4 && looksLikeArchive(head)) return "archive";
  return null;
}

/** True when the leading bytes match a container we know how to open. */
export function looksLikeArchive(head: Uint8Array): boolean {
  const has = (...signature: number[]) =>
    signature.every((byte, index) => head[index] === byte);
  // Zip, spanning "PK\x07\x08", and empty "PK\x05\x06".
  if (has(0x50, 0x4b, 0x03, 0x04) || has(0x50, 0x4b, 0x05, 0x06) || has(0x50, 0x4b, 0x07, 0x08))
    return true;
  // gzip, bzip2, xz, zstd.
  if (has(0x1f, 0x8b) || has(0x42, 0x5a, 0x68) || has(0xfd, 0x37, 0x7a, 0x58, 0x5a)) return true;
  if (has(0x28, 0xb5, 0x2f, 0xfd)) return true;
  // 7-Zip.
  if (has(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return true;
  // RAR 4 and RAR 5.
  if (has(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07)) return true;
  // Plain tar: "ustar" sits 257 bytes in.
  if (head.length >= 262) {
    const marker = String.fromCharCode(...head.subarray(257, 262));
    if (marker === "ustar") return true;
  }
  return false;
}

/**
 * The guaranteed-value entry point. Unknown files classify as "document" so
 * every renderer has a branch to fall into.
 */
export function classifyFile(
  fileName: string,
  contentType?: string | null,
  head?: Uint8Array | null,
): FileFormat {
  return resolveFileFormat(fileName, contentType, head) ?? "document";
}

/** Short human label shown on cards and in the preview header. */
export function fileFormatLabel(format: FileFormat): string {
  switch (format) {
    case "archive":
      return "Archive";
    case "audio":
      return "Audio";
    case "brep":
      return "BREP";
    case "document":
      return "Document";
    case "glb":
      return "GLB";
    case "iges":
      return "IGES";
    case "image":
      return "Image";
    case "obj":
      return "OBJ";
    case "parasolid":
      return "Parasolid";
    case "pdf":
      return "PDF";
    case "ply":
      return "PLY";
    case "presentation":
      return "Slides";
    case "spreadsheet":
      return "Sheet";
    case "stl":
      return "STL";
    case "step":
      return "STEP";
    case "text":
      return "Text";
    case "three-mf":
      return "3MF";
    case "video":
      return "Video";
  }
}

/** How the file will be displayed, so the UI can set expectations up front. */
export function fileFormatHint(format: FileFormat): string {
  switch (format) {
    case "archive":
      return "Opens in the browser · click a file to preview it";
    case "audio":
      return "Audio preview · plays inline";
    case "brep":
    case "iges":
    case "step":
      return "Converted in the browser · drag to rotate";
    case "document":
      return "Document preview · reads inline like chat";
    case "glb":
      return "Rendered directly · drag to rotate";
    case "image":
      return "Image preview · robot photos welcome";
    case "obj":
    case "ply":
    case "stl":
    case "three-mf":
      return "Mesh rendered in your browser · drag to rotate";
    case "parasolid":
      return "Converted to a private preview on this server";
    case "pdf":
      return "PDF preview · scrolls inline";
    case "presentation":
      return "Slide outline · reads inline like chat";
    case "spreadsheet":
      return "Spreadsheet preview · tables inline like chat";
    case "text":
      return "Text preview · reads inline like chat";
    case "video":
      return "Video preview · plays inline";
  }
}

/** MIME type to upload an archive under, keyed by extension. */
const EXTENSION_CONTENT_TYPES: Record<string, string> = {
  zip: "application/zip",
  gz: "application/gzip",
  tgz: "application/gzip",
  tar: "application/x-tar",
  bz2: "application/x-bzip2",
  xz: "application/x-xz",
  zst: "application/zstd",
  "7z": "application/x-7z-compressed",
  rar: "application/vnd.rar",
};

/**
 * The content type to store an uploaded file under. Extensions win for the
 * same reason they win in `classifyFile`: browsers report nothing useful for
 * most of these. Returns "" when the app has no opinion, which callers treat as
 * "not a supported attachment".
 */
export function uploadContentTypeFor(fileName: string, declaredType: string): string {
  const declared = normalizeFileContentType(declaredType);
  if (declared.startsWith("image/") || declared.startsWith("video/") || declared.startsWith("audio/"))
    return declared;
  if (CONTENT_TYPE_FORMATS[declared]) return declared;

  const extension = fileExtension(fileName);
  if (EXTENSION_CONTENT_TYPES[extension]) return EXTENSION_CONTENT_TYPES[extension];
  if (EXTENSION_FORMATS[extension]) return TEXT_CONTENT_TYPE;
  return "";
}
