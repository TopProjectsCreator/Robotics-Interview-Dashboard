import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import DOMPurify from "dompurify";
import "@extend-ai/react-pptx/styles.css";

import { getStoredAuthToken } from "../authSession";
import { classifyFile } from "../lib/fileFormats";
import {
  formatJsonPreview,
  fullFidelityOfficeKind,
  isJsonAttachment,
  isOfficePreviewAttachment,
  parseOfficePreview,
} from "../lib/officePreview";
import { ChatGlbViewer } from "./ChatGlbViewer";
import { ChatArchiveViewer } from "./ChatArchiveViewer";
import { FullSpreadsheetViewer } from "./FullSpreadsheetViewer";
import { IcalViewer } from "./IcalViewer";
import { ChatParasolidViewer } from "./ChatParasolidViewer";
import { ChatStlViewer } from "./ChatStlViewer";
import { ChatStepViewer } from "./ChatStepViewer";
import { CadMeshViewer } from "./CadMeshViewer";
import { CadThreeMfViewer } from "./CadThreeMfViewer";

/**
 * Legacy PPT and ODP slides are rendered by a Rust/WASM viewer. The module
 * (including its ~2.5 MB wasm asset) is loaded only when such a file is
 * actually opened, so ordinary chat/workspace browsing pays nothing for it.
 */
const ExtendPresentationViewer = lazy(async () => {
  const module = await import("@extend-ai/react-pptx");
  return { default: module.ReactPptxViewer };
});

/** Watchdog wrapper: a viewer that never reports ready falls back to text. */
function FullFidelityPresentation({
  source,
  onReady,
  onFailure,
}: {
  source: ArrayBuffer;
  onReady: () => void;
  onFailure: () => void;
}) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(onFailure, 12_000);
    return () => window.clearTimeout(timer);
  }, [ready, onFailure]);
  return (
    <Suspense fallback={<p className="p-4 text-xs text-[#7c8c91]">Loading slide preview…</p>}>
      <ExtendPresentationViewer
        source={source}
        defaultZoom="fit-width"
        onReady={() => {
          setReady(true);
          onReady();
        }}
        onError={onFailure}
      />
    </Suspense>
  );
}

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

function triggerWorkspaceAttachmentDownload(url: string, name: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.style.position = "fixed";
  anchor.style.left = "-10000px";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function WorkspaceAttachmentDownloadButton({ name, url }: { name: string; url: string }) {
  return (
    <button
      type="button"
      data-testid="workspace-attachment-download"
      onClick={(event) => {
        event.stopPropagation();
        triggerWorkspaceAttachmentDownload(url, name);
      }}
      className="inline-flex w-fit items-center rounded-lg border border-[#d5e0e0] bg-white px-3 py-1.5 text-xs font-semibold text-[#16869a] hover:bg-[#f7faf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] dark:border-[#355663] dark:bg-[#172b38] dark:text-[#8fd7e0] dark:hover:bg-[#1c3542]"
    >
      Download {name}
    </button>
  );
}

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
      {downloadUrl && <WorkspaceAttachmentDownloadButton name={name} url={downloadUrl} />}
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

function declaredTypeIsGeneric(type: string): boolean {
  return !type || type === "application/octet-stream" || type === "";
}

/** MIME inferred from the filename when the server reports a generic type. */
function mimeForPreviewName(name: string, declared: string): string {
  if (declared && declared !== "application/octet-stream" && declared !== "text/plain") return declared;
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  const byExtension: Record<string, string> = {
    pdf: "application/pdf",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    doc: "application/msword",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    zip: "application/zip",
    ics: "text/calendar",
  };
  return byExtension[extension] ?? declared ?? "application/octet-stream";
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
}: {
  name: string;
  html: string | null;
}) {
  // Never put an unrecognized document in an iframe: browsers may download
  // Office files instead of rendering them, including when a chat remounts.
  // The original file remains available from the explicit button below.
  if (!html)
    return (
      <div
        className="my-2 rounded-xl border border-[#dce9e8] bg-white p-3 dark:border-[#2a3f52] dark:bg-[#10232d]"
        role="status"
        data-testid="unsupported-document-preview"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · preview unavailable</p>
            <p className="mt-1 text-xs text-[#667b82] dark:text-[#a8bac8]">
              This document format can’t be rendered here. Download the original to open it.
            </p>
          </div>
        </div>
      </div>
    );
  return (
    <div className="rounded-xl border border-[#dce9e8] bg-white p-4 dark:border-[#2a3f52] dark:bg-[#10232d]">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · document preview</p>
      </div>
      <div className="prose prose-sm max-w-none text-[#52666e] dark:text-[#a8bac8]" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function appRelativeWorkspaceUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || !path.startsWith("/")) return path;
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}${path}`;
}

/**
 * Last-resort text extraction for DOCX files the full-fidelity renderer cannot
 * handle (corrupt files, exotic features, or environments missing the DOM APIs
 * docx-preview relies on). DOMPurify is applied only to Mammoth's HTML string
 * here; docx-preview's own trusted DOM is never passed through it.
 */
async function mammothDocxFallback(buffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const converted = await mammoth.convertToHtml({
    arrayBuffer: buffer,
    buffer,
  } as unknown as Parameters<typeof mammoth.convertToHtml>[0]);
  return DOMPurify.sanitize(converted.value, { USE_PROFILES: { html: true } });
}

/**
 * Last-resort text preview for a full-fidelity Office viewer that could not
 * render the file. The extracted content is always rendered as plain text,
 * never as HTML. If extraction also fails the caller shows the download card.
 */
async function fallBackToOfficeText(
  buffer: ArrayBuffer,
  name: string,
  isActive: () => boolean,
  setText: (value: string) => void,
  setFailed: (value: boolean) => void,
): Promise<void> {
  try {
    const preview = await parseOfficePreview(new Blob([buffer]), name);
    if (!preview.trim()) throw new Error("No readable office content");
    if (isActive()) setText(preview);
  } catch {
    if (isActive()) setFailed(true);
  }
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
  // Raw DOCX bytes are kept so docx-preview can build real DOM (tables,
  // images, styles) into its own container instead of a sanitized HTML string.
  const [docxBuffer, setDocxBuffer] = useState<ArrayBuffer | null>(null);
  const [docxRenderFailed, setDocxRenderFailed] = useState(false);
  // Full-fidelity PPTX uses pptx-preview; legacy PPT/ODP and DOC/ODT use
  // lazily loaded WASM viewers. Raw bytes are kept so the renderers can build
  // real DOM into their own containers, with the text preview as a fallback.
  const [pptxBuffer, setPptxBuffer] = useState<ArrayBuffer | null>(null);
  const [pptxRenderFailed, setPptxRenderFailed] = useState(false);
  const [presentationBuffer, setPresentationBuffer] = useState<ArrayBuffer | null>(null);
  const [presentationRenderFailed, setPresentationRenderFailed] = useState(false);
  const [wordBuffer, setWordBuffer] = useState<ArrayBuffer | null>(null);
  const [wordRenderFailed, setWordRenderFailed] = useState(false);
  const [pdfPreviewAllowed, setPdfPreviewAllowed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [mediaPlaybackFailed, setMediaPlaybackFailed] = useState(false);
  const [imageFallback, setImageFallback] = useState<"converting" | "unavailable" | null>(null);
  const attachmentBlobRef = useRef<Blob | null>(null);
  const docxContainerRef = useRef<HTMLDivElement | null>(null);
  const pptxContainerRef = useRef<HTMLDivElement | null>(null);
  const wordContainerRef = useRef<HTMLDivElement | null>(null);
  const presentationFailureRef = useRef(false);
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
    setDocxBuffer(null);
    setDocxRenderFailed(false);
    setPptxBuffer(null);
    setPptxRenderFailed(false);
    setPresentationBuffer(null);
    setPresentationRenderFailed(false);
    presentationFailureRef.current = false;
    setWordBuffer(null);
    setWordRenderFailed(false);
    setPdfPreviewAllowed(false);
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
        // Re-wrap when the server returned a generic type: a blob: iframe
        // whose type isn't application/pdf makes the browser download the PDF
        // instead of rendering it (with a different, generated filename).
        const previewBlob = declaredTypeIsGeneric(resolvedType)
          ? new Blob([blob], { type: mimeForPreviewName(name, resolvedType) })
          : blob;
        const sourceUrl = URL.createObjectURL(previewBlob);
        createdUrls.add(sourceUrl);
        attachmentBlobRef.current = blob;
        setDownloadUrl(sourceUrl);
        setAttachmentBlob(blob);
        setContentType(resolvedType);
        const resolvedKind = workspaceAttachmentKind(name, resolvedType);
        if (resolvedKind === "pdf") {
          // Content-Type metadata can be wrong or stale. Only navigate an
          // iframe to bytes that actually contain a PDF header; otherwise a
          // Word attachment mislabeled as PDF can download on every mount.
          const hasPdfSignature = (await blob.slice(0, 1024).text()).includes("%PDF-");
          if (active) setPdfPreviewAllowed(hasPdfSignature);
        }
        const ensureDownloadUrl = () => {
          setObjectUrl(sourceUrl);
        };
        // Full-fidelity renderers own these bytes. ODS is deliberately not
        // included here: it falls through to the SheetJS spreadsheet renderer,
        // which shows every sheet and cell as a table.
        const fidelityKind = fullFidelityOfficeKind(name);
        if (fidelityKind === "pptx" || fidelityKind === "presentation" || fidelityKind === "word") {
          ensureDownloadUrl();
          const officeBytes = await blob.arrayBuffer();
          if (!active) return;
          if (fidelityKind === "pptx") setPptxBuffer(officeBytes);
          else if (fidelityKind === "presentation") setPresentationBuffer(officeBytes);
          else setWordBuffer(officeBytes);
          return;
        }
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
          // The full-fidelity viewer parses the original bytes itself with
          // styles, merges, formulas and every sheet. Just ensure the loading
          // guard clears (it needs an object URL or text/sheets).
          ensureDownloadUrl();
          return;
        }
        if (resolvedKind === "document" && /\.(docx)$/i.test(name)) {
          // Full-fidelity rendering happens in the effect below, once React
          // has mounted the dedicated container ref. Keep the bytes around so
          // the same effect can fall back to Mammoth's text extraction.
          ensureDownloadUrl();
          const documentBytes = await blob.arrayBuffer();
          if (active) setDocxBuffer(documentBytes);
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

  /**
   * DOCX files are rendered by docx-preview into a dedicated DOM container so
   * tables, images, headers/footers and character/paragraph formatting survive
   * instead of being flattened to text. Nothing from this DOM is ever fed to
   * dangerouslySetInnerHTML. On any failure we retry with Mammoth's text
   * preview, and if that also fails we leave the existing download card in
   * place — never a blank box.
   */
  useEffect(() => {
    if (!docxBuffer || !docxContainerRef.current) return;
    let active = true;
    const container = docxContainerRef.current;
    container.replaceChildren();

    const fallBackToText = async () => {
      try {
        const html = await mammothDocxFallback(docxBuffer);
        if (!active) return;
        if (!html.trim()) throw new Error("No readable DOCX content");
        setDocumentHtml(html);
      } catch {
        if (active) setFailed(true);
      } finally {
        if (active) setDocxRenderFailed(true);
      }
    };

    void (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        await renderAsync(docxBuffer, container, undefined, {
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: false,
          renderHeaders: true,
          renderFooters: true,
          // Embedded images become self-contained data: URLs. docx-preview
          // parses only the docx bytes; it never fetches external image URLs.
          useBase64URL: true,
        });
        if (!active) return;
        // A missing page element means the library silently bailed out; treat
        // it like a thrown error so the user still gets a usable preview.
        // (The injected <style> tag alone is not a successful render.)
        if (!container.querySelector("section.docx")) await fallBackToText();
      } catch {
        if (active) await fallBackToText();
      }
    })();

    return () => {
      active = false;
      container.replaceChildren();
    };
  }, [docxBuffer]);

  /**
   * PPTX slides render into a container owned by pptx-preview, including the
   * slide geometry, text runs, tables, charts and embedded images. Any render
   * failure (or a silent bail-out that leaves no slide DOM) falls back to the
   * existing Office text preview, then to the download card.
   */
  useEffect(() => {
    if (!pptxBuffer || !pptxContainerRef.current) return;
    let active = true;
    const container = pptxContainerRef.current;
    container.replaceChildren();

    const fallBack = async () => {
      await fallBackToOfficeText(pptxBuffer, name, () => active, setText, setFailed);
      if (active) setPptxRenderFailed(true);
    };

    void (async () => {
      try {
        const { init } = await import("pptx-preview");
        if (!active) return;
        const previewer = init(container, { width: 960, height: 540 });
        await previewer.preview(pptxBuffer);
        if (!active) return;
        // The library can return normally while producing no slide DOM (for
        // example on a truncated file); treat that as a render failure.
        if (!container.querySelector(".pptx-preview-slide-wrapper")) await fallBack();
      } catch {
        if (active) await fallBack();
      }
    })();

    return () => {
      active = false;
      container.replaceChildren();
    };
  }, [pptxBuffer, name]);

  /**
   * Legacy DOC and ODT are rendered by a lazily imported Rust/WASM viewer into
   * its own DOM container. The viewer reports `hasDocument` once parsing and
   * layout are done; a watchdog keeps a silent failure from leaving a blank
   * box. Neither its DOM nor its errors are ever injected as HTML.
   */
  useEffect(() => {
    if (!wordBuffer || !wordContainerRef.current) return;
    let active = true;
    let settled = false;
    const container = wordContainerRef.current;
    container.replaceChildren();
    let viewer: { destroy(): void; subscribe(listener: (controller: { error?: Error; hasDocument: boolean }) => void): () => void } | null = null;
    let unsubscribe: (() => void) | null = null;

    const fallBack = async () => {
      if (settled) return;
      settled = true;
      await fallBackToOfficeText(wordBuffer, name, () => active, setText, setFailed);
      if (active) setWordRenderFailed(true);
    };
    const timer = window.setTimeout(() => void fallBack(), 12_000);

    void (async () => {
      try {
        const { createDocxViewer } = await import("@extend-ai/react-docx/vanilla");
        if (!active) return;
        viewer = createDocxViewer(container, {
          file: new File([wordBuffer], name),
          fileName: name,
          mode: "read-only",
          height: "560px",
        });
        unsubscribe = viewer.subscribe((controller) => {
          if (!active || settled) return;
          if (controller.error) void fallBack();
          else if (controller.hasDocument) {
            settled = true;
            window.clearTimeout(timer);
          }
        });
      } catch {
        if (active) await fallBack();
      }
    })();

    return () => {
      active = false;
      settled = true;
      window.clearTimeout(timer);
      unsubscribe?.();
      viewer?.destroy();
      container.replaceChildren();
    };
  }, [wordBuffer, name]);

  const handlePresentationFailure = useCallback(() => {
    if (!presentationBuffer || presentationFailureRef.current) return;
    presentationFailureRef.current = true;
    setPresentationRenderFailed(true);
    void fallBackToOfficeText(presentationBuffer, name, () => true, setText, setFailed);
  }, [presentationBuffer, name]);

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
        <div className="mt-2">
          <WorkspaceAttachmentDownloadButton name={name} url={objectUrl ?? appRelativeWorkspaceUrl(src)} />
        </div>
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

  // PPTX slides are rendered by pptx-preview into a dedicated container. The
  // generated DOM is owned by the library and is never passed through
  // dangerouslySetInnerHTML or a sanitizer string.
  if (pptxBuffer && !pptxRenderFailed && text === null)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="rounded-xl border border-[#dce9e8] bg-white p-4 dark:border-[#2a3f52] dark:bg-[#10232d]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · slide preview</p>
          </div>
          <div
            ref={pptxContainerRef}
            data-testid="pptx-preview"
            aria-label={`Preview of ${name}`}
            className="pptx-preview-host max-h-[560px] overflow-auto rounded-lg border border-[#eef3f2] bg-white dark:border-[#2a3f52]"
          />
        </div>
      </WorkspaceAttachmentPreview>
    );

  // Legacy PPT and ODP slides are rendered by the lazy Rust/WASM viewer.
  if (presentationBuffer && !presentationRenderFailed && text === null)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="rounded-xl border border-[#dce9e8] bg-white p-4 dark:border-[#2a3f52] dark:bg-[#10232d]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · slide preview</p>
          </div>
          <div
            data-testid="presentation-preview"
            aria-label={`Preview of ${name}`}
            className="max-h-[560px] overflow-auto rounded-lg border border-[#eef3f2] bg-white dark:border-[#2a3f52]"
          >
            <FullFidelityPresentation
              source={presentationBuffer}
              onReady={() => undefined}
              onFailure={handlePresentationFailure}
            />
          </div>
        </div>
      </WorkspaceAttachmentPreview>
    );

  // Legacy DOC and ODT are rendered as real pages by the lazy Rust/WASM viewer.
  if (wordBuffer && !wordRenderFailed && text === null)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="rounded-xl border border-[#dce9e8] bg-white p-4 dark:border-[#2a3f52] dark:bg-[#10232d]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · document preview</p>
          </div>
          <div
            ref={wordContainerRef}
            data-testid="office-word-preview"
            aria-label={`Preview of ${name}`}
            className="max-h-[560px] overflow-auto rounded-lg border border-[#eef3f2] bg-white dark:border-[#2a3f52]"
          />
        </div>
      </WorkspaceAttachmentPreview>
    );

  // Word documents render as real pages (tables, images, styles) into this
  // container. The container is intentionally owned by docx-preview, not by
  // React children, so its generated DOM is never sanitized or replaced by a
  // sanitized HTML string.
  if (kind === "document" && /\.docx$/i.test(name) && docxBuffer && !docxRenderFailed && documentHtml === null)
    return (
      <WorkspaceAttachmentPreview name={name} downloadUrl={downloadUrl}>
        <div className="rounded-xl border border-[#dce9e8] bg-white p-4 dark:border-[#2a3f52] dark:bg-[#10232d]">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">{name} · document preview</p>
          </div>
          <div
            ref={docxContainerRef}
            data-testid="docx-preview"
            aria-label={`Preview of ${name}`}
            className="docx-preview-host max-h-[560px] overflow-auto rounded-lg border border-[#eef3f2] bg-white dark:border-[#2a3f52]"
          />
        </div>
      </WorkspaceAttachmentPreview>
    );

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
  if (kind === "spreadsheet" && attachmentBlob)
    return <FullSpreadsheetViewer name={name} blob={attachmentBlob} downloadUrl={downloadUrl} />;
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
  if (kind === "pdf" && objectUrl && pdfPreviewAllowed)
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
      <WorkspaceAttachmentDocument name={name} html={documentHtml} />
    </WorkspaceAttachmentPreview>
  );
}

