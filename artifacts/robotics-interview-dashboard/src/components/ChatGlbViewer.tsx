import { createElement, useEffect, useRef, useState, type HTMLAttributes, type RefAttributes } from "react";

type ChatGlbViewerProps = {
  name: string;
  src: string;
};

export function ChatGlbViewer({ name, src }: ChatGlbViewerProps) {
  const viewerRef = useRef<HTMLElement>(null);
  const [failed, setFailed] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    let active = true;
    const onViewerError = () => setFailed(true);
    viewer.addEventListener("error", onViewerError);
    setFailed(false);
    setViewerReady(false);

    void import("@google/model-viewer")
      .then(() => {
        if (active) setViewerReady(true);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
      viewer.removeEventListener("error", onViewerError);
    };
  }, [src]);

  const customElementProps = {
    ref: viewerRef,
    src,
    alt: `3D preview of ${name}`,
    "camera-controls": "",
    "shadow-intensity": "1",
    "interaction-prompt": "none",
    style: { display: "block", width: "100%", height: "320px" },
  } as unknown as HTMLAttributes<HTMLElement> & RefAttributes<HTMLElement>;

  return (
    <figure className="my-2 overflow-hidden rounded-xl border border-[#dce9e8] bg-[#f7faf9] dark:border-[#2a3f52] dark:bg-[#10232d]" data-testid="chat-glb-attachment">
      <figcaption className="flex flex-wrap items-center justify-between gap-1 border-b border-[#dce9e8] px-3 py-2 text-[11px] dark:border-[#2a3f52]">
        <span className="min-w-0 truncate font-semibold text-[#183a4b] dark:text-[#e5edf3]">{name}</span>
        <span className="text-[#718189] dark:text-[#a8bac8]">3D model · drag to rotate · two fingers to pan and zoom</span>
      </figcaption>
      {failed ? (
        <div className="flex min-h-24 flex-wrap items-center gap-2 p-4 text-xs text-[#a34d46] dark:text-[#e89890]" role="status">
          <span>Couldn’t render this model.</span>
          <a href={src} download={name} className="font-semibold underline underline-offset-2">Download GLB</a>
        </div>
      ) : (
        <div className="relative">
          {!viewerReady && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-[#f7faf9] text-xs text-[#718189] dark:bg-[#10232d] dark:text-[#a8bac8]" role="status">
              Loading 3D preview…
            </div>
          )}
          {createElement("model-viewer", customElementProps)}
        </div>
      )}
    </figure>
  );
}