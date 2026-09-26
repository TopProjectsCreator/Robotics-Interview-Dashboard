import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Download, FileSpreadsheet, LoaderCircle, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useLocation } from "wouter";
import {
  getGetSpreadsheetQueryKey,
  useGetSpreadsheet,
  useUpdateSpreadsheet,
  type Spreadsheet,
  type SpreadsheetData,
} from "@workspace/api-client-react";

type SpreadsheetEditorProps = { spreadsheetId: string };
type SaveState = "saved" | "saving" | "error";

const MAX_COLUMNS = 40;
const MAX_ROWS = 1000;
const MAX_CELL_LENGTH = 4000;

function columnLabel(index: number) {
  let value = "";
  let current = index + 1;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    value = String.fromCharCode(65 + remainder) + value;
    current = Math.floor((current - 1) / 26);
  }
  return value;
}

function copyData(data: SpreadsheetData): SpreadsheetData {
  return {
    kind: "spreadsheet",
    version: 1,
    columnCount: data.columnCount,
    rows: data.rows.map(row => [...row]),
  };
}

function normalizeData(data: SpreadsheetData): SpreadsheetData {
  const columnCount = Math.min(MAX_COLUMNS, Math.max(1, Math.floor(data.columnCount || 1)));
  const rows = data.rows.slice(0, MAX_ROWS).map(row =>
    Array.from({ length: columnCount }, (_, columnIndex) => String(row[columnIndex] ?? "").slice(0, MAX_CELL_LENGTH)),
  );
  return {
    kind: "spreadsheet",
    version: 1,
    columnCount,
    rows: rows.length ? rows : [Array.from({ length: columnCount }, () => "")],
  };
}

function formatSavedAt(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? "" : timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getReturnLocation() {
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  return candidate && /^\/(?:queue|chat)(?:\?[^#]*)?$/.test(candidate) ? candidate : "/chat";
}

function SaveStatus({ state, savedAt, error }: { state: SaveState; savedAt: string; error: string }) {
  if (state === "saving") {
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="status-spreadsheet-saving"><LoaderCircle size={13} className="animate-spin text-accent" />Saving changes</span>;
  }
  if (state === "error") {
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive" data-testid="status-spreadsheet-error"><TriangleAlert size={13} />{error || "Could not save changes"}</span>;
  }
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="status-spreadsheet-saved"><Check size={13} className="text-primary" />Saved{savedAt ? ` ${savedAt}` : ""}</span>;
}

export function SpreadsheetEditor({ spreadsheetId }: SpreadsheetEditorProps) {
  const [, setLocation] = useLocation();
  const returnTo = useMemo(() => getReturnLocation(), []);
  const queryClient = useQueryClient();
  const query = useGetSpreadsheet(spreadsheetId, {
    query: {
      queryKey: getGetSpreadsheetQueryKey(spreadsheetId),
      enabled: Boolean(spreadsheetId),
      refetchOnWindowFocus: true,
      refetchInterval: 5_000,
    },
  });
  const updateSpreadsheet = useUpdateSpreadsheet();
  const [title, setTitle] = useState("");
  const [data, setData] = useState<SpreadsheetData | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const initializedForId = useRef<string | null>(null);
  const lastSaved = useRef<{ title: string; data: SpreadsheetData } | null>(null);
  const lastServerUpdatedAt = useRef("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title: string; data: SpreadsheetData } | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRequestId = useRef(0);
  const titleRef = useRef(title);
  titleRef.current = title;
  const dataRef = useRef(data);
  dataRef.current = data;

  const spreadsheet = query.data as Spreadsheet | undefined;
  useEffect(() => {
    if (!spreadsheet) return;
    const nextData = normalizeData(spreadsheet.data);
    if (initializedForId.current !== spreadsheetId) {
      initializedForId.current = spreadsheetId;
      lastServerUpdatedAt.current = spreadsheet.updatedAt;
      setTitle(spreadsheet.title);
      setData(nextData);
      setSaveState("saved");
      setSaveError("");
      setSavedAt(formatSavedAt(spreadsheet.updatedAt));
      lastSaved.current = { title: spreadsheet.title, data: copyData(nextData) };
      return;
    }
    const canApplyRemoteUpdate = spreadsheet.updatedAt !== lastServerUpdatedAt.current
      && saveState === "saved"
      && !saveTimer.current
      && !pendingRef.current
      && !updateSpreadsheet.isPending;
    if (!canApplyRemoteUpdate) return;
    lastServerUpdatedAt.current = spreadsheet.updatedAt;
    setTitle(spreadsheet.title);
    setData(nextData);
    setSaveError("");
    setSavedAt(formatSavedAt(spreadsheet.updatedAt));
    lastSaved.current = { title: spreadsheet.title, data: copyData(nextData) };
  }, [spreadsheet, spreadsheetId, saveState, updateSpreadsheet.isPending]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const commit = async (nextTitle: string, nextData: SpreadsheetData) => {
    if (!initializedForId.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pendingRef.current = null;
    const payload = { title: nextTitle.trim(), data: copyData(nextData) };
    if (!payload.title) return;
    setSaveState("saving");
    setSaveError("");
    const requestId = ++saveRequestId.current;
    const request = saveQueue.current.then(async () => {
      const previous = lastSaved.current;
      if (previous && previous.title === payload.title && JSON.stringify(previous.data) === JSON.stringify(payload.data)) {
        if (requestId === saveRequestId.current && !pendingRef.current && !saveTimer.current) {
          setSaveError("");
          setSaveState("saved");
        }
        return;
      }
      try {
        const saved = await updateSpreadsheet.mutateAsync({ spreadsheetId, data: payload });
        const savedData = normalizeData(saved.data);
        lastSaved.current = { title: saved.title, data: copyData(savedData) };
        lastServerUpdatedAt.current = saved.updatedAt;
        queryClient.setQueryData(getGetSpreadsheetQueryKey(spreadsheetId), { ...saved, data: savedData });
        setSavedAt(formatSavedAt(saved.updatedAt));
        if (requestId === saveRequestId.current && !pendingRef.current && !saveTimer.current) {
          setSaveState("saved");
        }
      } catch (error) {
        if (requestId === saveRequestId.current && !pendingRef.current) {
          setSaveState("error");
          setSaveError(error instanceof Error ? error.message : "Could not save changes");
        }
      }
    });
    saveQueue.current = request;
    await request;
  };

  const scheduleSave = (nextTitle: string, nextData: SpreadsheetData) => {
    pendingRef.current = { title: nextTitle, data: copyData(nextData) };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) void commit(pending.title, pending.data);
    }, 650);
  };

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    if (!data) return;
    const nextData = copyData(data);
    nextData.rows[rowIndex][columnIndex] = value.slice(0, MAX_CELL_LENGTH);
    setData(nextData);
    scheduleSave(titleRef.current, nextData);
  };

  const addRow = () => {
    if (!data || data.rows.length >= MAX_ROWS) return;
    const nextData = copyData(data);
    nextData.rows.push(Array.from({ length: data.columnCount }, () => ""));
    setData(nextData);
    scheduleSave(titleRef.current, nextData);
  };

  const addColumn = () => {
    if (!data || data.columnCount >= MAX_COLUMNS) return;
    const nextData = copyData(data);
    nextData.columnCount += 1;
    nextData.rows = nextData.rows.map(row => [...row, ""]);
    setData(nextData);
    scheduleSave(titleRef.current, nextData);
  };

  const onTitleChange = (value: string) => {
    const nextTitle = value.slice(0, 120);
    setTitle(nextTitle);
    if (data && nextTitle.trim()) scheduleSave(nextTitle, data);
  };

  const restoreTitleIfEmpty = () => {
    if (titleRef.current.trim()) return;
    const fallback = lastSaved.current?.title || "Untitled spreadsheet";
    setTitle(fallback);
    if (dataRef.current) scheduleSave(fallback, dataRef.current);
  };

  const leaveSpreadsheet = () => {
    const titleToSave = titleRef.current.trim() || lastSaved.current?.title || "Untitled spreadsheet";
    if (dataRef.current) void commit(titleToSave, dataRef.current);
    setLocation(returnTo);
  };

  const exportXlsx = async () => {
    if (!data) return;
    setExporting(true);
    setExportError("");
    try {
      const XLSX = await import("xlsx");
      const worksheet = XLSX.utils.aoa_to_sheet(data.rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Tryout worksheet");
      XLSX.writeFile(workbook, `${(title.trim() || "tryout-worksheet").replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").toLowerCase()}.xlsx`);
    } catch {
      setExportError("Could not export this worksheet. Try again.");
    } finally {
      setExporting(false);
    }
  };

  const gridRows = useMemo(() => data?.rows ?? [], [data]);
  if (query.isLoading) {
    return (
      <main className="min-h-[calc(100dvh-72px)] bg-background p-4 sm:p-8" data-testid="status-spreadsheet-loading">
        <div className="mx-auto max-w-[1440px] animate-pulse space-y-4">
          <div className="h-10 w-72 rounded-xl bg-muted" />
          <div className="h-[60dvh] rounded-2xl bg-muted" />
        </div>
      </main>
    );
  }

  if (query.isError || !data) {
    return (
      <main className="flex min-h-[calc(100dvh-72px)] items-center justify-center bg-background p-6" data-testid="status-spreadsheet-error-page">
        <div className="max-w-sm text-center">
          <TriangleAlert size={30} className="mx-auto text-destructive" />
          <h1 className="mt-4 text-lg font-semibold">Spreadsheet unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">This worksheet could not be loaded in the current workspace.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button type="button" onClick={() => void query.refetch()} data-testid="button-retry-spreadsheet" className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><RefreshCw size={14} />Retry</button>
            <button type="button" onClick={() => setLocation(returnTo)} data-testid="button-close-spreadsheet-error" className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground">Back to chat</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="spreadsheet-editor min-h-[calc(100dvh-72px)] bg-background text-foreground" data-testid="spreadsheet-editor">
      <div className="mx-auto flex max-w-[1500px] flex-col px-3 py-4 sm:px-6 sm:py-6">
        <header className="flex flex-wrap items-start gap-4 border-b border-border pb-5">
          <button type="button" onClick={leaveSpreadsheet} aria-label="Back to chat" data-testid="button-back-to-chat" className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"><ArrowLeft size={16} /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-primary"><FileSpreadsheet size={17} /><span className="mono text-[10px] font-bold uppercase tracking-[.18em]">Shared worksheet</span></div>
            <input value={title} onChange={event => onTitleChange(event.target.value)} onBlur={restoreTitleIfEmpty} aria-label="Spreadsheet title" data-testid="input-spreadsheet-title" className="mt-1 w-full max-w-2xl bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground sm:text-3xl" placeholder="Name this worksheet" maxLength={120} />
            <p className="mt-1 text-xs text-muted-foreground">A dependable team worksheet for the Wolverines tryout room.</p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
            <SaveStatus state={saveState} savedAt={savedAt} error={saveError} />
            <button type="button" onClick={() => void exportXlsx()} disabled={exporting} data-testid="button-export-spreadsheet" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"><Download size={14} />{exporting ? "Preparing…" : "Export XLSX"}</button>
          </div>
        </header>
        {exportError && <p className="mt-3 text-xs text-destructive" role="alert" data-testid="spreadsheet-export-error">{exportError}</p>}
        {saveState === "error" && <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert" data-testid="spreadsheet-save-error"><TriangleAlert size={14} /><span>{saveError || "Your latest changes were not saved."}</span><button type="button" onClick={() => { const titleToSave = titleRef.current.trim() || lastSaved.current?.title || "Untitled spreadsheet"; if (dataRef.current) void commit(titleToSave, dataRef.current); }} data-testid="button-retry-spreadsheet-save" className="ml-auto rounded-md border border-destructive/30 px-2 py-1 font-semibold">Retry save</button></div>}
        <div className="mt-5 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/35 px-3 py-2.5 sm:px-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="mono rounded-md bg-card px-2 py-1">{gridRows.length} rows</span><span className="mono rounded-md bg-card px-2 py-1">{data.columnCount} columns</span><span className="hidden sm:inline">Changes save automatically for everyone in this conversation.</span></div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={addRow} disabled={gridRows.length >= MAX_ROWS} data-testid="button-add-spreadsheet-row" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} />Row</button>
              <button type="button" onClick={addColumn} disabled={data.columnCount >= MAX_COLUMNS} data-testid="button-add-spreadsheet-column" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"><Plus size={14} />Column</button>
            </div>
          </div>
          <div className="max-h-[calc(100dvh-275px)] min-h-[420px] overflow-auto">
            <table className="min-w-[760px] border-collapse text-left text-sm" data-testid="spreadsheet-grid">
              <thead className="sticky top-0 z-10 bg-muted text-[10px] uppercase tracking-[.12em] text-muted-foreground">
                <tr><th className="sticky left-0 z-20 w-12 border-b border-r border-border bg-muted px-3 py-2 text-center font-bold">#</th>{Array.from({ length: data.columnCount }, (_, columnIndex) => <th key={columnIndex} className="min-w-[170px] border-b border-r border-border px-3 py-2 font-bold" data-testid={`header-spreadsheet-column-${columnIndex}`}>{columnLabel(columnIndex)}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-border">
                {gridRows.map((row, rowIndex) => <tr key={rowIndex} data-testid={`row-spreadsheet-${rowIndex}`} className="group">
                  <th className="sticky left-0 z-[1] border-r border-border bg-muted/60 px-3 py-1 text-center font-mono text-[11px] font-medium text-muted-foreground group-hover:bg-accent">{rowIndex + 1}</th>
                  {row.map((cell, columnIndex) => <td key={columnIndex} className="border-r border-border bg-card p-0 align-top group-hover:bg-accent/30"><textarea value={cell} onChange={event => updateCell(rowIndex, columnIndex, event.target.value)} aria-label={`${columnLabel(columnIndex)}${rowIndex + 1}`} data-testid={`input-spreadsheet-cell-${rowIndex}-${columnIndex}`} rows={1} maxLength={MAX_CELL_LENGTH} className="block min-h-10 w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-5 text-foreground outline-none focus:bg-primary/5 focus:ring-2 focus:ring-inset focus:ring-primary" /></td>)}
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-[11px] text-muted-foreground"><span>Cells support up to 4,000 characters. Worksheet limit: 40 columns by 1,000 rows.</span><span className="mono">v1 · {spreadsheetId.slice(0, 8)}</span></footer>
      </div>
    </main>
  );
}