export type CadRenderFormat =
  | "glb"
  | "stl"
  | "three-mf"
  | "parasolid"
  | "step"
  | "iges"
  | "brep";

const EXTENSION_FORMATS: Record<string, CadRenderFormat> = {
  glb: "glb",
  stl: "stl",
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

const CONTENT_TYPE_FORMATS: Record<string, CadRenderFormat> = {
  "model/gltf-binary": "glb",
  "model/stl": "stl",
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
};

export const CAD_ACCEPT = ".glb,.stl,.3mf,.step,.stp,.iges,.igs,.brep,.brp,.x_t,.x_b";

/**
 * The file extension decides the renderer. Browsers frequently report a vague
 * content type for these files (or none at all), so it is only consulted when
 * the extension is unhelpful.
 */
export function cadRenderFormat(
  fileName: string,
  contentType?: string | null,
): CadRenderFormat | null {
  const extension = fileName.toLowerCase().split(".").pop();
  if (extension && EXTENSION_FORMATS[extension]) return EXTENSION_FORMATS[extension];
  const normalizedType = (contentType ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  return CONTENT_TYPE_FORMATS[normalizedType] ?? null;
}

/** Short human label shown on cards and in the preview header. */
export function cadFormatLabel(format: CadRenderFormat): string {
  switch (format) {
    case "glb":
      return "GLB";
    case "stl":
      return "STL";
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
  }
}

/** How the model will be displayed, so the UI can set expectations up front. */
export function cadFormatHint(format: CadRenderFormat): string {
  switch (format) {
    case "glb":
      return "Rendered directly · drag to rotate";
    case "stl":
    case "three-mf":
      return "Mesh rendered in your browser · drag to rotate";
    case "parasolid":
      return "Converted to a private preview on this server";
    case "step":
    case "iges":
    case "brep":
      return "Converted in your browser · drag to rotate";
  }
}
