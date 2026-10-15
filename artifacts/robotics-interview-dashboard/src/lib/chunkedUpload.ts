import { abortChunkUpload, createChunkUploadUrl, completeChunkUpload } from "@workspace/api-client-react";

/** Parts stay well under the storage plan's 50 MB per-object ceiling. */
export const CHUNK_PART_BYTES = 40 * 1024 * 1024;

/** Above this, a single request would be buffered by the API and can OOM it. */
export const CHUNKED_THRESHOLD_BYTES = CHUNK_PART_BYTES;

export function shouldUseChunkedUpload(size: number): boolean {
  return size > CHUNKED_THRESHOLD_BYTES;
}

export type ChunkedProgress = (uploadedBytes: number, totalBytes: number) => void;

function newUploadId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Uploads a large file in parts, each PUT straight to Supabase Storage using a
 * short-lived signed URL. The file itself never passes through the API
 * process, so uploads of any size avoid exhausting server memory.
 *
 * Returns the object path to store on the message/record, in the same
 * `/objects/chunk/<uploadId>` form the download route understands.
 */
export async function uploadChunked(
  file: Blob,
  fileName: string,
  contentType: string,
  onProgress?: ChunkedProgress,
): Promise<string> {
  const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_PART_BYTES));
  const uploadParts = async (
    uploadId: string,
    requestedInstance?: "primary" | "secondary",
  ): Promise<"primary" | "secondary"> => {
    let storageInstance = requestedInstance;
    for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
      const start = partIndex * CHUNK_PART_BYTES;
      const end = Math.min(start + CHUNK_PART_BYTES, file.size);
      const part = file.slice(start, end);
      try {
        const { signedUrl, storageInstance: resolvedInstance } = await createChunkUploadUrl({
          uploadId,
          partIndex,
          storageInstance,
        });
        storageInstance = resolvedInstance;
        const put = await fetch(signedUrl, {
          method: "PUT",
          headers: { "Content-Type": contentType || "application/octet-stream" },
          body: part,
        });
        if (!put.ok) {
          throw Object.assign(new Error(`Part ${partIndex + 1} of ${totalParts} failed (HTTP ${put.status})`), {
            storageInstance,
          });
        }
        onProgress?.(end, file.size);
      } catch (error) {
        if (error && typeof error === "object" && !("storageInstance" in error)) {
          Object.assign(error, { storageInstance: storageInstance ?? "primary" });
        }
        throw error;
      }
    }
    return storageInstance ?? "primary";
  };

  let uploadId = newUploadId();
  let storageInstance: "primary" | "secondary";
  try {
    storageInstance = await uploadParts(uploadId);
  } catch (error) {
    const failedInstance = error && typeof error === "object" && "storageInstance" in error
      ? (error as { storageInstance?: unknown }).storageInstance
      : null;
    if (failedInstance !== "primary") throw error;
    await abortChunkUpload({ uploadId, totalParts, storageInstance: "primary" }).catch(() => undefined);
    // A signed primary URL can be minted even when the subsequent PUT is
    // rejected by a quota limit. Restart the complete file on the secondary so
    // every part of the manifest lives in one bucket.
    uploadId = newUploadId();
    onProgress?.(0, file.size);
    storageInstance = await uploadParts(uploadId, "secondary");
  }

  const { objectPath } = await completeChunkUpload({
    uploadId,
    fileName,
    contentType: contentType || "application/octet-stream",
    sizeBytes: file.size,
    totalParts,
    partSizeBytes: CHUNK_PART_BYTES,
    storageInstance,
  });
  return objectPath;
}
