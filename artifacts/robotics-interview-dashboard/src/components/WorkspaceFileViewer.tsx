import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import DOMPurify from "dompurify";

import { getStoredAuthToken } from "../authSession";
import { classifyFile } from "../lib/fileFormats";
import { formatJsonPreview, isJsonAttachment, isOfficePreviewAttachment, parseOfficePreview } from "../lib/officePreview";
import { ChatGlbViewer } from "./ChatGlbViewer";
import { ChatArchiveViewer } from "./ChatArchiveViewer";
import { IcalViewer } from "./IcalViewer";
import { ChatParasolidViewer } from "./ChatParasolidViewer";
import { ChatStlViewer } from "./ChatStlViewer";
import { ChatStepViewer } from "./ChatStepViewer";
import { CadMeshViewer } from "./CadMeshViewer";
import { CadThreeMfViewer } from "./CadThreeMfViewer";

const ChatAttachmentTableFallback = ({ rows, label }: { rows: string[][]; label: string }) => {
  if (!rows.length) return <p className="rounded-lg bg-[#f7faf9] p-3 text-xs text-[#7c8c91]">This file is empty.</p>;
  const width = Math.max(...rows.map((row) => row.length), 1);
  const header = rows[0];
  return (
    <div className="overflow-hidden rounded-xl border border-[#dce9e8] bg-white">
      <div className="border-b border-[#dce9e8] bg-[#edf4f3] px-3 py-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">
        {label} · {rows.length} rows
      </div>
      <div className="max-h-[360px] overflow-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {Array.from({ length: width }, (_, index) => (
                <th
                  key={`head-${index}`}
                  className="sticky top-0 border-b border-[#dce9e8] bg-[#f7faf9] px-3 py-2 text-left font-semibold text-[#183a4b]"
                >
                  {header[index] || `Column ${index + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(1).map((row, rowIndex) => (
              <tr key={`row-${rowIndex}`} className="odd:bg-white even:bg-[#f7faf9]">
                {Array.from({ length: width }, (_, cellIndex) => (
                  <td
                    key={`cell-${rowIndex}-${cellIndex}`}
                    className="max-w-[260px] border-b border-[#eef3f2] px-3 py-2 align-top text-[#52666e]"
                  >
                    {row[cellIndex] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

type WorkspaceAttachmentSheet = { name: string; rows: string[][] };
type WorkspaceAttachmentKind =
  | "3mf"
  | "archive"
  | "audio"
  | "calendar"
  | "document"
  | "image"
  | "model"
  | "obj"
  | "parasolid"
  | "pdf"
  | "presentation"
  | "ply"
  | "spreadsheet"
  | "step"
  | "stl"
  | "text"
  | "video";

export function WorkspaceAttachmentPreview({
  name,
  downloadUrl,
  children,
}: {
  name: string;
  downloadUrl: string | null;
  children: ReactNode;
}) {
  return (
    <div className="my-2 space-y-2">
      {children}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download={name}
          data-testid="workspace-attachment-download"
          className="inline-flex w-fit items-center rounded-lg border border-[#d5e0e0] bg-white px-3 py-1.5 text-xs font-semibold text-[#16869a] hover:bg-[#f7faf9] dark:border-[#355663] dark:bg-[#172b38] dark:text-[#8fd7e0] dark:hover:bg-[#1c3542]"
        >
          Download {name}
        </a>
      )}
    </div>
  );
}

function workspaceAttachmentExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/**
 * Mirrors the chat attachment classifier exactly so a file renders the same
 * way in the CAD workspace as it does in chat. Extension wins when the
 * stored content type is vague; otherwise the content type decides.
 */
export function workspaceAttachmentKind(name: string, contentType: string): WorkspaceAttachmentKind {
  const format = classifyFile(name, contentType);
  switch (format) {
    case "three-mf": return "3mf";
    case "glb": return "model";
    case "step":
    case "iges":
    case "brep": return "step";
    case "archive": return "archive";
    default: return format;
  }
}

function normalizeWorkspaceFileType(type: string): string {
  return type.split(";")[0]?.trim().toLowerCase() ?? "";
}

function isHeicWorkspaceAttachment(name: string, contentType: string): boolean {
  return /^image\/hei[cf]$/i.test(contentType) || /\.hei[cf]$/i.test(name);
}

function parseDelimitedWorkspacePreview(source: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length && rows.length < 100; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }
  return rows.map((values) => values.slice(0, 18));
}

function WorkspaceAttachmentDocument({
  name,
  html,
  objectUrl,
}: {
  name: string;
  html: string | null;
  objectUrl: string | null;
}) {
  // Unknown formats always keep a usable way to get the original file. A
  // download-only card replaces the iframe when no object URL could be made,
  // so a failed/unsupported preview never leaves a blank error frame.
  if (!html && !objectUrl)
    return (
      <div className="my-2 rounded-xl border border-[#dce9e8] bg-white p-3 dark:border-[#2a3f52] dark:bg-[#10232d]" role="status">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · file ready to download</p>
        </div>
      </div>
    );
  if (html) {
    return (
      <div className="rounded-xl border border-[#dce9e8] bg-white p-4 dark:border-[#2a3f52] dark:bg-[#10232d]">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · document preview</p>
        </div>
        <div className="prose prose-sm max-w-none text-[#52666e] dark:text-[#a8bac8]" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-[#dce9e8] bg-white p-3 dark:border-[#2a3f52] dark:bg-[#10232d]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · document preview</p>
      </div>
      <iframe title={name} src={objectUrl ?? undefined} className="h-[360px] w-full rounded-lg border border-[#eef3f2] bg-[#f7faf9] dark:border-[#2a3f52] dark:bg-[#10232d]" />
    </div>
  );
}

function appRelativeWorkspaceUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || !path.startsWith("/")) return path;
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}${path}`;
}

type WorkspaceFileViewerProps = {
  /** Original file name, which selects the renderer exactly like chat. */
  name: string;
  /** Authenticated storage URL, e.g. `/api/storage/objects/<id>`. */
  src: string;
};

/**
 * Renders any CAD workspace file exactly like its chat attachment
 * counterpart: same fetch, same parsing (XLSX/Mammoth/CSV), same viewers,
 * same class names. CAD models go to the 3D viewers; images, video, audio,
 * PDFs, documents, slides, and sheets all render inline.
 */
export function WorkspaceFileViewer({ name, src }: WorkspaceFileViewerProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [attachmentBlob, setAttachmentBlob] = useState<Blob | null>(null);
  const [calendarText, setCalendarText] = useState<string | null>(null);
  const [contentType, setContentType] = useState("");
  const [text, setText] = useState<string | null>(null);
  const [sheets, setSheets] = useState<WorkspaceAttachmentSheet[]>([]);
  const [documentHtml, setDocumentHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [mediaPlaybackFailed, setMediaPlaybackFailed] = useState(false);
  const [imageFallback, setImageFallback] = useState<"converting" | "unavailable" | null>(null);
  const attachmentBlobRef = useRef<Blob | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const attemptedHeicConversionRef = useRef(false);
  const imageOperationRef = useRef(0);
  const kind = workspaceAttachmentKind(name, contentType);

  useEffect(() => {
    let active = true;
    const createdUrls = new Set<string>();
    objectUrlsRef.current = createdUrls;
    imageOperationRef.current += 1;
    const controller = new AbortController();
    const token = getStoredAuthToken();
    setObjectUrl(null);
    setDownloadUrl(null);
    setContentType("");
    setText(null);
    setSheets([]);
    setDocumentHtml(null);
    setCalendarText(null);
    setFailed(false);
    setMediaPlaybackFailed(false);
    setImageFallback(null);
    setAttachmentBlob(null);
    attachmentBlobRef.current = null;
    attemptedHeicConversionRef.current = false;
    void fetch(appRelativeWorkspaceUrl(src), {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Attachment request failed (${response.status})`);
        const responseType = normalizeWorkspaceFileType(response.headers.get("content-type") ?? "");
        const blob = await response.blob();
        const resolvedType = responseType || normalizeWorkspaceFileType(blob.type);
        if (!active) return;
        const sourceUrl = URL.createObjectURL(blob);
        createdUrls.add(sourceUrl);
        attachmentBlobRef.current = blob;
        setDownloadUrl(sourceUrl);
        setAttachmentBlob(blob);
        setContentType(resolvedType);
        const resolvedKind = workspaceAttachmentKind(name, resolvedType);
        const ensureDownloadUrl = () => {
          setObjectUrl(sourceUrl);
        };
        if (isOfficePreviewAttachment(name, resolvedType)) {
          ensureDownloadUrl();
          const preview = await parseOfficePreview(blob, name);
          if (active) setText(preview);
          return;
        }
        if (isJsonAttachment(name, resolvedType)) {
          ensureDownloadUrl();
          const preview = formatJsonPreview(await blob.text());
          if (active) setText(preview);
          return;
        }
        if (resolvedKind === "calendar") {
          const raw = await blob.text();
          if (active) setCalendarText(raw.slice(0, 250000));
          return;
        }
        if (resolvedKind === "text") {
          const raw = await blob.text();
          if (active) setText(raw.slice(0, 250000));
          return;
        }
        if (resolvedKind === "spreadsheet") {
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(await blob.arrayBuffer(), { type: "array", cellDates: true });
          const parsedSheets = workbook.SheetNames.slice(0, 8).map((sheetName) => ({
            name: sheetName,
            rows: (XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, raw: false, defval: "" }) as unknown[][])
              .slice(0, 100)
              .map((row) => row.slice(0, 18).map((cell) => String(cell ?? ""))),
          }));
          if (active) setSheets(parsedSheets);
          return;
        }
        if (resolvedKind === "document" && /\.(docx)$/i.test(name)) {
          ensureDownloadUrl();
          const mammoth = await import("mammoth");
          const documentBytes = await blob.arrayBuffer();
          const converted = await mammoth.convertToHtml({
            arrayBuffer: documentBytes,
            buffer: documentBytes,
          } as unknown as Parameters<typeof mammoth.convertToHtml>[0]);
          const clean = DOMPurify.sanitize(converted.value, { USE_PROFILES: { html: true } });
          if (active) setDocumentHtml(clean);
          return;
        }
        setObjectUrl(sourceUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      controller.abort();
      imageOperationRef.current += 1;
      attachmentBlobRef.current = null;
      for (const createdUrl of createdUrls) URL.revokeObjectURL(createdUrl);
      createdUrls.clear();
    };
  }, [name, src]);

  const handleImageError = async () => {
    if (!isHeicWorkspaceAttachment(name, contentType) || attemptedHeicConversionRef.current) {
      setImageFallback("unavailable");
      return;
    }
    const sourceBlob = attachmentBlobRef.current;
    if (!sourceBlob) {
      setImageFallback("unavailable");
      return;
    }

    attemptedHeicConversionRef.current = true;
    setImageFallback("converting");
    setObjectUrl(null);
    const operationId = ++imageOperationRef.current;
    try {
      const { default: heic2any } = await import("heic2any");
      const converted = await heic2any({ blob: sourceBlob, toType: "image/jpeg", quality: 0.85 });
      const jpegBlob = Array.isArray(converted) ? converted[0] : converted;
      if (!(jpegBlob instanceof Blob)) throw new Error("HEIC conversion returned no image");
      if (imageOperationRef.current !== operationId) return;

      const previewUrl = URL.createObjectURL(new Blob([jpegBlob], { type: "image/jpeg" }));
      objectUrlsRef.current.add(previewUrl);
      setObjectUrl(previewUrl);
      setImageFallback(null);
    } catch {
      if (imageOperationRef.current === operationId) setImageFallback("unavailable");
    }
  };

  if (failed)
    return (
      <div className="my-2 rounded-xl border border-[#e0b8b4] bg-[#fff8f7] p-3 text-xs text-[#a34d46] dark:border-[#70413b] dark:bg-[#2c1d1d] dark:text-[#f1aaa4]" role="alert">
        <p>Couldn’t preview {name}. The file may be malformed or use unsupported content.</p>
        <a href={objectUrl ?? appRelativeWorkspaceUrl(src)} download={name} className="mt-1 inline-block font-semibold underline underline-offset-2">Download {name}</a>
      </div>
    );
  if (mediaPlaybackFailed && (kind === "video" || kind === "audio")) {
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="rounded-xl border border-[#dce9e8] bg-[#f7faf9] p-3 text-xs text-[#52666e]" role="status">
          Couldn’t play {name} in this browser. Try opening it in an app that supports this format.
        </div>
      </WorkspaceAttachmentPreview>
    );
  }
  if (kind === "image" && imageFallback === "converting") {
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="rounded-xl border border-[#dce9e8] bg-[#f7faf9] p-3 text-xs text-[#52666e]" role="status">
          Preparing a preview for {name}…
        </div>
      </WorkspaceAttachmentPreview>
    );
  }
  if (kind === "image" && imageFallback === "unavailable") {
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="rounded-xl border border-[#dce9e8] bg-[#f7faf9] p-3 text-xs text-[#52666e]" role="status">
          {isHeicWorkspaceAttachment(name, contentType)
            ? `Couldn’t preview ${name}. Try opening it in an app that supports HEIC.`
            : `Couldn’t preview ${name} in this browser.`}
        </div>
      </WorkspaceAttachmentPreview>
    );
  }
  if (!objectUrl && text === null && !sheets.length && documentHtml === null && calendarText === null)
    return downloadUrl
      ? (
          <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
            <div className="h-24 animate-pulse rounded-xl bg-[#edf4f3]" aria-label={`Loading ${name}`} />
          </WorkspaceAttachmentPreview>
        )
      : <div className="my-2 h-24 animate-pulse rounded-xl bg-[#edf4f3]" aria-label={`Loading ${name}`} />;

  if (calendarText !== null)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <IcalViewer name={name} text={calendarText} />
      </WorkspaceAttachmentPreview>
    );
  if (text !== null) {
    const extension = workspaceAttachmentExtension(name);
    const delimiter = extension === "tsv" ? "\t" : text.split("\n")[0]?.includes("\t") ? "\t" : ",";
    const isDelimited =
      ["csv", "tsv"].includes(extension) || contentType === "text/csv" || contentType === "text/tab-separated-values";
    const rows = isDelimited ? parseDelimitedWorkspacePreview(text, delimiter) : [];
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="space-y-2">
          {rows.length > 0 ? (
            <ChatAttachmentTableFallback rows={rows} label={name} />
          ) : (
            <pre aria-label={`Preview of ${name}`} data-testid="text-attachment-preview" className="max-h-[360px] overflow-auto whitespace-pre-wrap rounded-xl border border-[#dce9e8] bg-[#f7faf9] p-3 text-xs leading-5 text-[#52666e] dark:border-[#2a3f52] dark:bg-[#10232d] dark:text-[#a8bac8]">
              {text}
            </pre>
          )}
        </div>
      </WorkspaceAttachmentPreview>
    );
  }
  if (sheets.length)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="space-y-3">
          {sheets.map((sheet) => (
            <ChatAttachmentTableFallback key={sheet.name} rows={sheet.rows} label={`${name} · ${sheet.name}`} />
          ))}
        </div>
      </WorkspaceAttachmentPreview>
    );
  if (kind === "image" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <img
          src={objectUrl}
          alt={name}
          loading="lazy"
          onError={() => void handleImageError()}
          className="block max-h-[520px] max-w-full rounded-xl border border-[#dce9e8] object-contain"
        />
      </WorkspaceAttachmentPreview>
    );
  if (kind === "video" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <video
          src={objectUrl}
          controls
          preload="metadata"
          onError={() => setMediaPlaybackFailed(true)}
          className="max-h-[520px] max-w-full rounded-xl border border-[#dce9e8] bg-[#183a4b]"
        />
      </WorkspaceAttachmentPreview>
    );
  if (kind === "audio" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <audio src={objectUrl} controls onError={() => setMediaPlaybackFailed(true)} className="w-full max-w-[440px]" />
      </WorkspaceAttachmentPreview>
    );
  if (kind === "pdf" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <iframe title={name} src={objectUrl} className="h-[520px] w-full rounded-xl border border-[#dce9e8] bg-white" />
      </WorkspaceAttachmentPreview>
    );
  if (kind === "archive" && attachmentBlob)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <ChatArchiveViewer name={name} blob={attachmentBlob} />
      </WorkspaceAttachmentPreview>
    );
  if (kind === "parasolid" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <Suspense fallback={<p className="text-xs text-[#7c8c91]">Loading preview…</p>}>
          <ChatParasolidViewer name={name} src={objectUrl} />
        </Suspense>
      </WorkspaceAttachmentPreview>
    );
  if (kind === "model" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <Suspense fallback={<p className="text-xs text-[#7c8c91]">Loading preview…</p>}>
          <ChatGlbViewer name={name} src={objectUrl} />
        </Suspense>
      </WorkspaceAttachmentPreview>
    );
  if (kind === "stl" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <Suspense fallback={<p className="text-xs text-[#7c8c91]">Loading preview…</p>}>
          <ChatStlViewer name={name} src={objectUrl} />
        </Suspense>
      </WorkspaceAttachmentPreview>
    );
  if (kind === "3mf" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <Suspense fallback={<p className="text-xs text-[#7c8c91]">Loading preview…</p>}>
          <CadThreeMfViewer name={name} src={objectUrl} />
        </Suspense>
      </WorkspaceAttachmentPreview>
    );
  if ((kind === "obj" || kind === "ply") && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <Suspense fallback={<p className="text-xs text-[#7c8c91]">Loading preview…</p>}>
          <CadMeshViewer name={name} src={objectUrl} />
        </Suspense>
      </WorkspaceAttachmentPreview>
    );
  if (kind === "step" && objectUrl)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <Suspense fallback={<p className="text-xs text-[#7c8c91]">Loading preview…</p>}>
          <ChatStepViewer name={name} src={objectUrl} />
        </Suspense>
      </WorkspaceAttachmentPreview>
    );
  return (
    <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
      <WorkspaceAttachmentDocument name={name} html={documentHtml} objectUrl={objectUrl} />
    </WorkspaceAttachmentPreview>
  );
}

