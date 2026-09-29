import { lazy, Suspense, useEffect, useState } from "react";

import { getStoredAuthToken } from "../authSession";
import { ChatGlbViewer } from "./ChatGlbViewer";
import {
  parseProgressiveCadPreviewManifest,
  type ProgressiveCadPreviewManifest,
} from "./progressiveCadPreview";

const ChatProgressiveGlbViewer = lazy(() =>
  import("./ChatProgressiveGlbViewer").then((module) => ({
    default: module.ChatProgressiveGlbViewer,
  })),
);

const PARASOLID_XT_PREVIEW_MAX_BYTES = 200 * 1024 * 1024;
const PARASOLID_XB_PREVIEW_MAX_BYTES = 50 * 1024 * 1024;
const PARASOLID_PREVIEW_TIMEOUT_MS = 10 * 60_000;

type ChatParasolidViewerProps = {
  name: string;
  src: string;
};

function parasolidFormat(name: string): "x-t" | "x-b" | null {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".x_t")) return "x-t";
  if (lowerName.endsWith(".x_b")) return "x-b";
  return null;
}

export function ChatParasolidViewer({ name, src }: ChatParasolidViewerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Building a private 3D preview…");
  const [partialPreview, setPartialPreview] = useState(false);
  const [progressivePreview, setProgressivePreview] = useState<ProgressiveCadPreviewManifest | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    let createdUrl: string | null = null;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), PARASOLID_PREVIEW_TIMEOUT_MS);
    const format = parasolidFormat(name);

    setPreviewUrl(null);
    setError(null);
    setPartialPreview(false);
    setProgressivePreview(null);
    setStatus("Loading the stored Parasolid file…");

    void (async () => {
      try {
        if (!format) throw new Error("Only .x_t and .x_b files can be previewed.");

        const sourceResponse = await fetch(src, { signal: controller.signal });
        if (!sourceResponse.ok) throw new Error("Couldn't load the stored CAD file.");
        const maxBytes = format === "x-t"
          ? PARASOLID_XT_PREVIEW_MAX_BYTES
          : PARASOLID_XB_PREVIEW_MAX_BYTES;
        const maxLabel = format === "x-t" ? "200 MB" : "50 MB";
        const contentLengthHeader = sourceResponse.headers.get("Content-Length");
        const contentLength = contentLengthHeader === null ? Number.NaN : Number(contentLengthHeader);
        if (Number.isFinite(contentLength) && contentLength > maxBytes) {
          throw new Error(`Inline previews are limited to ${maxLabel}. Download the CAD file instead.`);
        }
        const sourceFile = await sourceResponse.blob();
        if (sourceFile.size > maxBytes) {
          throw new Error(`Inline previews are limited to ${maxLabel}. Download the CAD file instead.`);
        }
        setStatus(sourceFile.size > 50 * 1024 * 1024
          ? "Large X_T model detected. Building a coarse overview and exact detail tiles…"
          : "Building a private 3D preview…");

        const token = getStoredAuthToken();
        const headers: Record<string, string> = {
          "Content-Type": "model/x-parasolid",
          "X-Parasolid-Format": format,
        };
        if (token) headers.Authorization = `Bearer ${token}`;

        const response = await fetch(`${import.meta.env.BASE_URL}api/storage/parasolid-preview`, {
          method: "POST",
          headers,
          body: sourceFile,
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          let message = `Preview conversion failed (${response.status}).`;
          try {
            const body = await response.json() as { error?: unknown };
            if (typeof body.error === "string" && body.error) message = body.error;
          } catch {
            // Keep the status-based message when the server response isn't JSON.
          }
          throw new Error(message);
        }

        if (format === "x-t" && sourceFile.size > 50 * 1024 * 1024) {
          const manifest = parseProgressiveCadPreviewManifest(await response.json());
          if (active) {
            setProgressivePreview(manifest);
            setStatus("Coarse overview ready; exact geometry loads as you zoom.");
          }
          return;
        }

        const preview = await response.blob();
        if (!preview.size) throw new Error("The converter returned an empty preview.");
        setPartialPreview(response.headers.get("X-Parasolid-Preview-Partial") === "true");
        createdUrl = URL.createObjectURL(preview);
        if (active) setPreviewUrl(createdUrl);
        else URL.revokeObjectURL(createdUrl);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error && caught.name === "AbortError"
            ? "Preview conversion took too long. Try again or download the CAD file."
            : caught instanceof Error
              ? caught.message
              : "Couldn't create an inline preview. Download the CAD file instead.",
        );
      }
    })();

    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeoutId);
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [name, src, retryKey]);

  if (progressivePreview) {
    return <div className="my-2 max-w-xl" data-testid="chat-parasolid-attachment">
      <Suspense fallback={<p className="rounded-xl border border-[#dce9e8] bg-[#f7faf9] p-3 text-xs text-[#718189] dark:border-[#2a3f52] dark:bg-[#10232d] dark:text-[#a8bac8]" role="status">Loading the progressive 3D viewer…</p>}>
        <ChatProgressiveGlbViewer
          name={name}
          previewId={progressivePreview.previewId}
          tiles={progressivePreview.tiles}
        />
      </Suspense>
      <div className="flex justify-end px-2">
        <a href={src} download={name} className="text-xs font-semibold text-[#16869a] underline underline-offset-2 dark:text-[#75c4cf]">
          Download original Parasolid
        </a>
      </div>
    </div>;
  }

  if (previewUrl) {
    return <div className="my-2 max-w-xl" data-testid="chat-parasolid-attachment">
      {partialPreview && (
        <p className="mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200" role="status">
          Some source geometry could not be included in this preview. The original Parasolid is available to download.
        </p>
      )}
      <ChatGlbViewer name={name} src={previewUrl} />
      <div className="flex justify-end px-2">
        <a href={src} download={name} className="text-xs font-semibold text-[#16869a] underline underline-offset-2 dark:text-[#75c4cf]">
          Download original Parasolid
        </a>
      </div>
    </div>;
  }

  return <figure className="my-2 max-w-xl overflow-hidden rounded-xl border border-[#dce9e8] bg-[#f7faf9] dark:border-[#2a3f52] dark:bg-[#10232d]" data-testid="chat-parasolid-attachment">
    <figcaption className="border-b border-[#dce9e8] px-3 py-2 text-[11px] font-semibold text-[#183a4b] dark:border-[#2a3f52] dark:text-[#e5edf3]">
      {name} · Parasolid CAD file
    </figcaption>
    <div className="flex flex-wrap items-center justify-between gap-3 p-3">
      <p className="text-xs text-[#718189] dark:text-[#a8bac8]" role={error ? "alert" : "status"}>
        {error ?? status}
      </p>
      <div className="flex shrink-0 items-center gap-3">
        {error && (
          <button type="button" onClick={() => setRetryKey(value => value + 1)} className="text-xs font-semibold text-[#16869a] underline underline-offset-2 dark:text-[#75c4cf]">
            Try preview again
          </button>
        )}
        <a href={src} download={name} className="rounded-lg bg-[#183a4b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#24516a]">
          Download CAD file
        </a>
      </div>
    </div>
  </figure>;
}