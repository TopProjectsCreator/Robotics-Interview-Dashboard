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

/** How many times a single part is retried before the upload gives up. */
const PART_ATTEMPTS = 4;
const PART_RETRY_BASE_MS = 600;
const PART_RETRY_MAX_MS = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * A part that failed because the *bucket* refused it (quota, plan, policy)
 * cannot be fixed by trying the same part again, and the upload has to move
 * to the other bucket. A part that failed because the *network* dropped (no
 * response at all) is worth another attempt, and must not throw away the
 * parts that already landed.
 */
class PartUploadError extends Error {
  constructor(message: string, readonly storageInstance: "primary" | "secondary", readonly storageRejected: boolean) {
    super(message);
    this.name = "PartUploadError";
  }
}

async function putPart(
  signedUrl: string,
  part: Blob,
  contentType: string,
): Promise<void> {
  const put = await fetch(signedUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType || "application/octet-stream" },
    body: part,
  });
  if (put.ok) return;
  throw Object.assign(new Error(`HTTP ${put.status}`), { storageRejected: true });
}

/**
 * Uploads a large file in parts, each PUT straight to Supabase Storage using a
 * short-lived signed URL. The file itself never passes through the API
 * process, so uploads of any size avoid exhausting server memory.
 *
 * Each part is retried with backoff, so a single dropped packet on venue
 * wifi no longer throws away the whole upload. Parts that already landed
 * are not re-sent.
 *
 * Returns the object path to store on the message/record, in the same
 * `/objects/chunk/<uploadId>` form the download route understands.
 */
export async function uploadChunked(
  file: Blob,
  fileName: string,
  contentType: string,
  onProgress?: ChunkedProgress,
  purpose?: "cad",
): Promise<string> {
  const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_PART_BYTES));
  const uploadParts = async (
    uploadId: string,
    requestedInstance?: "primary" | "secondary",
  ): Promise<"primary" | "secondary"> => {
    let storageInstance = requestedInstance;
    // Parts already stored for this upload. A retried part is skipped, and
    // progress never goes backwards.
    const completed = new Set<number>();
    for (let partIndex = 0; partIndex < totalParts; partIndex += 1) {
      const start = partIndex * CHUNK_PART_BYTES;
      const end = Math.min(start + CHUNK_PART_BYTES, file.size);
      const part = file.slice(start, end);
      if (completed.has(partIndex)) {
        onProgress?.(end, file.size);
        continue;
      }
      let lastError: unknown;
      for (let attempt = 0; attempt < PART_ATTEMPTS; attempt += 1) {
        try {
          const { signedUrl, storageInstance: resolvedInstance } = await createChunkUploadUrl({
            uploadId,
            partIndex,
            storageInstance,
            purpose,
          });
          storageInstance = resolvedInstance;
          await putPart(signedUrl, part, contentType);
          completed.add(partIndex);
          onProgress?.(end, file.size);
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          const rejected = Boolean(error && typeof error === "object" && (error as { storageRejected?: boolean }).storageRejected);
          if (rejected) {
            // The bucket refused it. Retrying the same part will not help.
            throw new PartUploadError(
              `Part ${partIndex + 1} of ${totalParts} was rejected by storage (${(error as Error).message})`,
              storageInstance ?? "primary",
              true,
            );
          }
          if (attempt < PART_ATTEMPTS - 1) {
            // A dropped connection on venue wifi. Wait a moment and send
            // this part again; the parts that already landed stay put.
            const backoff = Math.min(PART_RETRY_BASE_MS * 2 ** attempt, PART_RETRY_MAX_MS);
            await sleep(backoff);
          }
        }
      }
      if (lastError) {
        throw new PartUploadError(
          `Part ${partIndex + 1} of ${totalParts} failed after ${PART_ATTEMPTS} attempts`,
          storageInstance ?? "primary",
          false,
        );
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
    // The primary bucket refused the file (quota, plan). Restart the
    // complete file on the secondary so every part of the manifest lives in
    // one bucket.
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
    purpose,
  });
  return objectPath;
}
