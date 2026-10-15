/** MIME type used when the browser gives us nothing useful for a workspace file. */
const CAD_CONTENT_TYPES: Record<string, string> = {
  glb: "model/gltf-binary",
  stl: "model/stl",
  obj: "model/obj",
  ply: "model/ply",
  "3mf": "model/3mf",
  step: "model/step",
  stp: "model/step",
  iges: "model/iges",
  igs: "model/iges",
  brep: "model/brep",
  brp: "model/brep",
  x_t: "model/x-parasolid",
  x_b: "model/x-parasolid",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
  tif: "image/tiff",
  tiff: "image/tiff",
  heic: "image/heic",
  heif: "image/heif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/mp4",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  odt: "application/vnd.oasis.opendocument.text",
  rtf: "application/rtf",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odp: "application/vnd.oasis.opendocument.presentation",
  ppsx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  csv: "text/csv",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  md: "text/markdown",
  log: "text/plain",
};

export const CAD_EXTENSIONS = Object.keys(CAD_CONTENT_TYPES);

/** Human list used in upload error messages. */
export const CAD_WORKSPACE_SUPPORTED_LABEL =
  "GLB, STL, OBJ, PLY, 3MF, STEP, IGES, BREP, X_T, X_B, images, videos, audio, PDF, documents, presentations, spreadsheets, or text";

/**
 * Browsers report inconsistent and often empty types for CAD files, and
 * drag-and-drop from the OS gives `application/octet-stream` at best. The
 * extension is the reliable signal, so it decides the type we store. Reference
 * files (images, docs, sheets) work the same way so phone photos of robots and
 * exported BOMs upload without a fight.
 */
export function cadUploadContentType(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const byExtension = CAD_CONTENT_TYPES[extension];
  if (byExtension) return byExtension;
  // Unknown extension: trust an explicit image/video/audio/document type so a
  // file with an odd suffix still uploads; otherwise there is nothing useful.
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return null;
}

export function isCadFile(file: File): boolean {
  return CAD_CONTENT_TYPES[file.name.toLowerCase().split(".").pop() ?? ""] !== undefined;
}

/** Alias kept for readability: every workspace file passes this check. */
export const isWorkspaceFile = isCadFile;

export type { CAD_CONTENT_TYPES };
