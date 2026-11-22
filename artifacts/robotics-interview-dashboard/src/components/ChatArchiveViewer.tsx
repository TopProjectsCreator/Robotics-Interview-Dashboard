/**
 * Browser-only archive preview for chat/workspace attachments.
 *
 * Uses the existing random-access archive library: the container is never
 * inflated whole, and each entry is extracted on demand with a hard size cap.
 * Clicking an entry previews text/images in-place or offers a download for
 * binary members. Nothing from inside the archive is sent to the server.
 */
import { useEffect, useMemo, useRef, useState } from "react";

import { blobByteSource } from "../lib/archive/blobSource";
import { entryBaseName, entryExtension, formatBytes, type ArchiveEntry, type ArchiveListing } from "../lib/archive/types";
import { openZip } from "../lib/archive/zip";
import { looksLikeGzip, looksLikeTar, openGzip, openTar } from "../lib/archive/tar";
import { classifyFile } from "../lib/fileFormats";

type ChatArchiveViewerProps = {
  name: string;
  blob: Blob;
};

const TEXT_LIKE = /\.(txt|md|csv|tsv|json|yaml|yml|xml|html?|css|js|jsx|ts|tsx|py|rb|go|rs|java|kt|swift|c|h|cc|cpp|hpp|cs|php|sh|sql|log|ini|cfg|conf|toml|gitignore|dockerfile|makefile)$/i;
const ENTRY_MIME_TYPES: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  csv: "text/csv",
  gif: "image/gif",
  ics: "text/calendar",
  ifb: "text/calendar",
  json: "application/json",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  md: "text/markdown",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  pdf: "application/pdf",
  png: "image/png",
  svg: "image/svg+xml",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  wav: "audio/wav",
  webm: "video/webm",
  webp: "image/webp",
};

export function ChatArchiveViewer({ name, blob }: ChatArchiveViewerProps) {
  const [listing, setListing] = useState<ArchiveListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ArchiveEntry | null>(null);
  const [entryData, setEntryData] = useState<{ text?: string; url?: string } | null>(null);
  const [entryError, setEntryError] = useState<string | null>(null);
  const entryUrlRef = useRef<string | null>(null);
  const listingRef = useRef<ArchiveListing | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setListing(null);
    setError(null);
    setSelected(null);
    setEntryData(null);
    void (async () => {
      try {
        const head = new Uint8Array(await blob.slice(0, 300).arrayBuffer());
        let opened: ArchiveListing;
        if (looksLikeGzip(head)) opened = await openGzip(new Uint8Array(await blob.arrayBuffer()));
        else if (looksLikeTar(head)) opened = openTar(new Uint8Array(await blob.arrayBuffer()));
        else opened = await openZip(blobByteSource(blob), controller.signal);
        if (active) { listingRef.current = opened; setListing(opened); }
        else opened.dispose();
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "This archive could not be opened.");
      }
    })();
    return () => {
      active = false;
      controller.abort();
      listingRef.current?.dispose();
      listingRef.current = null;
      if (entryUrlRef.current) URL.revokeObjectURL(entryUrlRef.current);
    };
  }, [blob]);

  const directories = useMemo(() => {
    if (!listing) return [];
    const set = new Set<string>();
    for (const entry of listing.entries) {
      const parts = entry.path.split("/");
      parts.slice(0, -1).forEach((part, index) => set.add(parts.slice(0, index + 1).join("/")));
    }
    return [...set].sort();
  }, [listing]);

  const openEntry = async (entry: ArchiveEntry) => {
    if (!listing || entry.isDirectory) return;
    setSelected(entry);
    setEntryData(null);
    setEntryError(null);
    if (entryUrlRef.current) { URL.revokeObjectURL(entryUrlRef.current); entryUrlRef.current = null; }
    try {
      const bytes = await listing.read(entry.path);
      const format = classifyFile(entry.name, "");
      const mime = ENTRY_MIME_TYPES[entryExtension(entry.name)] ?? "application/octet-stream";
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
      entryUrlRef.current = url;
      if (TEXT_LIKE.test(entry.name) || format === "text") {
        setEntryData({ text: new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 250000), url });
      } else {
        setEntryData({ url });
      }
    } catch (cause) {
      setEntryError(cause instanceof Error ? cause.message : "This entry could not be extracted.");
    }
  };

  if (error)
    return (
      <div className="my-2 rounded-xl border border-[#e0b8b4] bg-[#fff8f7] p-3 text-xs text-[#a34d46]" role="alert">
        <p>{name}: {error}</p>
      </div>
    );

  if (!listing)
    return <div className="my-2 h-24 animate-pulse rounded-xl bg-[#edf4f3]" aria-label={`Opening ${name}`} />;

  const files = listing.entries.filter((entry) => !entry.isDirectory);

  return (
    <div className="my-2 overflow-hidden rounded-xl border border-[#dce9e8] bg-white" data-testid="chat-archive-preview">
      <div className="border-b border-[#dce9e8] bg-[#edf4f3] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">
        {name} · {files.length} files · {formatBytes(blob.size)}
      </div>
      {directories.length > 0 && (
        <div className="border-b border-[#eef3f2] px-3 py-1.5 text-[10px] text-[#7c8c91]">
          Folders: {directories.slice(0, 8).join(", ")}{directories.length > 8 ? "…" : ""}
        </div>
      )}
      <div className="max-h-[260px] overflow-auto">
        {files.slice(0, 200).map((entry) => (
          <button
            type="button"
            key={entry.path}
            onClick={() => void openEntry(entry)}
            data-testid={`chat-archive-entry-${entry.path}`}
            className="flex w-full items-center justify-between gap-3 border-b border-[#eef3f2] px-3 py-1.5 text-left text-xs text-[#52666e] hover:bg-[#f7faf9]"
          >
            <span className="truncate">{entryBaseName(entry.path)}</span>
            <span className="shrink-0 font-mono text-[10px] text-[#809196]">{formatBytes(entry.size)}</span>
          </button>
        ))}
        {files.length > 200 && <p className="px-3 py-1.5 text-[10px] text-[#7c8c91]">Showing the first 200 of {files.length} files.</p>}
      </div>
      {selected && (
        <div className="border-t border-[#dce9e8] p-3">
          <p className="mb-2 text-[11px] font-semibold text-[#183a4b]">{entryBaseName(selected.path)}</p>
          {entryError && <p className="text-xs text-[#a34d46]">{entryError}</p>}
          {entryData?.text !== undefined && (
            <pre className="max-h-[240px] overflow-auto whitespace-pre-wrap rounded-lg bg-[#f7faf9] p-2 text-[11px] text-[#52666e]">{entryData.text}</pre>
          )}
          {entryData?.url && (
            <div className="space-y-2">
              {classifyFile(selected.name, "") === "image"
                ? <img src={entryData.url} alt={selected.name} className="max-h-[320px] max-w-full rounded-lg object-contain" />
                : classifyFile(selected.name, "") === "pdf"
                  ? <iframe title={selected.name} src={entryData.url} className="h-[320px] w-full rounded-lg" />
                  : classifyFile(selected.name, "") === "video"
                    ? <video src={entryData.url} controls className="max-h-[320px] max-w-full rounded-lg" />
                    : classifyFile(selected.name, "") === "audio"
                      ? <audio src={entryData.url} controls className="w-full" />
                      : <p className="text-xs text-[#7c8c91]">This file is ready to download.</p>}
            </div>
          )}
          {entryData?.url && (
            <a href={entryData.url} download={selected.name} className="mt-2 inline-block text-xs font-semibold text-[#16869a] underline underline-offset-2">
              Download {selected.name}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
