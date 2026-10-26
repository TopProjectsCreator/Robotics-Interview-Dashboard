import { fileFormatHint, fileFormatLabel, resolveFileFormat, type FileFormat } from "./fileFormats";

export type CadRenderFormat = Exclude<FileFormat, "archive">;

export const CAD_ACCEPT =
  ".glb,.stl,.obj,.ply,.3mf,.step,.stp,.iges,.igs,.brep,.brp,.x_t,.x_b" +
  ",.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.avif,.tif,.tiff,.heic,.heif" +
  ",.mp4,.mov,.webm,.m4v,.mkv,.avi,.mp3,.wav,.ogg,.oga,.m4a,.flac,.aac" +
  ",.pdf,.doc,.docx,.odt,.rtf,.ppt,.pptx,.odp,.ppsx,.xls,.xlsx,.ods,.csv,.tsv,.txt,.md,.log,.json";

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
  const format = resolveFileFormat(fileName, contentType);
  return format && format !== "archive" ? format : null;
}

/** Short human label shown on cards and in the preview header. */
export function cadFormatLabel(format: CadRenderFormat): string {
  return fileFormatLabel(format);
}

/** How the model will be displayed, so the UI can set expectations up front. */
export function cadFormatHint(format: CadRenderFormat): string {
  return fileFormatHint(format);
}
