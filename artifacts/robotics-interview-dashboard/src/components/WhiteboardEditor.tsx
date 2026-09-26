import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { Check, ExternalLink, FilePenLine, Info, LoaderCircle, Share2, X } from "lucide-react";
import { getStoredAuthToken } from "../authSession";

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
type StoredElement = { id: string; version?: number; versionNonce?: number; [key: string]: unknown };

type ExcalidrawInitialData = NonNullable<ComponentProps<typeof Excalidraw>["initialData"]>;
type ExcalidrawApi = {
  updateScene: (scene: {
    elements?: readonly unknown[];
    appState?: Record<string, unknown>;
    files?: Record<string, unknown>;
  }) => void;
  getAppState?: () => Record<string, unknown>;
};
type CursorPresence = {
  id: string;
  displayName: string;
  x: number;
  y: number;
  visible: boolean;
  selectedElementIds: string[];
};
type Viewport = {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
  offsetLeft: number;
  offsetTop: number;
};
type CollaborationStatus = "offline" | "connecting" | "connected" | "reconnecting";

const defaultScene: StoredScene = {
  elements: [],
  appState: { viewBackgroundColor: "#ffffff" },
  files: {},
};

function isValidWhiteboardEmbedUrl(link: string): boolean {
  if (!/^https?:\/\/\S+$/i.test(link)) return false;
  try {
    const url = new URL(link);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function selectedEmbeddableUrl(elements: readonly unknown[], selectedIds: string[]): string | null {
  const selected = new Set(selectedIds);
  for (const element of elements) {
    if (!element || typeof element !== "object") continue;
    const embed = element as StoredElement & { type?: string; link?: unknown };
    if (
      embed.type === "embeddable" &&
      selected.has(embed.id) &&
      typeof embed.link === "string" &&
      isValidWhiteboardEmbedUrl(embed.link)
    ) {
      return embed.link;
    }
  }
  return null;
}

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

function isNewerElement(incoming: StoredElement, existing: StoredElement): boolean {
  const incomingVersion = typeof incoming.version === "number" ? incoming.version : 0;
  const existingVersion = typeof existing.version === "number" ? existing.version : 0;
  if (incomingVersion !== existingVersion) return incomingVersion > existingVersion;
  const incomingNonce = typeof incoming.versionNonce === "number" ? incoming.versionNonce : 0;
  const existingNonce = typeof existing.versionNonce === "number" ? existing.versionNonce : 0;
  return incomingNonce >= existingNonce;
}

function mergeSceneData(currentData: string, incomingData: string): string {
  const current = parseScene(currentData);
  const incoming = parseScene(incomingData);
  const currentElements = current.elements.filter((element): element is StoredElement => (
    Boolean(element) && typeof element === "object" && typeof (element as StoredElement).id === "string"
  ));
  const incomingElements = incoming.elements.filter((element): element is StoredElement => (
    Boolean(element) && typeof element === "object" && typeof (element as StoredElement).id === "string"
  ));
  const mergedById = new Map(currentElements.map((element) => [element.id, element]));
  const order = currentElements.map((element) => element.id);
  for (const element of incomingElements) {
    const existing = mergedById.get(element.id);
    if (!existing) {
      order.push(element.id);
      mergedById.set(element.id, element);
    } else if (isNewerElement(element, existing)) {
      mergedById.set(element.id, element);
    }
  }
  return JSON.stringify({
    ...current,
    elements: order.map((id) => mergedById.get(id)).filter((element): element is StoredElement => Boolean(element)),
    files: { ...(current.files ?? {}), ...(incoming.files ?? {}) },
  });
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
  const [selectedEmbedUrl, setSelectedEmbedUrl] = useState<string | null>(null);
  const [collaborationStatus, setCollaborationStatus] = useState<CollaborationStatus>("offline");
  const [participants, setParticipants] = useState(0);
  const [remoteCursors, setRemoteCursors] = useState<CursorPresence[]>([]);
  const [viewport, setViewport] = useState<Viewport>({ scrollX: 0, scrollY: 0, zoom: { value: 1 }, offsetLeft: 0, offsetTop: 0 });
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const dataRef = useRef(data);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCursorRef = useRef<{
    x: number;
    y: number;
    visible: boolean;
    selectedElementIds: string[];
  } | null>(null);
  const localCursorRef = useRef({
    x: 0,
    y: 0,
    visible: false,
    selectedElementIds: [] as string[],
  });
  const stoppedRef = useRef(false);
  const revisionRef = useRef(0);
  const localDirtyRef = useRef(false);
  const pendingDataRef = useRef<string | null>(null);
  const remoteDataRef = useRef<string | null>(null);

  useEffect(() => {
    setTitle(whiteboard?.title ?? "Untitled whiteboard");
    setSelectedEmbedUrl(null);
    const nextData = JSON.stringify(scene);
    dataRef.current = nextData;
    setData(nextData);
    localDirtyRef.current = false;
    pendingDataRef.current = null;
    remoteDataRef.current = null;
  }, [scene, whiteboard?.title]);

  useEffect(() => {
    if (!whiteboard?.id) {
      setCollaborationStatus("offline");
      setParticipants(0);
      setRemoteCursors([]);
      return;
    }

    stoppedRef.current = false;
    let retryDelay = 500;

    const applyRemoteScene = (remoteData: string) => {
      const mergedData = mergeSceneData(dataRef.current, remoteData);
      const remoteScene = parseScene(mergedData);
      remoteDataRef.current = mergedData;
      dataRef.current = mergedData;
      setData(mergedData);
      apiRef.current?.updateScene({
        elements: remoteScene.elements,
        files: remoteScene.files,
      });
    };

    const sendPendingScene = () => {
      const socket = socketRef.current;
      const pending = pendingDataRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !pending) return;
      const clientRevision = ++revisionRef.current;
      socket.send(JSON.stringify({ type: "scene", data: pending, clientRevision }));
    };

    const sendPendingCursor = () => {
      const socket = socketRef.current;
      const pending = pendingCursorRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !pending) return;
      socket.send(JSON.stringify({ type: "cursor", cursor: pending }));
      pendingCursorRef.current = null;
    };

    const connect = () => {
      if (stoppedRef.current) return;
      setCollaborationStatus(retryDelay === 500 ? "connecting" : "reconnecting");
      const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const token = getStoredAuthToken();
      const query = token ? `?access_token=${encodeURIComponent(token)}` : "";
      const socket = new WebSocket(`${protocol}//${window.location.host}${base}/api/whiteboards/${encodeURIComponent(whiteboard.id)}/collab${query}`);
      socketRef.current = socket;

      socket.onopen = () => {
        retryDelay = 500;
        setCollaborationStatus("connected");
        sendPendingScene();
        sendPendingCursor();
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as {
            type?: string;
            data?: string;
            title?: string;
            participants?: number;
            clientRevision?: number;
            collaborators?: CursorPresence[];
            id?: string;
            displayName?: string;
            x?: number;
            y?: number;
            visible?: boolean;
            selectedElementIds?: string[];
          };
          if (message.type === "snapshot" && typeof message.data === "string") {
            setParticipants(message.participants ?? 1);
            setRemoteCursors(message.collaborators ?? []);
            if (!localDirtyRef.current) applyRemoteScene(message.data);
          } else if (message.type === "scene" && typeof message.data === "string") {
            applyRemoteScene(message.data);
          } else if (message.type === "presence") {
            setParticipants(message.participants ?? 1);
            setRemoteCursors(message.collaborators ?? []);
          } else if (
            message.type === "cursor" &&
            typeof message.id === "string" &&
            typeof message.displayName === "string" &&
            typeof message.x === "number" &&
            typeof message.y === "number"
          ) {
            setRemoteCursors((current) => {
              const next = current.filter((cursor) => cursor.id !== message.id);
              next.push({
                id: message.id!,
                displayName: message.displayName!,
                x: message.x!,
                y: message.y!,
                visible: message.visible === true,
                selectedElementIds: message.selectedElementIds ?? [],
              });
              return next;
            });
          } else if (message.type === "ack" && message.clientRevision === revisionRef.current) {
            localDirtyRef.current = false;
            pendingDataRef.current = null;
          }
        } catch {
          // Ignore malformed collaboration messages and keep the editor usable.
        }
      };
      socket.onerror = () => socket.close();
      socket.onclose = () => {
        if (socketRef.current === socket) socketRef.current = null;
        if (stoppedRef.current) return;
        setCollaborationStatus("reconnecting");
        setParticipants(0);
        setRemoteCursors([]);
        reconnectTimerRef.current = setTimeout(connect, retryDelay);
        retryDelay = Math.min(5000, retryDelay * 2);
      };
    };

    connect();
    return () => {
      stoppedRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
      if (cursorSendTimerRef.current) clearTimeout(cursorSendTimerRef.current);
      socketRef.current?.close();
      socketRef.current = null;
      setRemoteCursors([]);
    };
  }, [whiteboard?.id]);

  const queueCursor = (cursor: typeof localCursorRef.current) => {
    localCursorRef.current = cursor;
    pendingCursorRef.current = cursor;
    if (cursorSendTimerRef.current) return;
    cursorSendTimerRef.current = setTimeout(() => {
      cursorSendTimerRef.current = null;
      const socket = socketRef.current;
      const pending = pendingCursorRef.current;
      if (socket?.readyState === WebSocket.OPEN && pending) {
        socket.send(JSON.stringify({ type: "cursor", cursor: pending }));
        pendingCursorRef.current = null;
      }
    }, 50);
  };

  const queueScene = (nextData: string) => {
    if (nextData === dataRef.current) return;
    dataRef.current = nextData;
    setData(nextData);
    if (remoteDataRef.current === nextData) {
      remoteDataRef.current = null;
      return;
    }
    localDirtyRef.current = true;
    pendingDataRef.current = nextData;
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    sendTimerRef.current = setTimeout(() => {
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN && pendingDataRef.current) {
        const clientRevision = ++revisionRef.current;
        socket.send(JSON.stringify({ type: "scene", data: pendingDataRef.current, clientRevision }));
      }
    }, 120);
  };

  const selectedElementIdsFrom = (appState: Record<string, unknown>): string[] => {
    const selected = appState.selectedElementIds as Record<string, unknown> | undefined;
    if (!selected || typeof selected !== "object") return [];
    return Object.keys(selected).filter((id) => selected[id] === true);
  };

  const updateCursor = (visible: boolean, x = localCursorRef.current.x, y = localCursorRef.current.y) => {
    queueCursor({
      x,
      y,
      visible,
      selectedElementIds: localCursorRef.current.selectedElementIds,
    });
  };

  const statusLabel = collaborationStatus === "connected"
    ? `Live${participants > 1 ? ` · ${participants} editing` : ""}`
    : collaborationStatus === "reconnecting"
      ? "Reconnecting…"
      : collaborationStatus === "connecting"
        ? "Connecting…"
        : "Live editing starts after saving";

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#f5f8f7]" role="dialog" aria-modal="true" aria-label="Whiteboard editor" data-testid="whiteboard-editor">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dce5e5] bg-white px-4 py-3 shadow-sm sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3f4f2] text-[#12737d]"><FilePenLine size={18} /></div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#16869a]">Team whiteboard</p>
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} aria-label="Whiteboard title" data-testid="input-whiteboard-title" className="mt-0.5 w-full max-w-[420px] bg-transparent text-lg font-semibold text-[#183a4b] outline-none placeholder:text-[#9aa9ad]" placeholder="Name this whiteboard" />
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#71878d]" data-testid="whiteboard-collaboration-status"><span className={`h-1.5 w-1.5 rounded-full ${collaborationStatus === "connected" ? "bg-[#28a47f]" : collaborationStatus === "reconnecting" ? "bg-[#e1a52d]" : "bg-[#a7b7b9]"}`} />{statusLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {error && <p className="max-w-[260px] text-right text-xs text-[#ad4b43]" role="alert">{error}</p>}
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl border border-[#d5e0e0] bg-white px-3 py-2 text-xs font-semibold text-[#52666e] transition hover:border-[#183a4b] disabled:opacity-50" data-testid="button-close-whiteboard"><X size={15} className="mr-1 inline" />Close</button>
          {whiteboard && <button type="button" onClick={() => onSave(title.trim() || "Untitled whiteboard", data, false)} disabled={saving} className="rounded-xl border border-[#16869a] bg-white px-3 py-2 text-xs font-semibold text-[#12737d] transition hover:bg-[#e3f4f2] disabled:opacity-50" data-testid="button-save-whiteboard">{saving ? <LoaderCircle size={14} className="mr-1 inline animate-spin" /> : <Check size={14} className="mr-1 inline" />}Save changes</button>}
          <button type="button" onClick={() => onSave(title.trim() || "Untitled whiteboard", data, true)} disabled={saving} className="rounded-xl bg-[#16869a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:opacity-50" data-testid="button-share-whiteboard">{saving ? <LoaderCircle size={14} className="mr-1 inline animate-spin" /> : <Share2 size={14} className="mr-1 inline" />}{whiteboard ? "Save & share" : "Save & share with team"}</button>
        </div>
      </header>
      <div className="mx-3 mt-3 flex flex-wrap items-start gap-2 rounded-xl border border-[#cbe5e2] bg-[#eaf7f5] px-3 py-2.5 text-xs leading-5 text-[#315a61] dark:border-[#2a3f52] dark:bg-[#1c2f3d] dark:text-[#b9c9d1] sm:mx-5" role="note" data-testid="whiteboard-embed-policy-note">
        <Info size={15} className="mt-0.5 shrink-0 text-[#16869a] dark:text-[#6fc3cf]" aria-hidden="true" />
        <p className="min-w-0 flex-1">Some websites prohibit iframe embedding. If a linked site doesn’t appear, its security settings may be responsible; it may not be a whiteboard permission or connection issue. Select its embed to open the site separately.</p>
        {selectedEmbedUrl && (
          <a
            href={selectedEmbedUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="link-open-embedded-site"
            className="inline-flex shrink-0 items-center gap-1 font-semibold text-[#12737d] underline decoration-[#12737d]/40 underline-offset-2 hover:text-[#106d7a] dark:text-[#6fc3cf] dark:decoration-[#6fc3cf]/50 dark:hover:text-[#9adce3]"
          >
            Open selected site <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
      </div>
      <div className="min-h-0 flex-1 p-3 sm:p-5">
        <div
          ref={boardRef}
          className="relative h-full overflow-hidden rounded-2xl border border-[#dce5e5] bg-white shadow-sm"
          onMouseLeave={() => updateCursor(false)}
        >
          <Excalidraw
            key={whiteboard?.id ?? "new-whiteboard"}
            initialData={scene as unknown as ExcalidrawInitialData}
            excalidrawAPI={(api) => { apiRef.current = api as unknown as ExcalidrawApi; }}
            onChange={(elements, appState, files) => {
              const selectedElementIds = selectedElementIdsFrom(appState as unknown as Record<string, unknown>);
              setSelectedEmbedUrl(selectedEmbeddableUrl(elements, selectedElementIds));
              localCursorRef.current = { ...localCursorRef.current, selectedElementIds };
              queueScene(serializeScene(elements, appState, files));
              if (localCursorRef.current.visible) updateCursor(true);
            }}
            onPointerUpdate={({ pointer }) => updateCursor(true, pointer.x, pointer.y)}
            onScrollChange={(scrollX, scrollY, zoom) => {
              const appState = apiRef.current?.getAppState?.() as Record<string, unknown> | undefined;
              setViewport({
                scrollX,
                scrollY,
                zoom: { value: zoom.value },
                offsetLeft: typeof appState?.offsetLeft === "number" ? appState.offsetLeft : 0,
                offsetTop: typeof appState?.offsetTop === "number" ? appState.offsetTop : 0,
              });
            }}
            validateEmbeddable={isValidWhiteboardEmbedUrl}
            UIOptions={{ canvasActions: { export: false, saveToActiveFile: false } }}
          />
          {remoteCursors.map((cursor) => {
            if (!cursor.visible) return null;
            const rect = boardRef.current?.getBoundingClientRect();
            if (!rect) return null;
            const left = (cursor.x - viewport.scrollX) * viewport.zoom.value + viewport.offsetLeft - rect.left;
            const top = (cursor.y - viewport.scrollY) * viewport.zoom.value + viewport.offsetTop - rect.top;
            return (
              <div
                key={cursor.id}
                className="pointer-events-none absolute z-10 -translate-x-1 -translate-y-1"
                style={{ left, top }}
                data-testid={`whiteboard-cursor-${cursor.id}`}
              >
                <div className="h-0 w-0 border-x-[7px] border-b-[12px] border-x-transparent border-b-[#16869a] drop-shadow-sm" />
                <div className="ml-2 mt-[-2px] flex items-center gap-1 whitespace-nowrap rounded-full bg-[#16869a] px-2 py-1 text-[10px] font-bold text-white shadow-md">
                  {cursor.displayName}
                  {cursor.selectedElementIds.length > 0 && <span className="rounded-full bg-white/20 px-1">{cursor.selectedElementIds.length} selected</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}