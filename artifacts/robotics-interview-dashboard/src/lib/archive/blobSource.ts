/**
 * A ByteSource over an in-memory Blob, for the archive library's range reads.
 * The archive reader uses random access so it never inflates the whole file;
 * Blob.slice + arrayBuffer gives the same semantics without copying the blob.
 */
import type { ByteSource } from "./types";

export function blobByteSource(blob: Blob): ByteSource {
  return {
    size: blob.size,
    read: async (start: number, end: number) => {
      const slice = blob.slice(start, end + 1);
      const buffer = await slice.arrayBuffer();
      return new Uint8Array(buffer);
    },
  };
}
