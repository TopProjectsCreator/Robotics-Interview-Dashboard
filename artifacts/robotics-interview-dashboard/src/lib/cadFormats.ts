export type CadRenderFormat =
  | "glb"
  | "stl"
  | "obj"
  | "ply"
  | "three-mf"
  | "parasolid"
  | "step"
  | "iges"
  | "brep"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "document"
  | "presentation"
  | "spreadsheet"
  | "text";

const EXTENSION_FORMATS: Record<string, CadRenderFormat> = {
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

const CONTENT_TYPE_FORMATS: Record<string, CadRenderFormat> = {
  "model/gltf-binary": "glb",
  "model/stl": "stl",
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
  "application/vnd.oasis.opendocument.spreadsheet": "spreadsheet",
  "text/csv": "spreadsheet",
  "text/tab-separated-values": "spreadsheet",
  "text/plain": "text",
  "text/markdown": "text",
};

export const CAD_ACCEPT =
  ".glb,.stl,.obj,.ply,.3mf,.step,.stp,.iges,.igs,.brep,.brp,.x_t,.x_b" +
  ",.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.avif,.tif,.tiff,.heic,.heif" +
  ",.mp4,.mov,.webm,.m4v,.mkv,.avi,.mp3,.wav,.ogg,.oga,.m4a,.flac,.aac" +
  ",.pdf,.doc,.docx,.odt,.rtf,.ppt,.pptx,.odp,.ppsx,.xls,.xlsx,.ods,.csv,.tsv,.txt,.md,.log";

/** True for 3D model formats; false for images, docs, sheets, and media. */
export function isCadRenderFormat(format: CadRenderFormat): boolean {
  return (
    format === "glb" ||
    format === "stl" ||
    format === "obj" ||
    format === "ply" ||
    format === "three-mf" ||
    format === "parasolid" ||
    format === "step" ||
    format === "iges" ||
    format === "brep"
  );
}

/**
 * The file extension decides the renderer. Browsers frequently report a vague
 * content type for these files (or none at all), so it is only consulted when
 * the extension is unhelpful. Image/video/audio accept any subtype via prefix
 * so phone photos and screen recordings always preview.
 */
export function cadRenderFormat(
  fileName: string,
  contentType?: string | null,
): CadRenderFormat | null {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension && EXTENSION_FORMATS[extension]) return EXTENSION_FORMATS[extension];
  const normalizedType = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (CONTENT_TYPE_FORMATS[normalizedType]) return CONTENT_TYPE_FORMATS[normalizedType];
  if (normalizedType.startsWith("image/")) return "image";
  if (normalizedType.startsWith("video/")) return "video";
  if (normalizedType.startsWith("audio/")) return "audio";
  return null;
}

/** Short human label shown on cards and in the preview header. */
export function cadFormatLabel(format: CadRenderFormat): string {
  switch (format) {
    case "glb":
      return "GLB";
    case "stl":
      return "STL";
    case "obj":
      return "OBJ";
    case "ply":
      return "PLY";
    case "three-mf":
      return "3MF";
    case "parasolid":
      return "Parasolid";
    case "step":
      return "STEP";
    case "iges":
      return "IGES";
    case "brep":
      return "BREP";
    case "image":
      return "Image";
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "pdf":
      return "PDF";
    case "document":
      return "Document";
    case "presentation":
      return "Slides";
    case "spreadsheet":
      return "Sheet";
    case "text":
      return "Text";
  }
}

/** How the model will be displayed, so the UI can set expectations up front. */
export function cadFormatHint(format: CadRenderFormat): string {
  switch (format) {
    case "glb":
      return "Rendered directly · drag to rotate";
    case "stl":
    case "obj":
    case "ply":
    case "three-mf":
      return "Mesh rendered in your browser · drag to rotate";
    case "parasolid":
      return "Converted to a private preview on this server";
    case "step":
    case "iges":
    case "brep":
      return "Converted in your browser · drag to rotate";
    case "image":
      return "Image preview · robot photos welcome";
    case "video":
      return "Video preview · plays inline";
    case "audio":
      return "Audio preview · plays inline";
    case "pdf":
      return "PDF preview · scrolls inline";
    case "document":
      return "Document preview · reads inline like chat";
    case "presentation":
      return "Slides preview · reads inline like chat";
    case "spreadsheet":
      return "Spreadsheet preview · tables inline like chat";
    case "text":
      return "Text preview · reads inline like chat";
  }
}
