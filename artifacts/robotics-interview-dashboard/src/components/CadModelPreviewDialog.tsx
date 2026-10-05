import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Download, Folder, Trash2, X } from "lucide-react";
import {
  deleteCadModel,
  updateCadModel,
  type CadBot,
  type CadFolder,
  type CadModel,
} from "@workspace/api-client-react";

import { CadModelViewer, describeCadModel } from "./CadModelViewer";

type CadModelPreviewDialogProps = {
  model: CadModel;
  bots: CadBot[];
  folders: CadFolder[];
  onClose: () => void;
  onChanged: () => void;
};

export function storageUrl(objectPath: string): string {
  const base = String(import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  const path = objectPath.startsWith("/") ? objectPath : `/${objectPath}`;
  return `${base}/api/storage${path}`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { error?: unknown } } }).response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return fallback;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/** Every folder that can hold this model, with its full path from the bot root. */
function folderOptions(folders: CadFolder[]): {
  label: string;
  folderId: string;
  botId: string;
  depth: number;
}[] {
  const childrenOf = (botId: string, parentId: string | null) =>
    folders
      .filter((folder) => folder.botId === botId && (folder.parentId ?? null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));

  const options: { label: string; folderId: string; botId: string; depth: number }[] = [];
  // Bounded so a corrupted parent cycle cannot hang the dialog.
  const walk = (botId: string, parentId: string | null, depth: number, path: string[]) => {
    if (depth > 32) return;
    for (const folder of childrenOf(botId, parentId)) {
      const nextPath = [...path, folder.name];
      options.push({ label: nextPath.join(" / "), folderId: folder.id, botId, depth });
      walk(botId, folder.id, depth + 1, nextPath);
    }
  };
  for (const botId of new Set(folders.map((folder) => folder.botId))) {
    walk(botId, null, 0, []);
  }
  return options;
}

export function CadModelPreviewDialog({
  model,
  bots,
  folders,
  onClose,
  onChanged,
}: CadModelPreviewDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(model.name);
  const [notes, setNotes] = useState(model.notes ?? "");

  const src = storageUrl(model.objectPath);
  const { format, hint } = describeCadModel(model.fileName, model.contentType);
  const options = folderOptions(folders);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (actionError) {
      setError(errorMessage(actionError, "That change could not be saved."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#112433]/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`${model.name} preview`}
      data-testid="cad-preview-dialog"
    >
      <div className="my-8 w-full max-w-3xl rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                {format}
              </span>
              <h2 className="truncate text-lg font-semibold tracking-[-.02em]">
                {model.name}
              </h2>
            </div>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {model.fileName} · {formatBytes(model.sizeBytes)} · {hint}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-muted"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="border-b border-border bg-muted/30 p-4">
          <CadModelViewer name={model.fileName} src={src} contentType={model.contentType} />
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <label className="block text-xs font-medium text-foreground">
            Name
            <Input
              value={name}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
              className="mt-1"
              disabled={busy}
              data-testid="cad-preview-name"
            />
          </label>
          <label className="block text-xs font-medium text-foreground">
            Location
            <select
              value={model.folderId ?? ""}
              onChange={(event) => {
                const folderId = event.target.value || null;
                const folder = folders.find((candidate) => candidate.id === folderId);
                void run(() =>
                  updateCadModel(
                    model.id,
                    {
                    botId: folder ? folder.botId : null,
                    folderId,
                  }),
                );
              }}
              disabled={busy}
              className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              data-testid="cad-preview-location"
            >
              <option value="">Unfiled</option>
              {bots.map((bot) => (
                <optgroup key={bot.id} label={bot.name}>
                  <option value="">{`${bot.name} (root)`}</option>
                  {options
                    .filter((option) => option.botId === bot.id)
                    .map((option) => (
                      <option key={option.folderId} value={option.folderId}>
                        {`${"  ".repeat(option.depth)}${option.label}`}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-foreground sm:col-span-2">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              disabled={busy}
              className="mt-1 w-full rounded-md border border-input bg-background p-2 text-sm"
              data-testid="cad-preview-notes"
            />
          </label>
        </div>

        {error && (
          <p className="px-5 pb-3 text-xs text-destructive" role="alert" data-testid="cad-preview-error">
            {error}
          </p>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-5">
          <button
            type="button"
            onClick={() => {
              if (!window.confirm(`Delete "${model.name}" and its file?`)) return;
              void run(() => deleteCadModel(model.id)).then(onChanged);
            }}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/10"
            data-testid="cad-preview-delete"
          >
            <Trash2 size={13} aria-hidden="true" />
            Delete
          </button>
          <div className="flex items-center gap-2">
            <a
              href={src}
              download={model.fileName}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold transition hover:bg-muted"
            >
              <Download size={13} aria-hidden="true" />
              Download
            </a>
            <button
              type="button"
              onClick={() =>
                void run(() =>
                  updateCadModel(model.id, {
                    name: name.trim() || model.name,
                    notes: notes.trim() || null,
                  }),
                )
              }
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              data-testid="cad-preview-save"
            >
              <Folder size={13} aria-hidden="true" />
              Save changes
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
