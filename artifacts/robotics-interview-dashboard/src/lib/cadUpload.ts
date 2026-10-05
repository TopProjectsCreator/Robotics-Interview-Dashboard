import { useCallback, useMemo, useRef, useState } from "react";

/** MIME type used when the browser gives us nothing useful for a CAD file. */
const CAD_CONTENT_TYPES: Record<string, string> = {
  glb: "model/gltf-binary",
  stl: "model/stl",
  "3mf": "model/3mf",
  step: "model/step",
  stp: "model/step",
  iges: "model/iges",
  igs: "model/iges",
  brep: "model/brep",
  brp: "model/brep",
  x_t: "model/x-parasolid",
  x_b: "model/x-parasolid",
};

export const CAD_EXTENSIONS = Object.keys(CAD_CONTENT_TYPES);

/**
 * Browsers report inconsistent and often empty types for CAD files, and
 * drag-and-drop from the OS gives `application/octet-stream` at best. The
 * extension is the reliable signal, so it decides the type we store.
 */
export function cadUploadContentType(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const byExtension = CAD_CONTENT_TYPES[extension];
  if (byExtension) return byExtension;
  return file.type === "application/octet-stream" ? null : file.type || null;
}

export function isCadFile(file: File): boolean {
  return CAD_CONTENT_TYPES[file.name.toLowerCase().split(".").pop() ?? ""] !== undefined;
}

export type { CAD_CONTENT_TYPES };
