/**
 * Shared types for reading archive containers in the browser.
 *
 * Archives are opened entirely client-side. Nothing inside a compressed folder
 * is ever sent to the server: the bytes are already in the tab, and each entry
 * is inflated on demand from a `ByteSource` rather than eagerly decompressing
 * the whole container.
 */

/** Containers we can open. `libarchive` covers 7z, rar, bz2 and xz. */
export type ArchiveFormat = "gzip" | "libarchive" | "tar" | "zip";

/** One file or directory inside an archive. */
export type ArchiveEntry = {
  /** Normalised, forward-slash separated, relative to the archive root. */
  path: string;
  /** Basename, for display. */
  name: string;
  isDirectory: boolean;
  /** Size after decompression, in bytes. */
  size: number;
  /** Size as stored, in bytes. For tar and gzip this equals `size`. */
  compressedSize: number;
  /** Lowercased extension without the dot, or "" when there is none. */
  extension: string;
};

/**
 * A random-access view of the archive's bytes.
 *
 * Zip reads only the central directory and the entry the reader asked for, so
 * a multi-gigabyte archive can be browsed without ever holding it in memory.
 * Tar and gzip need the stream end to end, which is why they take a different
 * path.
 */
export type ByteSource = {
  /** Total size of the underlying file in bytes. */
  size: number;
  /** Reads the inclusive byte range [start, end]. */
  read(start: number, end: number, signal?: AbortSignal): Promise<Uint8Array>;
};

/** An opened archive: a listing plus a way to extract one entry at a time. */
export type ArchiveListing = {
  format: ArchiveFormat;
  entries: ArchiveEntry[];
  /**
   * Extracts one entry. Rejects when the entry exceeds
   * `ARCHIVE_MAX_ENTRY_BYTES`, when its compression method has no decoder in
   * the browser, or when the path is missing.
   */
  read(path: string, signal?: AbortSignal): Promise<Uint8Array>;
  /** Free any buffers held by the listing. */
  dispose(): void;
};

/** Raised for conditions the UI should explain rather than swallow. */
export class ArchiveError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, options?: { cause?: unknown }) {
    super(userMessage, options);
    this.name = "ArchiveError";
    this.userMessage = userMessage;
  }
}

/**
 * Hard limits. A compressed file is attacker-controlled input that the user
 * cannot inspect before opening, so every path that inflates bytes is bounded.
 *
 * The per-entry ceiling is the one that protects the tab: a 1 MB zip bomb
 * expands to gigabytes, and `unzipSync` without a filter would happily do it.
 * Entries are therefore extracted one at a time and never in bulk.
 */
export const ARCHIVE_LIMITS = {
  /** Entries listed before the listing is refused as implausible. */
  maxEntries: 50_000,
  /** Largest single entry we will inflate into memory. */
  maxEntryBytes: 512 * 1024 * 1024,
  /** Longest path we will accept, guarding against pax/GNU long-name abuse. */
  maxPathLength: 1024,
  /** How many bytes of the tail we scan for the zip end-of-central-directory. */
  maxEndSearchBytes: 66 * 1024,
  /** Nested archives are opened at most this deep. */
  maxNestingDepth: 3,
} as const;

/**
 * Normalises an entry path and rejects anything that escapes the archive root.
 *
 * Archive entries are never written to disk here, but a name like
 * `../../.ssh/authorized_keys` still has no business being rendered in a file
 * pane, and a UI that echoes it back is a phishing surface.
 */
export function sanitizeEntryPath(rawPath: string): string | null {
  if (!rawPath || rawPath.length > ARCHIVE_LIMITS.maxPathLength) return null;
  // Windows archives use backslashes; normalise before checking segments.
  const slashed = rawPath.replace(/\\/g, "/");
  if (slashed.startsWith("/")) return null;
  // Drive letters such as "C:/evil" are absolute paths in disguise.
  if (/^[a-z]:/i.test(slashed)) return null;
  if (slashed.includes("\0")) return null;

  const segments: string[] = [];
  for (const segment of slashed.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") return null;
    segments.push(segment);
  }
  if (!segments.length) return null;
  return segments.join("/");
}

/** Basename of a sanitised entry path. */
export function entryBaseName(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Lowercased extension without the dot, matching `fileFormats.fileExtension`. */
export function entryExtension(path: string): string {
  const base = entryBaseName(path);
  const dot = base.lastIndexOf(".");
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : "";
}

/** Human byte size for the file pane. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unitIndex]}`;
}
