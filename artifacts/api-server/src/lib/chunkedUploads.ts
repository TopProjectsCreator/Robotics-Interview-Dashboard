import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { eq } from "drizzle-orm";
import { db, pool, chunkedUploadsTable } from "@workspace/db";

// Large files are uploaded in parts straight from the browser to Supabase
// Storage using signed URLs. Nothing large ever passes through the API
// process, which keeps a 512 MB Render instance from being OOM-killed, and
// each part stays under the plan's 50 MB per-object ceiling.
//
// Layout: parts are stored as `uploads/<uploadId>/<partIndex>`; the
// `chunked_uploads` row is the manifest used to stream them back in order.

export const CHUNK_PART_BYTES = 40 * 1024 * 1024;
export const CHUNKED_UPLOAD_THRESHOLD_BYTES = CHUNK_PART_BYTES;

const BUCKET_PREFIX = "uploads";

export function chunkStoragePath(uploadId: string, partIndex: number): string {
  return `${BUCKET_PREFIX}/${uploadId}/${partIndex}`;
}

export function isChunkUploadId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function newUploadId(): string {
  return randomUUID();
}

export async function getChunkUpload(uploadId: string) {
  const [row] = await db.select().from(chunkedUploadsTable).where(eq(chunkedUploadsTable.uploadId, uploadId)).limit(1);
  return row ?? null;
}

export async function deleteChunkParts(uploadId: string, totalParts: number): Promise<void> {
  const paths = Array.from({ length: totalParts }, (_, index) => chunkStoragePath(uploadId, index));
  if (!paths.length) return;
  await pool.query(
    `delete from storage.objects where bucket_id = $1 and name = any($2::text[])`,
    [process.env.SUPABASE_STORAGE_BUCKET || "app-uploads", paths],
  );
}

/**
 * Streams a chunked object to the client one part at a time. Parts are
 * fetched with fetch() and piped, so peak memory stays at one stream rather
 * than the whole file.
 */
export async function streamChunkedUpload(
  uploadId: string,
  res: { write: (chunk: Uint8Array) => boolean; end: () => void; destroy?: (error?: Error) => void },
  signPartUrl: (path: string) => Promise<string>,
): Promise<{ contentType: string; fileName: string; sizeBytes: number }> {
  const manifest = await getChunkUpload(uploadId);
  if (!manifest) throw new Error("Chunked upload not found");

  // One pipeline for the whole object: piping per part would end the response
  // after the first part and silently truncate the download.
  async function* parts() {
    for (let index = 0; index < manifest!.totalParts; index += 1) {
      const signedUrl = await signPartUrl(chunkStoragePath(uploadId, index));
      const upstream = await fetch(signedUrl);
      if (!upstream.ok || !upstream.body) {
        throw new Error(`Part ${index} is missing from storage`);
      }
      const reader = (upstream.body as ReadableStream<Uint8Array>).getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) yield value;
      }
    }
  }

  await pipeline(Readable.from(parts()), res as never);

  return {
    contentType: manifest.contentType,
    fileName: manifest.fileName,
    sizeBytes: manifest.sizeBytes,
  };
}
