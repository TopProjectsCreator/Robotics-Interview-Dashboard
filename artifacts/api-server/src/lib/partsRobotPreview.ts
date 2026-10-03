const MIB = 1024 * 1024;

export type SupportedPartsPreviewKind = "image" | "glb" | "stl" | "parasolid" | "step";

export function partsPreviewKind(
  fileName: string,
  contentType: string,
): SupportedPartsPreviewKind | null {
  const extension = fileName.toLowerCase().split(".").pop();
  if (
    (extension === "jpg" || extension === "jpeg") &&
    contentType === "image/jpeg"
  ) return "image";
  if (extension === "png" && contentType === "image/png") return "image";
  if (extension === "webp" && contentType === "image/webp") return "image";
  if (extension === "gif" && contentType === "image/gif") return "image";
  if (extension === "glb" && contentType === "model/gltf-binary") return "glb";
  if (extension === "stl" && contentType === "model/stl") return "stl";
  if ((extension === "x_t" || extension === "x_b") && contentType === "model/x-parasolid") {
    return "parasolid";
  }
  // STEP/IGES/BREP render in the browser via OpenCascade WASM, so the server
  // only needs to accept and validate them here.
  if (
    (extension === "step" || extension === "stp") &&
    ["model/step", "application/step", "application/x-step", "text/plain", "application/octet-stream"].includes(contentType)
  ) return "step";
  if (
    (extension === "iges" || extension === "igs") &&
    ["model/iges", "text/plain", "application/octet-stream"].includes(contentType)
  ) return "step";
  if (
    (extension === "brep" || extension === "brp") &&
    ["model/brep", "application/octet-stream"].includes(contentType)
  ) return "step";
  return null;
}

export function partsPreviewMaxBytes(fileName: string, contentType: string): number | null {
  const kind = partsPreviewKind(fileName, contentType);
  if (kind === "image") return 25 * MIB;
  if (kind === "glb" || kind === "stl") return 100 * MIB;
  if (kind === "parasolid") return 200 * MIB;
  if (kind === "step") return 200 * MIB;
  return null;
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

export function validatePartsPreviewFile(
  fileName: string,
  contentType: string,
  data: Buffer,
): string | null {
  if (
    !fileName ||
    fileName.length > 255 ||
    /[\\/\u0000-\u001f\u007f]/.test(fileName)
  ) {
    return "Use a file name without path separators or control characters.";
  }
  const maxBytes = partsPreviewMaxBytes(fileName, contentType);
  if (maxBytes === null) {
    return "Choose a JPEG, PNG, WebP, GIF, GLB, STL, X_T, or X_B file.";
  }
  if (data.length === 0) return "The preview file is empty.";
  if (data.length > maxBytes) {
    return `This file exceeds the ${Math.floor(maxBytes / MIB)} MB upload limit for its type.`;
  }
  const kind = partsPreviewKind(fileName, contentType);
  if (kind === "image") {
    const valid =
      (contentType === "image/png" && data.length >= 8 &&
        data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (contentType === "image/jpeg" && data.length >= 3 &&
        data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) ||
      (contentType === "image/webp" && data.length >= 12 &&
        data.toString("ascii", 0, 4) === "RIFF" &&
        data.toString("ascii", 8, 12) === "WEBP") ||
      (contentType === "image/gif" && data.length >= 6 &&
        /^GIF8[79]a$/.test(data.toString("ascii", 0, 6)));
    if (!valid) return "The image file contents do not match the selected image type.";
  }
  if (kind === "glb" && !(
    data.length >= 20 &&
    data.toString("ascii", 0, 4) === "glTF" &&
    data.readUInt32LE(4) === 2 &&
    data.readUInt32LE(8) === data.length
  )) {
    return "This is not a valid GLB 2.0 model.";
  }
  if (kind === "stl" && !isValidStl(data)) {
    return "This is not a valid STL model.";
  }
  if (kind === "parasolid") {
    const extension = fileName.toLowerCase().split(".").pop();
    if (extension === "x_t" && (
      data.length < 16 ||
      data.subarray(0, Math.min(data.length, 512)).includes(0)
    )) {
      return "This X_T file does not look like a readable Parasolid text model.";
    }
    if (extension === "x_b" && data.length < 32) {
      return "This X_B file is too small to be a Parasolid binary model.";
    }
  }
  return null;
}