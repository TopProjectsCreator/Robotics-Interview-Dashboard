import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Palette, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import {
  getGetWhiteboardQueryKey,
  getListWhiteboardsQueryKey,
  useCreateWhiteboard,
  useDeleteWhiteboard,
  useGetWhiteboard,
  useListWhiteboards,
  useUpdateWhiteboard,
} from "@workspace/api-client-react";
import type { Whiteboard, WhiteboardSummary } from "@workspace/api-client-react";

// Whiteboards are stored in the shared coordinator DB, so every interviewer
// automatically sees the same set. A board can additionally be dropped into
// the team chat via a small embed token that the chat renderer turns into an
// interactive card.
export const WHITEBOARD_EMBED_MARKER = "|whiteboard|";

function encodeTokenString(value: string): string {
  try {
    return btoa(unescape(encodeURIComponent(value)));
  } catch {
    return value.replace(/[^a-zA-Z0-9]/g, "_");
  }
}

function decodeTokenString(value: string): string {
  try {
    return decodeURIComponent(escape(atob(value)));
  } catch {
    return value ?? "";
  }
}

export function whiteboardEmbedLine(board: { id: string; title: string }): string {
  return `${WHITEBOARD_EMBED_MARKER}${encodeTokenString(board.id)}|${encodeTokenString(board.title)}|`;
}

export function extractWhiteboardEmbed(message: string): { id: string; title: string } | null {
  const line = message
    .split("\n")
    .find((candidate) => candidate.trim().startsWith(WHITEBOARD_EMBED_MARKER));
  if (!line) return null;
  const rest = line.trim().slice(WHITEBOARD_EMBED_MARKER.length);
  const [idToken = "", titleToken = ""] = rest.split("|");
  const id = decodeTokenString(idToken);
  if (!id.trim()) return null;
  return { id, title: decodeTokenString(titleToken) || "Shared whiteboard" };
}

export function stripWhiteboardEmbed(message: string): string {
  return message
    .split("\n")
    .filter((line) => !line.trim().startsWith(WHITEBOARD_EMBED_MARKER))
    .join("\n")
    .trim();
}

type ParsedScene = {
  elements: ExcalidrawElement[];
  background: string;
  grid: number | null;
};

function parseSceneData(data: string): ParsedScene {
  try {
    const raw = JSON.parse(data) as {
      elements?: unknown;
      appState?: { viewBackgroundColor?: unknown; gridSize?: unknown };
    };
    const elements = Array.isArray(raw.elements) ? (raw.elements as ExcalidrawElement[]) : [];
    const background =
      typeof raw.appState?.viewBackgroundColor === "string"
        ? raw.appState.viewBackgroundColor
        : "#ffffff";
    const grid = typeof raw.appState?.gridSize === "number" ? raw.appState.gridSize : null;
    return { elements, background, grid };
  } catch {
    return { elements: [], background: "#ffffff", grid: null };
  }
}

function serializeScene(elements: readonly ExcalidrawElement[], background: string, grid: number | null): string {
  return JSON.stringify({
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements: [...elements],
    appState: { viewBackgroundColor: background, gridSize: grid },
  });
}

function ModalShell({
  onClose,
  title,
  children,
  wide = false,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#112433]/60 p-4" onClick={onClose} data-testid="whiteboard-modal">
      <div
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-[#dce5e5] bg-white shadow-2xl ${wide ? "max-w-6xl" : "max-w-xl"}`}
      >
        {children}
      </div>
    </div>
  );
}

export function WhiteboardWorkspaceModal(props: {
  open: boolean;
  boardId: string | null;
  mode: "edit" | "view";
  initialTitle?: string;
  onClose: () => void;
  onSaved?: (board: Whiteboard) => void;
  onShare?: (board: Whiteboard) => void;
}) {
  const qc = useQueryClient();
  const create = useCreateWhiteboard();
  const update = useUpdateWhiteboard();
  const remove = useDeleteWhiteboard();
  const boardQuery = useGetWhiteboard(props.boardId ?? "", {
    query: {
      enabled: props.open && Boolean(props.boardId),
      queryKey: getGetWhiteboardQueryKey(props.boardId ?? ""),
    },
  });

  const [boot, setBoot] = useState<{ key: string; elements: readonly ExcalidrawElement[]; background: string; grid: number | null } | null>(null);
  const [title, setTitle] = useState("Untitled whiteboard");
  const [editMode, setEditMode] = useState<"edit" | "view">(props.mode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedBoard, setSavedBoard] = useState<Whiteboard | null>(null);

  // Re-arm the editor every time the modal opens or the target board changes.
  useEffect(() => {
    if (!props.open) {
      setBoot(null);
      return;
    }
    setError("");
    setSavedBoard(null);
    setSaving(false);
    setEditMode(props.mode);
    setBoot(null);
    if (!props.boardId) {
      setTitle(props.initialTitle?.trim() || "Untitled whiteboard");
      setBoot({ key: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`, elements: [], background: "#ffffff", grid: null });
    } else {
      setTitle("");
    }
  }, [props.open, props.boardId, props.mode, props.initialTitle]);

  // Load scene data once a board fetch resolves.
  useEffect(() => {
    if (!props.open || !props.boardId || !boardQuery.data) return;
    const scene = parseSceneData(boardQuery.data.data);
    setTitle(boardQuery.data.title || "Untitled whiteboard");
    setBoot({
      key: `board-${props.boardId}-${boardQuery.data.updatedAt}`,
      elements: scene.elements,
      background: scene.background,
      grid: scene.grid,
    });
  }, [props.open, props.boardId, boardQuery.data]);

  const initialData = useMemo<ExcalidrawInitialDataState>(
    () =>
      boot
        ? {
            elements: boot.elements,
            appState: { viewBackgroundColor: boot.background } as Partial<AppState> & { viewBackgroundColor: string },
            scrollToContent: true,
          }
        : { elements: null, appState: null },
    [boot],
  );

  const handleChange = useCallback((nextElements: readonly ExcalidrawElement[], nextAppState: AppState) => {
    setBoot((current) =>
      current
        ? {
            ...current,
            elements: nextElements,
            background: nextAppState.viewBackgroundColor ?? current.background,
            grid: typeof nextAppState.gridSize === "number" ? nextAppState.gridSize : current.grid,
          }
        : current,
    );
  }, []);

  const currentBoard = savedBoard ?? boardQuery.data ?? null;
  const isView = editMode === "view";
  const showSharing = props.onShare !== undefined;
  const canDelete = Boolean(currentBoard || props.boardId);

  const close = () => {
    if (saving) return;
    props.onClose();
  };

  const save = async () => {
    const trimmedTitle = title.trim() || "Untitled whiteboard";
    const sceneData = serializeScene(boot?.elements ?? [], boot?.background ?? "#ffffff", boot?.grid ?? null);
    setSaving(true);
    setError("");
    try {
      let board: Whiteboard;
      const targetId = props.boardId ?? savedBoard?.id ?? null;
      if (targetId) {
        board = await update.mutateAsync({ boardId: targetId, data: { title: trimmedTitle, data: sceneData } });
      } else {
        board = await create.mutateAsync({ data: { title: trimmedTitle, data: sceneData } });
      }
      await qc.invalidateQueries({ queryKey: getListWhiteboardsQueryKey() });
      props.onSaved?.(board);
      setSavedBoard(board);
      setTitle(board.title);
      setEditMode("view");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Couldn't save the whiteboard. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const share = () => {
    if (showSharing && currentBoard) props.onShare?.(currentBoard);
  };

  const deleteBoard = async () => {
    if (!props.boardId && !savedBoard) return;
    const targetId = props.boardId ?? savedBoard?.id ?? "";
    setSaving(true);
    setError("");
    try {
      await remove.mutateAsync({ boardId: targetId });
      await qc.invalidateQueries({ queryKey: getListWhiteboardsQueryKey() });
      await qc.invalidateQueries({ queryKey: getGetWhiteboardQueryKey(targetId) });
      props.onClose();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Couldn't delete the whiteboard.");
    } finally {
      setSaving(false);
    }
  };

  if (!props.open) return null;

  const headerActions = isView ? (
    <div className="flex items-center gap-2">
      {showSharing && <button type="button" onClick={share} disabled={!currentBoard} data-testid="button-whiteboard-share" className="flex items-center gap-1.5 rounded-lg bg-[#16869a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:opacity-40"><Send size={13} /> Share to chat</button>}
      <button type="button" onClick={() => setEditMode("edit")} disabled={!props.open} data-testid="button-whiteboard-edit" className="flex items-center gap-1.5 rounded-lg border border-[#d5e0e0] px-3 py-1.5 text-xs font-semibold text-[#385762] transition hover:border-[#16869a] hover:text-[#16869a]"><Pencil size={13} /> Edit</button>
      {canDelete && <button type="button" onClick={() => void deleteBoard()} disabled={saving} data-testid="button-whiteboard-delete" title="Delete whiteboard" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#d5e0e0] text-[#a34d46] transition hover:border-[#c98b84] hover:bg-[#fbe4e2]"><Trash2 size={14} /></button>}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => void save()} disabled={saving || !boot} data-testid="button-whiteboard-save" className="flex items-center gap-1.5 rounded-lg bg-[#16869a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#106d7a] disabled:opacity-40">{saving ? <span className="text-[10px]">Saving…</span> : "Save"}</button>
      <button type="button" onClick={close} disabled={saving} data-testid="button-whiteboard-cancel" className="rounded-lg border border-[#d5e0e0] px-3 py-1.5 text-xs font-semibold text-[#7c8c91] transition hover:bg-[#f1f6f5]">Cancel</button>
    </div>
  );

  return (
    <ModalShell onClose={close} title="Whiteboard">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5ecec] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#dff4f2] text-[#12737d]"><Palette size={16} /></span>
          {isView ? (
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[#183a4b]" data-testid="whiteboard-title">{currentBoard?.title ?? title}</p>
              <p className="text-[11px] text-[#7c8c91]">{currentBoard ? `Shared by ${currentBoard.updatedBy}` : "Shared whiteboard"}</p>
            </div>
          ) : (
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Whiteboard title"
              maxLength={120}
              data-testid="input-whiteboard-title"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#d5e0e0] bg-white px-3 text-sm text-[#183a4b] outline-none focus:border-[#16869a]"
            />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {headerActions}
          <button type="button" onClick={close} disabled={saving} aria-label="Close whiteboard" data-testid="button-close-whiteboard" className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-[#60757c] transition hover:bg-[#f1f6f5]"><X size={16} /></button>
        </div>
      </div>
      {error && <div className="border-b border-[#f3d7d4] bg-[#fdf0ef] px-4 py-2 text-xs font-semibold text-[#a34d46]" data-testid="whiteboard-error">{error}</div>}
      <div className="min-h-[420px] flex-1 overflow-hidden">
        {!props.open ? null : !boot ? (
          <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-[#7c8c91]">Loading whiteboard…</div>
        ) : (
          <Excalidraw
            key={boot.key}
            initialData={initialData}
            onChange={handleChange}
            viewModeEnabled={isView}
          />
        )}
      </div>
    </ModalShell>
  );
}

export function WhiteboardLibraryModal(props: {
  open: boolean;
  onClose: () => void;
  onOpen: (board: WhiteboardSummary) => void;
  onCreate: () => void;
}) {
  const qc = useQueryClient();
  const list = useListWhiteboards({ query: { queryKey: getListWhiteboardsQueryKey(), enabled: props.open } });
  const remove = useDeleteWhiteboard();

  const deleteBoard = async (boardId: string) => {
    try {
      await remove.mutateAsync({ boardId });
      await qc.invalidateQueries({ queryKey: getListWhiteboardsQueryKey() });
    } catch {
      // Surface nothing extra; the row simply stays until next load.
    }
  };

  if (!props.open) return null;

  return (
    <ModalShell onClose={props.onClose} title="Shared whiteboards">
      <div className="flex items-center justify-between gap-3 border-b border-[#e5ecec] px-4 py-3">
        <div>
          <p className="mono text-[10px] uppercase tracking-[.16em] text-[#16869a]">Whiteboards</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-[-.02em] text-[#183a4b]">Shared with the team</h2>
        </div>
        <button type="button" onClick={props.onCreate} data-testid="button-new-whiteboard" className="flex items-center gap-1.5 rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#106d7a]"><Plus size={14} /> New</button>
      </div>
      <div className="max-h-[60dvh] overflow-y-auto p-2" role="list" data-testid="whiteboard-list">
        {list.isLoading && <p className="px-3 py-8 text-center text-sm text-[#7c8c91]">Loading whiteboards…</p>}
        {!list.isLoading && !list.isError && (list.data?.items.length ?? 0) === 0 && (
          <div className="px-3 py-10 text-center">
            <Palette size={28} className="mx-auto text-[#a8c4c4]" />
            <p className="mt-2 text-sm font-semibold text-[#385762]">No whiteboards yet</p>
            <p className="mt-1 text-xs text-[#7c8c91]">Create one from the + menu, then share it to chat.</p>
          </div>
        )}
        {(list.data?.items ?? []).map((board) => (
          <div key={board.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[#f5f9f8]" role="listitem">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dff4f2] text-[#12737d]"><Palette size={16} /></span>
            <div className="min-w-0 flex-1">
              <button type="button" onClick={() => props.onOpen(board)} data-testid={`button-open-whiteboard-${board.id}`} className="block max-w-full truncate text-left text-sm font-semibold text-[#183a4b] transition hover:text-[#16869a]">{board.title || "Untitled whiteboard"}</button>
              <p className="flex items-center gap-1 text-[11px] text-[#7c8c91]"><Clock size={11} /> {board.updatedBy} · {new Date(board.updatedAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            <button type="button" onClick={() => props.onOpen(board)} data-testid={`button-view-whiteboard-${board.id}`} className="rounded-lg border border-[#d5e0e0] px-2.5 py-1.5 text-xs font-semibold text-[#385762] transition hover:border-[#16869a] hover:text-[#16869a]">Open</button>
            <button type="button" onClick={() => void deleteBoard(board.id)} disabled={remove.isPending} aria-label={`Delete ${board.title}`} data-testid={`button-delete-whiteboard-${board.id}`} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#a34d46] transition hover:bg-[#fbe4e2]"><Trash2 size={14} /></button>
          </div>
        ))}
        {list.isError && <p className="px-3 py-8 text-center text-sm text-[#a34d46]">Couldn't load whiteboards.</p>}
      </div>
    </ModalShell>
  );
}

export function WhiteboardChatCard(props: { boardId: string; title: string; onOpen: (boardId: string) => void }) {
  const board = useGetWhiteboard(props.boardId, {
    query: { queryKey: getGetWhiteboardQueryKey(props.boardId), retry: false },
  });
  const displayTitle = board.data?.title || props.title || "Shared whiteboard";
  return (
    <div className="mt-2 flex items-center gap-3 rounded-xl border border-[#cfe4e2] bg-[#eef8f7] p-2.5" data-testid="whiteboard-chat-card">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#dff4f2] text-[#12737d]"><Palette size={17} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#183a4b]">{displayTitle}</p>
        <p className="text-[11px] text-[#7c8c91]">Shared whiteboard</p>
      </div>
      <button type="button" onClick={() => props.onOpen(props.boardId)} data-testid={`button-open-shared-whiteboard-${props.boardId}`} className="flex items-center gap-1.5 rounded-lg bg-[#16869a] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#106d7a]"><Palette size={12} /> Open</button>
    </div>
  );
}