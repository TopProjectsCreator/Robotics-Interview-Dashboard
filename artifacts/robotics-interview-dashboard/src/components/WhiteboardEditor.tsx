import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Check, FilePenLine, LoaderCircle, Share2, X } from "lucide-react";

type WhiteboardRecord = {
  id: string;
  title: string;
  data: string;
  createdBy: string;
  updatedAt: string;
};

type WhiteboardEditorProps = {
  whiteboard: WhiteboardRecord | null;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (title: string, data: string, share: boolean) => void;
};

type StoredScene = {
  elements: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
};

type ExcalidrawInitialData = NonNullable<ComponentProps<typeof Excalidraw>["initialData"]>;

const defaultScene: StoredScene = {
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
};

function parseScene(data: string | undefined): StoredScene {
  if (!data) return defaultScene;
  try {
    const parsed = JSON.parse(data) as Partial<StoredScene>;
    return Array.isArray(parsed.elements)
      ? {
          elements: parsed.elements as readonly unknown[],
          appState: parsed.appState,
          files: parsed.files as Record<string, unknown> | undefined,
        }
      : defaultScene;
  } catch {
    return defaultScene;
  }
}

function serializeScene(
  elements: readonly unknown[],
  appState: { viewBackgroundColor?: string; scrollX?: number; scrollY?: number; zoom?: unknown; gridSize?: number | null; gridModeEnabled?: boolean },
  files: Record<string, unknown>,
): string {
  return JSON.stringify({
    elements,
    appState: {
      viewBackgroundColor: appState.viewBackgroundColor,
      scrollX: appState.scrollX,
      scrollY: appState.scrollY,
      zoom: appState.zoom,
      gridSize: appState.gridSize,
      gridModeEnabled: appState.gridModeEnabled,
    },
    files,
  });
}

export function WhiteboardEditor({ whiteboard, saving, error, onClose, onSave }: WhiteboardEditorProps) {
  const scene = useMemo(() => parseScene(whiteboard?.data), [whiteboard?.data]);
  const [title, setTitle] = useState(whiteboard?.title ?? "Untitled whiteboard");
  const [data, setData] = useState(() => JSON.stringify(scene));

  useEffect(() => {
    setTitle(whiteboard?.title ?? "Untitled whiteboard");
    setData(JSON.stringify(scene));
  }, [scene, whiteboard?.title]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#f5f8f7]" role="dialog" aria-modal="true" aria-label="Whiteboard editor" data-testid="whiteboard-editor">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce5e5] bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f4f2] text-[#12737d]"><FilePenLine size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#16869a]">Team whiteboard</p>
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} aria-label="Whiteboard title" data-testid="input-whiteboard-title" className="mt-0.5 w-full max-w-[420px] bg-transparent text-lg font-semibold text-[#183a4b] outline-none placeholder:text-[#9aa9ad]" placeholder="Name this whiteboard" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <p className="max-w-[260px] text-right text-xs text-[#ad4b43]" role="alert">{error}</p>}
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-[#d5e0e0] bg-white px-3 py-2 text-xs font-semibold text-[#52666e] transition hover:border-[#183a4b] disabled:opacity-50" data-testid="button-close-whiteboard"><X size={15} className="mr-1 inline" />Close</button>
          {whiteboard && <button type="button" onClick={() => onSave(title.trim() || "Untitled whiteboard", data, false)} disabled={saving} className="rounded-xl border border-[#16869a] bg-white px-3 py-2 text-xs font-semibold text-[#12737d] transition hover:bg-[#e3f4f2] disabled:opacity-50" data-testid="button-save-whiteboard">{saving ? <LoaderCircle size={14} className="mr-1 inline animate-spin" /> : <Check size={14} className="mr-1 inline" />}Save changes</button>}
          <button type="button" onClick={() => onSave(title.trim() || "Untitled whiteboard", data, true)} disabled={saving} className="rounded-xl bg-[#16869a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:opacity-50" data-testid="button-share-whiteboard">{saving ? <LoaderCircle size={14} className="mr-1 inline animate-spin" /> : <Share2 size={14} className="mr-1 inline" />}{whiteboard ? "Save & share" : "Save & share with team"}</button>
        </div>
      </header>
      <div className="min-h-0 flex-1 p-3 sm:p-5">
        <div className="h-full overflow-hidden rounded-2xl border border-[#dce5e5] bg-white shadow-sm">
          <Excalidraw
            key={whiteboard?.id ?? "new-whiteboard"}
            initialData={scene as unknown as ExcalidrawInitialData}
            onChange={(elements, appState, files) => setData(serializeScene(elements, appState, files))}
            UIOptions={{ canvasActions: { export: false, saveToActiveFile: false } }}
          />
        </div>
      </div>
    </div>
  );
}