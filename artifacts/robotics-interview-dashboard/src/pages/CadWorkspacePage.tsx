import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Box,
  Boxes,
  ChevronRight,
  Download,
  FileBox,
  Folder,
  FolderOpen,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createCadBot,
  createCadFolder,
  deleteCadBot,
  deleteCadFolder,
  deleteCadModel,
  getListCadLibraryQueryKey,
  getCadStorageStatus,
  updateCadBot,
  updateCadFolder,
  updateCadModel,
  useListCadLibrary,
  type CadBot,
  type CadFolder,
  type CadModel,
} from "@workspace/api-client-react";

import { CadModelPreviewDialog } from "@/components/CadModelPreviewDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CAD_ACCEPT, cadFormatLabel, cadRenderFormat } from "@/lib/cadFormats";
import { useCadModelUpload, type CadDropTarget } from "@/lib/useCadModelUpload";
import { askValue, confirmAction } from "@/lib/dialogs";

/** Marks an internal drag so a drop can tell a model from an OS file. */
const MODEL_DRAG_TYPE = "application/x-cad-model-id";

type Location =
  | { kind: "unfiled" }
  | { kind: "bot"; botId: string }
  | { kind: "folder"; folderId: string };

function locationKey(location: Location): string {
  if (location.kind === "unfiled") return "unfiled";
  if (location.kind === "bot") return `bot:${location.botId}`;
  return `folder:${location.folderId}`;
}

function sameLocation(a: Location, b: Location): boolean {
  return locationKey(a) === locationKey(b);
}

/** The path of folder ids from the bot root down to `folderId`. */
function buildAncestry(
  folders: CadFolder[],
  folderId: string,
): CadFolder[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: CadFolder[] = [];
  let current = byId.get(folderId);
  // Bounded so a corrupted cycle in stored data cannot hang the page.
  for (let depth = 0; current && depth < 64; depth += 1) {
    chain.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return chain;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

export function CadWorkspacePage() {
  const queryClient = useQueryClient();
  const library = useListCadLibrary();
  const cadStorageStatus = useQuery({
    queryKey: ["/api/storage/cad-status"],
    queryFn: getCadStorageStatus,
    refetchInterval: 30_000,
    retry: false,
  });
  const [location, setLocation] = useState<Location>({ kind: "unfiled" });
  const [selectedModel, setSelectedModel] = useState<CadModel | null>(null);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [addingBot, setAddingBot] = useState(false);
  const [newBotName, setNewBotName] = useState("");
  const [pageDragActive, setPageDragActive] = useState(false);
  const dragDepth = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bots = library.data?.bots ?? [];
  const folders = library.data?.folders ?? [];
  const models = library.data?.models ?? [];

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: getListCadLibraryQueryKey() });
  }, [queryClient]);

  const { uploadFiles, progress, error: uploadError, busy: uploading, reset } =
    useCadModelUpload({
      onUploaded: (model) => {
        setLocation(
          model.folderId
            ? { kind: "folder", folderId: model.folderId }
            : model.botId
              ? { kind: "bot", botId: model.botId }
              : { kind: "unfiled" },
        );
        setNotice(`Added ${model.name}.`);
        refresh();
        void queryClient.invalidateQueries({ queryKey: ["/api/storage/cad-status"] });
      },
      onSettled: () => {
        refresh();
        void queryClient.invalidateQueries({ queryKey: ["/api/storage/cad-status"] });
      },
    });

  const activeBotId = useMemo(() => {
    if (location.kind === "bot") return location.botId;
    if (location.kind === "folder") {
      return folders.find((folder) => folder.id === location.folderId)?.botId ?? null;
    }
    return null;
  }, [location, folders]);

  const childrenOf = useCallback(
    (botId: string, parentId: string | null) =>
      folders
        .filter(
          (folder) => folder.botId === botId && (folder.parentId ?? null) === parentId,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );

  /**
   * Every folder id in a folder's subtree, including itself. Parent rows and
   * the grid both count/list nested models, so a model added to a subfolder
   * still shows up when its parent (or bot) is selected instead of reading 0.
   */
  const descendantIdsByFolder = useMemo(() => {
    const byParent = new Map<string, CadFolder[]>();
    for (const folder of folders) {
      const key = `${folder.botId}:${folder.parentId ?? "__root__"}`;
      const list = byParent.get(key);
      if (list) list.push(folder);
      else byParent.set(key, [folder]);
    }
    const result = new Map<string, Set<string>>();
    for (const folder of folders) {
      const collected = new Set<string>([folder.id]);
      const queue = [folder.id];
      for (let index = 0; index < queue.length && collected.size < 1000; index += 1) {
        const currentId = queue[index];
        const kids = byParent.get(`${folder.botId}:${currentId}`) ?? [];
        for (const kid of kids) {
          if (!collected.has(kid.id)) {
            collected.add(kid.id);
            queue.push(kid.id);
          }
        }
      }
      result.set(folder.id, collected);
    }
    return result;
  }, [folders]);

  const folderById = useMemo(
    () => new Map(folders.map((folder) => [folder.id, folder])),
    [folders],
  );

  const countInFolder = useCallback(
    (folderId: string): number => {
      const ids = descendantIdsByFolder.get(folderId);
      if (!ids) return models.filter((model) => model.folderId === folderId).length;
      return models.filter((model) => model.folderId != null && ids.has(model.folderId)).length;
    },
    [models, descendantIdsByFolder],
  );

  const visibleModels = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return models
      .filter((model) => {
        if (location.kind === "unfiled") return model.folderId === null && model.botId === null;
        if (location.kind === "bot") {
          return model.botId === location.botId;
        }
        const ids = descendantIdsByFolder.get(location.folderId);
        if (!ids) return model.folderId === location.folderId;
        return model.folderId != null && ids.has(model.folderId);
      })
      .filter((model) =>
        needle
          ? model.name.toLowerCase().includes(needle) ||
            model.fileName.toLowerCase().includes(needle)
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [models, location, search, descendantIdsByFolder]);

  const runAction = useCallback(
    async (action: () => Promise<unknown>, successMessage?: string) => {
      setBusy(true);
      try {
        await action();
        if (successMessage) setNotice(successMessage);
        refresh();
      } catch (actionError) {
        // ApiError exposes the parsed body on `data`; `response` is the raw
        // fetch Response, so reading `response.data` here always lost the
        // server's real reason and showed a generic message instead.
        const body = (actionError as { data?: { error?: unknown } }).data;
        setNotice(
          typeof body?.error === "string"
            ? body.error
            : actionError instanceof Error && actionError.message
              ? actionError.message
              : "That change could not be saved. Try again.",
        );
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  /** Uploads dropped files into whatever location the drop targeted. */
  const handleFiles = useCallback(
    (fileList: FileList | null, target: CadDropTarget) => {
      const files = Array.from(fileList ?? []);
      if (files.length === 0) return;
      reset();
      void uploadFiles(files, target);
    },
    [uploadFiles, reset],
  );

  // A drop carries either an OS file or an internal model id, and never both,
  // which is what lets one handler serve the tree and the grid.
  const readDrop = (event: DragEvent) => {
    const modelId = event.dataTransfer.getData(MODEL_DRAG_TYPE);
    if (modelId) return { kind: "model" as const, modelId };
    if (event.dataTransfer.files.length > 0) {
      return { kind: "files" as const, files: Array.from(event.dataTransfer.files) };
    }
    return null;
  };

  const moveModel = useCallback(
    (modelId: string, target: CadDropTarget) => {
      if (busy) return;
      void runAction(
        () => updateCadModel(modelId, { botId: target.botId, folderId: target.folderId }),
        "Model moved.",
      );
    },
    [busy, runAction],
  );

  const dropHandlers = (key: string, target: CadDropTarget) => ({
    onDragOver: (event: DragEvent) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      setDropTarget(key);
    },
    onDragLeave: () => setDropTarget((current) => (current === key ? null : current)),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setDropTarget(null);
      const dropped = readDrop(event);
      if (!dropped) return;
      if (dropped.kind === "files") void uploadFiles(dropped.files, target);
      else moveModel(dropped.modelId, target);
    },
  });

  const treeDropProps = (key: string, target: CadDropTarget) => ({
    ...dropHandlers(key, target),
    "data-drop-target": key,
    "data-drop-active": dropTarget === key ? "true" : undefined,
  });

  const renderFolderRow = (folder: CadFolder, botId: string, depth: number) => {
    const key = `folder:${folder.id}`;
    const isCollapsed = collapsed[key] ?? false;
    const children = childrenOf(botId, folder.id);
    const count = countInFolder(folder.id);
    const selected = location.kind === "folder" && location.folderId === folder.id;
    const active = dropTarget === key;
    return (
      <li key={folder.id}>
        <div
          {...treeDropProps(key, { botId, folderId: folder.id })}
          className={`group flex items-center gap-1 rounded-lg pr-1 transition ${
            selected ? "bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted"
          } ${active ? "ring-2 ring-primary" : ""}`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          {children.length > 0 ? (
            <button
              type="button"
              onClick={() => setCollapsed((current) => ({ ...current, [key]: !isCollapsed }))}
              aria-label={isCollapsed ? `Expand ${folder.name}` : `Collapse ${folder.name}`}
              aria-expanded={!isCollapsed}
              className="rounded p-0.5 hover:bg-muted-foreground/20"
            >
              <ChevronRight
                size={13}
                className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                aria-hidden="true"
              />
            </button>
          ) : (
            <span className="w-[18px]" aria-hidden="true" />
          )}
          <button
            type="button"
            onClick={() => setLocation({ kind: "folder", folderId: folder.id })}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left text-sm"
            data-testid={`cad-folder-${folder.id}`}
          >
            {isCollapsed ? (
              <Folder size={14} className="shrink-0" aria-hidden="true" />
            ) : (
              <FolderOpen size={14} className="shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{folder.name}</span>
            <span className="shrink-0 text-[11px] text-muted-foreground">{count}</span>
          </button>
          <button
            type="button"
            title="New subfolder"
            aria-label={`New subfolder in ${folder.name}`}
            onClick={async () => {
              const name = await askValue({ title: `New folder inside ${folder.name}`, label: "Folder name", placeholder: "Folder name" });
              if (name) {
                void runAction(
                  () => createCadFolder({ botId, parentId: folder.id, name }),
                  "Folder created.",
                );
              }
            }}
            className="cad-row-action rounded p-1 opacity-0 transition hover:bg-muted-foreground/20 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <FolderPlus size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Rename folder"
            aria-label={`Rename ${folder.name}`}
            onClick={async () => {
              const name = await askValue({ title: "Rename folder", label: "Folder name", initial: folder.name, confirmLabel: "Rename" });
              if (name && name !== folder.name) {
                void runAction(
                  () => updateCadFolder(folder.id, { name }),
                  "Folder renamed.",
                );
              }
            }}
            className="cad-row-action rounded p-1 opacity-0 transition hover:bg-muted-foreground/20 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <MoreHorizontal size={13} aria-hidden="true" />
          </button>
          <button
            type="button"
            title="Delete folder"
            aria-label={`Delete ${folder.name}`}
            onClick={async () => {
              if (!(await confirmAction({
                title: `Delete "${folder.name}"?`,
                detail: "Its subfolders go too. Models inside move to Unfiled.",
                danger: true,
                confirmLabel: "Delete",
              }))) {
                return;
              }
              void runAction(() => deleteCadFolder(folder.id), "Folder deleted.");
            }}
            className="cad-row-action rounded p-1 opacity-0 transition text-destructive hover:bg-destructive/10 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 size={13} aria-hidden="true" />
          </button>
        </div>
        {!isCollapsed && children.length > 0 && (
          <ul className="space-y-0.5">{children.map((child) => renderFolderRow(child, botId, depth + 1))}</ul>
        )}
      </li>
    );
  };

  const activeFolder = location.kind === "folder"
    ? folders.find((folder) => folder.id === location.folderId)
    : undefined;
  const activeBotName = activeBotId ? bots.find((bot) => bot.id === activeBotId)?.name : null;
  const title = location.kind === "unfiled"
    ? "Unfiled"
    : location.kind === "bot"
      ? activeBotName ?? "Bot"
      : activeFolder?.name ?? "Folder";
  const breadcrumb = location.kind === "folder" && activeFolder
    ? [bots.find((bot) => bot.id === activeFolder.botId)?.name, ...buildAncestry(folders, activeFolder.id).map((folder) => folder.name)]
    : null;

  const gridDropHandlers = dropHandlers("grid", {
    botId: location.kind === "unfiled" ? null : activeBotId,
    folderId: location.kind === "folder" ? location.folderId : null,
  });
  const gridDropProps = {
    ...dropHandlers("grid", {
      botId: location.kind === "unfiled" ? null : activeBotId,
      folderId: location.kind === "folder" ? location.folderId : null,
    }),
    "data-drop-target": "grid",
    // A file dragged anywhere over the grid highlights the whole grid, so the
    // drop zone is obvious before the pointer is released. Counting enter/leave
    // keeps the highlight from flickering as the pointer crosses child cards.
    onDragEnter: (event: DragEvent) => {
      event.preventDefault();
      dragDepth.current += 1;
      if (event.dataTransfer.types.includes("Files")) setPageDragActive(true);
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setPageDragActive(false);
    },
    onDrop: (event: DragEvent) => {
      dragDepth.current = 0;
      setPageDragActive(false);
      gridDropHandlers.onDrop(event);
    },
  };

  return (
    <div className="space-y-5">
      {!cadStorageStatus.isError && cadStorageStatus.data?.usingBackupStorage && (
        <div
          role="status"
          aria-live="polite"
          data-testid="cad-storage-failover"
          className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-foreground"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">CAD uploads are using backup storage</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New CAD files are being written to secondary storage. This notice clears when primary storage is healthy again.
            </p>
          </div>
        </div>
      )}
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mono mb-2 text-[10px] font-medium uppercase tracking-[.22em] text-primary">
            CAD library
          </p>
          <h1 className="text-3xl font-semibold tracking-[-.045em] md:text-4xl">Models</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Drop CAD models, robot photos, build videos, design docs, slide decks, and BOM spreadsheets anywhere to upload them, and drag files between folders to organise them. Everything renders inline just like chat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={CAD_ACCEPT}
            className="hidden"
            data-testid="cad-file-input"
            onChange={(event) => {
              handleFiles(event.target.files, {
                botId: location.kind === "unfiled" ? null : activeBotId,
                folderId: location.kind === "folder" ? location.folderId : null,
              });
              // Reset so re-picking the same file fires a change event again.
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setAddingBot(true);
              setNotice(null);
            }}
            data-testid="cad-new-bot"
          >
            <Plus size={15} aria-hidden="true" />
            New bot
          </Button>
          {addingBot && (
            <form
              className="flex w-full items-center gap-2 sm:w-auto"
              onSubmit={(event) => {
                event.preventDefault();
                const name = newBotName.trim();
                if (!name) {
                  setNotice("Give this bot a name.");
                  return;
                }
                void runAction(() => createCadBot({ name }), "Bot created.").finally(() => {
                  setNewBotName("");
                  setAddingBot(false);
                });
              }}
            >
              <Input
                autoFocus
                value={newBotName}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => setNewBotName(event.target.value)}
                placeholder="Bot name"
                aria-label="New bot name"
                data-testid="input-new-bot-name"
                className="h-9 min-w-[150px] flex-1 sm:w-52"
              />
              <Button type="submit" disabled={busy} data-testid="button-create-bot">
                {busy ? "Creating…" : "Create"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAddingBot(false);
                  setNewBotName("");
                }}
                data-testid="button-cancel-new-bot"
              >
                Cancel
              </Button>
            </form>
          )}
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            data-testid="cad-upload-button"
          >
            {uploading ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Upload size={15} aria-hidden="true" />
            )}
            Upload files
          </Button>
        </div>
      </header>

      {(notice || uploadError) && (
        <div
          role="status"
          className={`rounded-xl border px-4 py-3 text-sm ${
            uploadError
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-border bg-card text-foreground"
          }`}
          data-testid="cad-notice"
        >
          {uploadError ?? notice}
        </div>
      )}

      {uploading && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm" role="status">
          <p className="text-foreground">
            Uploading {progress.fileName ?? "model"}
            {progress.total > 1 ? ` (${Math.min(progress.completed + 1, progress.total)} of ${progress.total})` : ""}
            {progress.percent !== null ? ` — ${progress.percent}%` : ""}
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <div
            {...treeDropProps("unfiled", { botId: null, folderId: null })}
            className={`rounded-xl border p-3 transition ${
              dropTarget === "unfiled" ? "border-primary ring-2 ring-primary" : "border-border"
            }`}
          >
            <button
              type="button"
              onClick={() => setLocation({ kind: "unfiled" })}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition ${
                location.kind === "unfiled" ? "bg-primary/10 font-semibold" : "hover:bg-muted"
              }`}
              data-testid="cad-location-unfiled"
            >
              <FileBox size={15} className="shrink-0" aria-hidden="true" />
              <span className="flex-1">Unfiled</span>
              <span className="text-[11px] text-muted-foreground">
                {models.filter((model) => model.botId === null && model.folderId === null).length}
              </span>
            </button>
          </div>

          <div className="space-y-2">
            {bots.map((bot) => {
              const key = `bot:${bot.id}`;
              const isCollapsed = collapsed[key] ?? false;
              const selected = location.kind === "bot" && location.botId === bot.id;
              const topFolders = childrenOf(bot.id, null);
              const rootCount = models.filter((model) => model.botId === bot.id).length;
              return (
                <div
                  key={bot.id}
                  {...treeDropProps(key, { botId: bot.id, folderId: null })}
                  className={`rounded-xl border p-2 transition ${
                    dropTarget === key ? "border-primary ring-2 ring-primary" : "border-border"
                  }`}
                >
                  <div className="group flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCollapsed((current) => ({ ...current, [key]: !isCollapsed }))}
                      aria-label={isCollapsed ? `Expand ${bot.name}` : `Collapse ${bot.name}`}
                      aria-expanded={!isCollapsed}
                      className="rounded p-1 hover:bg-muted-foreground/20"
                    >
                      <ChevronRight
                        size={13}
                        className={`transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                        aria-hidden="true"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocation({ kind: "bot", botId: bot.id })}
                      className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1 py-1.5 text-left text-sm transition ${
                        selected ? "bg-primary/10 font-semibold" : "hover:bg-muted"
                      }`}
                      data-testid={`cad-bot-${bot.id}`}
                    >
                      <Boxes size={14} className="shrink-0" aria-hidden="true" />
                      <span className="truncate">{bot.name}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{rootCount}</span>
                    </button>
                    <button
                      type="button"
                      title="New folder"
                      aria-label={`New folder in ${bot.name}`}
                      onClick={async () => {
                        const name = await askValue({ title: `New folder inside ${bot.name}`, label: "Folder name", placeholder: "Folder name" });
                        if (name) {
                          void runAction(
                            () => createCadFolder({ botId: bot.id, name }),
                            "Folder created.",
                          );
                        }
                      }}
                      className="cad-row-action rounded p-1 opacity-0 transition hover:bg-muted-foreground/20 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <FolderPlus size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="Rename bot"
                      aria-label={`Rename ${bot.name}`}
                      onClick={async () => {
                        const name = await askValue({ title: "Rename bot", label: "Bot name", initial: bot.name, confirmLabel: "Rename" });
                        if (name && name !== bot.name) {
                          void runAction(
                            () => updateCadBot(bot.id, { name }),
                            "Bot renamed.",
                          );
                        }
                      }}
                      className="cad-row-action rounded p-1 opacity-0 transition hover:bg-muted-foreground/20 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <MoreHorizontal size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      title="Delete bot"
                      aria-label={`Delete ${bot.name}`}
                      onClick={async () => {
                        if (
                          !(await confirmAction({
                            title: `Delete "${bot.name}"?`,
                            detail: "Its folders go too, and every model inside is deleted with its file.",
                            danger: true,
                            confirmLabel: "Delete",
                          }))
                        ) {
                          return;
                        }
                        void runAction(() => deleteCadBot({ botId: bot.id }), "Bot deleted.");
                      }}
                      className="cad-row-action rounded p-1 opacity-0 transition text-destructive hover:bg-destructive/10 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                  {!isCollapsed && topFolders.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {topFolders.map((folder) => renderFolderRow(folder, bot.id, 1))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </aside>

        <section
          {...gridDropProps}
          className={`relative min-h-[420px] rounded-2xl border border-border bg-card p-5 transition ${
            dropTarget === "grid" ? "ring-2 ring-primary" : ""
          } ${pageDragActive ? "outline-2 outline-dashed outline-primary" : ""}`}
          data-testid="cad-model-grid"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <Box size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              {breadcrumb ? (
                <span className="truncate text-muted-foreground">
                  {breadcrumb.filter(Boolean).join(" / ")} / <strong className="text-foreground">{title}</strong>
                </span>
              ) : (
                <strong className="text-foreground">{title}</strong>
              )}
              <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {visibleModels.length}
              </span>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter models"
              aria-label="Filter models"
              className="h-9 w-full max-w-[220px]"
              data-testid="cad-search"
            />
          </div>

          {visibleModels.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-center">
              <FileBox size={28} className="text-muted-foreground" aria-hidden="true" />
              <p className="text-sm font-medium text-foreground">
                {search ? "No models match that filter" : "No models here yet"}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Drag CAD models, images, videos, documents, presentations, or spreadsheets onto this area, or onto a bot or folder to file them there. Robot designs in any format render inline just like chat.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleModels.map((model) => {
                const format = cadRenderFormat(model.fileName, model.contentType);
                const modelFolder = model.folderId ? folderById.get(model.folderId) : null;
                const showFolderHint =
                  (location.kind === "bot" || location.kind === "folder") &&
                  modelFolder &&
                  (location.kind === "bot" || model.folderId !== location.folderId);
                return (
                  <li key={model.id}>
                    <div
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(MODEL_DRAG_TYPE, model.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      className="group relative flex h-full cursor-grab flex-col gap-2 rounded-xl border border-border bg-background p-3 transition hover:border-primary/60 active:cursor-grabbing"
                      data-testid={`cad-model-${model.id}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedModel(model)}
                        className="flex flex-1 flex-col gap-2 text-left"
                        aria-label={`Preview ${model.name}`}
                      >
                        <span className="flex items-center gap-2">
                          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                            {format ? cadFormatLabel(format) : "File"}
                          </span>
                          <span className="truncate text-sm font-semibold text-foreground">
                            {model.name}
                          </span>
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {model.fileName} · {formatBytes(model.sizeBytes)}
                          {showFolderHint ? ` · in ${modelFolder.name}` : ""}
                        </span>
                      </button>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">
                          {model.uploadedBy ?? "Unknown"}
                        </span>
                        <span className="flex items-center gap-1">
                          <a
                            href={`${import.meta.env.BASE_URL}api/storage${model.objectPath}`}
                            download={model.fileName}
                            onClick={(event) => event.stopPropagation()}
                            title="Download original file"
                            aria-label={`Download ${model.fileName}`}
                            className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                          >
                            <Download size={13} aria-hidden="true" />
                          </a>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!(await confirmAction({ title: `Delete "${model.name}" and its file?`, danger: true, confirmLabel: "Delete" }))) return;
                              void runAction(
                                () => deleteCadModel(model.id),
                                "Model deleted.",
                              );
                            }}
                            title="Delete model"
                            aria-label={`Delete ${model.name}`}
                            className="rounded p-1 text-destructive transition hover:bg-destructive/10"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {selectedModel && (
        <CadModelPreviewDialog
          model={selectedModel}
          bots={bots}
          folders={folders}
          onClose={() => setSelectedModel(null)}
          onChanged={() => {
            refresh();
            const latest = queryClient
              .getQueryData<{ bots: CadBot[]; folders: CadFolder[]; models: CadModel[] }>(
                getListCadLibraryQueryKey(),
              )
              ?.models.find((model) => model.id === selectedModel.id);
            if (latest) setSelectedModel(latest);
            else setSelectedModel(null);
          }}
        />
      )}
    </div>
  );
}
