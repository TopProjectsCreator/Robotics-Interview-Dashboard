import type {
  PartsImageIdentification,
  PartsImageIdentificationInput,
} from "@workspace/api-zod";

export const PARTS_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const PARTS_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export function decodePartsImage(
  input: PartsImageIdentificationInput,
): { bytes: Buffer; contentType: (typeof PARTS_IMAGE_CONTENT_TYPES)[number] } | null {
  if (!PARTS_IMAGE_CONTENT_TYPES.includes(input.contentType as (typeof PARTS_IMAGE_CONTENT_TYPES)[number])) {
    return null;
  }
  if (
    input.imageBase64.length === 0 ||
    input.imageBase64.length > 4 * Math.ceil(PARTS_IMAGE_MAX_BYTES / 3) ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.imageBase64)
  ) {
    return null;
  }

  const bytes = Buffer.from(input.imageBase64, "base64");
  if (
    bytes.length === 0 ||
    bytes.length > PARTS_IMAGE_MAX_BYTES ||
    bytes.toString("base64") !== input.imageBase64
  ) {
    return null;
  }

  const matchesSignature =
    (input.contentType === "image/jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (input.contentType === "image/png" &&
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
    (input.contentType === "image/webp" &&
      bytes.length >= 12 &&
      bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP");

  return matchesSignature
    ? { bytes, contentType: input.contentType as (typeof PARTS_IMAGE_CONTENT_TYPES)[number] }
    : null;
}

export function parsePartsImageIdentification(
  content: string | null | undefined,
): PartsImageIdentification | null {
  if (typeof content !== "string" || content.trim() === "") return null;
  const normalized = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let candidate: unknown;
  try {
    candidate = JSON.parse(normalized);
  } catch {
    return null;
  }

  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) return null;
  const result = candidate as Record<string, unknown>;
  if (typeof result.identified !== "boolean") return null;
  if (result.identified && (typeof result.name !== "string" || result.name.trim().length === 0)) {
    return null;
  }
  if (!result.identified) {
    result.name = "";
    result.category = null;
    result.description = null;
    result.sku = null;
  }
  if (typeof result.name === "string") result.name = result.name.trim();
  if (typeof result.category === "string") result.category = result.category.trim() || null;
  if (typeof result.description === "string") result.description = result.description.trim() || null;
  if (typeof result.sku === "string") result.sku = result.sku.trim() || null;
  if (typeof result.uncertaintyReason === "string") {
    result.uncertaintyReason = result.uncertaintyReason.trim() || null;
  }
  return {
    identified: result.identified,
    name: result.name,
    category: result.category,
    description: result.description,
    sku: result.sku,
    uncertainty: result.uncertainty,
    uncertaintyReason: result.uncertaintyReason,
  } as unknown as PartsImageIdentification;
}
