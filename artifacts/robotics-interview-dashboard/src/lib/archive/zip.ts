import { inflateSync } from "fflate";

import {
  ARCHIVE_LIMITS,
  type ArchiveEntry,
  type ArchiveListing,
  type ByteSource,
  ArchiveError,
  entryExtension,
  sanitizeEntryPath,
} from "./types";

/**
 * Zip reader built on HTTP range access rather than whole-file buffering.
 *
 * The End Of Central Directory sits at the very end of the file, the central
 * directory itself sits just before it, and each entry's compressed bytes are
 * addressed from there. That means opening a 2 GB archive costs three small
 * reads rather than 2 GB of tab memory, and extracting one member costs one
 * more. Nothing is ever inflated in bulk, which is also what makes a
 * decompression bomb harmless here.
 */

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const CENTRAL_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_HEADER_SIGNATURE = 0x04034b50;

const EOCD_MIN_SIZE = 22;
const CENTRAL_HEADER_SIZE = 46;
const LOCAL_HEADER_SIZE = 30;

/** Compression methods with a decoder in the browser. */
const METHOD_STORED = 0;
const METHOD_DEFLATE = 8;

const ZIP64_EXTRA_ID = 0x0001;

const decoder = new TextDecoder("utf-8", { fatal: false });

function matchesSignature(bytes: Uint8Array, offset: number, signature: number): boolean {
  if (offset < 0 || offset + 4 > bytes.length) return false;
  // `&` binds tighter than `===`, so the masks MUST be wrapped: without
  // them this compared the byte to `signature & 0xff` instead of masking
  // both sides, which broke every signature match.
  return (
    (bytes[offset] & 0xff) === (signature & 0xff) &&
    (bytes[offset + 1] & 0xff) === ((signature >>> 8) & 0xff) &&
    (bytes[offset + 2] & 0xff) === ((signature >>> 16) & 0xff) &&
    (bytes[offset + 3] & 0xff) === ((signature >>> 24) & 0xff)
  );
}

/**
 * Locates the End Of Central Directory inside the tail of the file.
 *
 * A trailing comment can push the record back by up to 65535 bytes, so the
 * scan covers the largest legal tail plus the record itself.
 */
function findEndOfCentralDirectory(tail: Uint8Array): number {
  const earliest = Math.max(0, tail.length - (ARCHIVE_LIMITS.maxEndSearchBytes + EOCD_MIN_SIZE));
  for (let index = tail.length - EOCD_MIN_SIZE; index >= earliest; index -= 1) {
    if (matchesSignature(tail, index, EOCD_SIGNATURE)) return index;
  }
  return -1;
}

type DirectoryLocation = {
  entryCount: number;
  directoryOffset: number;
  directorySize: number;
};

/**
 * Reads the central directory location from the tail, following the zip64
 * locator when the classic fields are saturated. Archives above 4 GB or with
 * more than 65535 members store the real values in a zip64 record instead.
 */
async function locateCentralDirectory(source: ByteSource, signal?: AbortSignal): Promise<DirectoryLocation> {
  const tailStart = Math.max(0, source.size - (ARCHIVE_LIMITS.maxEndSearchBytes + EOCD_MIN_SIZE));
  const tail = await source.read(tailStart, source.size - 1, signal);
  const eocd = findEndOfCentralDirectory(tail);
  if (eocd < 0) {
    throw new ArchiveError("This zip file has no readable directory. It may be corrupt or split across several files.");
  }

  const view = new DataView(tail.buffer, tail.byteOffset, tail.byteLength);
  const entryCount = view.getUint16(eocd + 10, true);
  let directorySize = view.getUint32(eocd + 12, true);
  let directoryOffset = view.getUint32(eocd + 16, true);

  const needsZip64 =
    entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff;
  if (!needsZip64) return { entryCount, directoryOffset, directorySize };

  const locator = eocd - 20;
  if (locator < 0 || !matchesSignature(tail, locator, ZIP64_EOCD_LOCATOR_SIGNATURE)) {
    throw new ArchiveError("This zip file uses a zip64 directory that could not be located.");
  }

  const zip64Offset = Number(view.getBigUint64(locator + 8, true));
  if (!Number.isSafeInteger(zip64Offset) || zip64Offset < 0 || zip64Offset >= source.size) {
    throw new ArchiveError("This zip file reports a directory outside the file.");
  }

  const zip64Header = await source.read(zip64Offset, zip64Offset + 55, signal);
  if (!matchesSignature(zip64Header, 0, ZIP64_EOCD_SIGNATURE)) {
    throw new ArchiveError("This zip file has a damaged zip64 directory record.");
  }
  const zip64View = new DataView(zip64Header.buffer, zip64Header.byteOffset, zip64Header.byteLength);
  return {
    entryCount: Number(zip64View.getBigUint64(32, true)),
    directorySize: Number(zip64View.getBigUint64(40, true)),
    directoryOffset: Number(zip64View.getBigUint64(48, true)),
  };
}

type CentralRecord = ArchiveEntry & {
  method: number;
  localHeaderOffset: number;
  compressedSize: number;
};

/**
 * Applies the zip64 extended-information field.
 *
 * Only the members the classic header saturated are present, in a fixed order,
 * so each is consumed only when its 32-bit slot was 0xffffffff.
 */
function applyZip64Extra(
  record: CentralRecord,
  extra: Uint8Array,
  saturated: { size: boolean; compressedSize: boolean; offset: boolean },
): void {
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const view = new DataView(extra.buffer, extra.byteOffset + cursor, extra.byteLength - cursor);
    const headerId = view.getUint16(0, true);
    const dataSize = view.getUint16(2, true);
    const body = cursor + 4;
    if (headerId !== ZIP64_EXTRA_ID || body + dataSize > extra.length) {
      cursor = body + dataSize;
      continue;
    }
    const fieldView = new DataView(extra.buffer, extra.byteOffset + body, dataSize);
    let field = 0;
    if (saturated.size && field + 8 <= dataSize) {
      record.size = Number(fieldView.getBigUint64(field, true));
      field += 8;
    }
    if (saturated.compressedSize && field + 8 <= dataSize) {
      record.compressedSize = Number(fieldView.getBigUint64(field, true));
      field += 8;
    }
    if (saturated.offset && field + 8 <= dataSize) {
      record.localHeaderOffset = Number(fieldView.getBigUint64(field, true));
    }
    return;
  }
}

/** Walks the central directory, turning each header into a listing entry. */
function parseCentralDirectory(bytes: Uint8Array): CentralRecord[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const records: CentralRecord[] = [];
  let cursor = 0;

  while (cursor + CENTRAL_HEADER_SIZE <= bytes.length) {
    if (!matchesSignature(bytes, cursor, CENTRAL_HEADER_SIGNATURE)) break;

    const compressedSizeRaw = view.getUint32(cursor + 20, true);
    const sizeRaw = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffsetRaw = view.getUint32(cursor + 42, true);

    const nameStart = cursor + CENTRAL_HEADER_SIZE;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > bytes.length) break;

    if (records.length >= ARCHIVE_LIMITS.maxEntries) {
      throw new ArchiveError(
        `This archive lists more than ${ARCHIVE_LIMITS.maxEntries.toLocaleString()} files, which is more than the browser will open.`,
      );
    }

    // A trailing slash is how zip marks a directory, but sanitizeEntryPath
    // strips it, so the intent has to be read off the raw name.
    const rawName = decoder.decode(bytes.subarray(nameStart, nameEnd));
    const path = sanitizeEntryPath(rawName);

    if (path) {
      const record: CentralRecord = {
        path,
        name: path.slice(path.lastIndexOf("/") + 1) || path,
        isDirectory: rawName.endsWith("/"),
        size: sizeRaw,
        compressedSize: compressedSizeRaw,
        extension: entryExtension(path),
        method: view.getUint16(cursor + 10, true),
        localHeaderOffset: localHeaderOffsetRaw,
      };
      const extraEnd = Math.min(nameEnd + extraLength, bytes.length);
      if (extraEnd > nameEnd) {
        applyZip64Extra(record, bytes.subarray(nameEnd, extraEnd), {
          size: sizeRaw === 0xffffffff,
          compressedSize: compressedSizeRaw === 0xffffffff,
          offset: localHeaderOffsetRaw === 0xffffffff,
        });
      }
      records.push(record);
    }

    cursor = nameEnd + extraLength + commentLength;
  }

  return records;
}

/**
 * Decompresses one entry. The local header supplies the true name and extra
 * lengths, which may differ from the central directory's, so the data offset
 * has to be recomputed rather than trusted.
 */
async function extractRecord(
  source: ByteSource,
  record: CentralRecord,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  if (record.isDirectory) {
    throw new ArchiveError(`${record.name} is a folder, not a file.`);
  }
  if (record.size > ARCHIVE_LIMITS.maxEntryBytes) {
    throw new ArchiveError(
      `${record.name} expands to more than ${Math.round(ARCHIVE_LIMITS.maxEntryBytes / 1024 ** 3)} GB, which is too large to open in a browser tab.`,
    );
  }
  if (record.method !== METHOD_STORED && record.method !== METHOD_DEFLATE) {
    throw new ArchiveError(`${record.name} uses a compression method this browser cannot expand.`);
  }

  const header = await source.read(record.localHeaderOffset, record.localHeaderOffset + LOCAL_HEADER_SIZE - 1, signal);
  if (!matchesSignature(header, 0, LOCAL_HEADER_SIGNATURE)) {
    throw new ArchiveError(`The entry header for ${record.name} is damaged.`);
  }
  const headerView = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const nameLength = headerView.getUint16(26, true);
  const extraLength = headerView.getUint16(28, true);

  const dataStart = record.localHeaderOffset + LOCAL_HEADER_SIZE + nameLength + extraLength;
  const dataEnd = dataStart + record.compressedSize - 1;
  if (record.compressedSize === 0) return new Uint8Array(0);
  if (dataEnd >= source.size) {
    throw new ArchiveError(`The stored data for ${record.name} runs past the end of the archive.`);
  }

  const stored = await source.read(dataStart, dataEnd, signal);
  if (record.method === METHOD_STORED) return stored;
  try {
    return inflateSync(stored);
  } catch {
    throw new ArchiveError(`${record.name} could not be expanded. The archive may be corrupt.`);
  }
}

/** Opens a zip for browsing without loading the whole container. */
export async function openZip(source: ByteSource, signal?: AbortSignal): Promise<ArchiveListing> {
  const { entryCount, directoryOffset, directorySize } = await locateCentralDirectory(source, signal);
  if (directorySize > 0 && directoryOffset + directorySize > source.size) {
    throw new ArchiveError("This zip file's directory runs past the end of the file.");
  }
  if (entryCount > ARCHIVE_LIMITS.maxEntries) {
    throw new ArchiveError(
      `This archive lists ${entryCount.toLocaleString()} files, more than the ${ARCHIVE_LIMITS.maxEntries.toLocaleString()} this browser will open.`,
    );
  }
  const directoryBytes = await source.read(
    directoryOffset,
    directoryOffset + directorySize - 1,
    signal,
  );
  const records = parseCentralDirectory(directoryBytes);
  const byPath = new Map(records.map((record) => [record.path, record]));

  return {
    format: "zip",
    entries: records,
    read: (path, innerSignal) => {
      const record = byPath.get(path);
      if (!record) return Promise.reject(new ArchiveError(`${path} is not in this archive.`));
      return extractRecord(source, record, innerSignal);
    },
    dispose: () => undefined,
  };
}
