import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Check,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Play,
  RefreshCw,
  Square,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { useLocation } from "wouter";
import { Workbook, type WorkbookInstance } from "@fortune-sheet/react";
import "@fortune-sheet/react/dist/index.css";
import "./SpreadsheetEditor.css";
import { transformExcelToFortune, transformFortuneToExcel } from "@corbe30/fortune-excel";
import {
  getGetSpreadsheetQueryKey,
  useGetSpreadsheet,
  useUpdateSpreadsheet,
  type Spreadsheet,
  type SpreadsheetData,
  type SpreadsheetDataWorkbookItem,
} from "@workspace/api-client-react";
import { normalizeSavedSheetSelection } from "../lib/spreadsheet-selection";

type SpreadsheetEditorProps = { spreadsheetId: string };
type SaveState = "saved" | "saving" | "error" | "conflict";
type WorkbookSheet = SpreadsheetDataWorkbookItem & Record<string, unknown> & {
  row?: number;
  column?: number;
  status?: number;
  hide?: number;
  data?: unknown;
  celldata?: unknown;
  charts?: unknown;
};
type SafeMacroOperation = {
  op: "setCell";
  sheetId: string;
  row: number;
  column: number;
  value: string | number | boolean | null;
  formula?: boolean;
};
type SafeMacro = { id: string; name: string; operations: SafeMacroOperation[] };
type SavedChart = {
  id: string;
  title: string;
  type: "bar" | "line";
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
};
type ChartSeries = { name: string; values: number[] };
type ChartModel = { labels: string[]; series: ChartSeries[] };
type ChartRange = Pick<SavedChart, "startRow" | "endRow" | "startColumn" | "endColumn">;

const MAX_COLUMNS = 16_384;
const MAX_ROWS = 1_048_576;
const MAX_CELL_LENGTH = 32_767;
const MAX_SPREADSHEET_BYTES = 8_000_000;
const MAX_MACROS = 25;
const MAX_MACRO_OPERATIONS = 200;
const MAX_CHARTS = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeDimension(value: unknown, fallback: number, maximum: number): number {
  const dimension = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(dimension) || dimension < 1) return fallback;
  return Math.min(maximum, Math.floor(dimension));
}

function copyData(data: SpreadsheetData): SpreadsheetData {
  return JSON.parse(JSON.stringify(data)) as SpreadsheetData;
}

function sheetNameCandidate(value: unknown, fallback: string): string {
  const raw = typeof value === "string" ? value : fallback;
  const sanitized = raw
    .split("")
    .map((character) => "\\/:*?[]".includes(character) ? "_" : character)
    .join("")
    .trim()
    .slice(0, 31);
  return sanitized || fallback.slice(0, 31);
}

function sparseCellsFromData(data: unknown): { r: number; c: number; v: unknown }[] | null {
  if (!Array.isArray(data)) return null;
  const cells: { r: number; c: number; v: unknown }[] = [];
  data.forEach((row, r) => {
    if (!Array.isArray(row)) return;
    row.forEach((value, c) => {
      if (value !== null && value !== undefined) cells.push({ r, c, v: value });
    });
  });
  return cells;
}

function normalizeSheets(input: unknown, previous: WorkbookSheet[] = []): WorkbookSheet[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 255) {
    throw new Error("This workbook must contain between 1 and 255 worksheets.");
  }
  const usedIds = new Set<string>();
  const usedNames = new Set<string>();
  return input.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`Worksheet ${index + 1} is not valid.`);
    const oldSheet = previous.find((sheet) => sheet.id === raw.id) ?? previous[index];
    let id = typeof raw.id === "string" && raw.id.trim()
      ? raw.id.slice(0, 120)
      : oldSheet?.id || `sheet-${index + 1}`;
    if (usedIds.has(id)) id = `sheet-${index + 1}-${crypto.randomUUID().slice(0, 8)}`;
    usedIds.add(id);

    const initialName = sheetNameCandidate(raw.name ?? oldSheet?.name, `Sheet${index + 1}`);
    let name = initialName;
    let suffix = 2;
    while (usedNames.has(name.toLocaleLowerCase())) {
      const ending = ` (${suffix})`;
      name = `${initialName.slice(0, Math.max(1, 31 - ending.length))}${ending}`;
      suffix += 1;
    }
    usedNames.add(name.toLocaleLowerCase());
    const merged: WorkbookSheet = {
      ...(oldSheet ?? {}),
      ...raw,
      id,
      name,
      order: index,
    };
    merged.row = normalizeDimension(merged.row, 1000, MAX_ROWS);
    merged.column = normalizeDimension(merged.column, 26, MAX_COLUMNS);
    const savedSelection = raw.luckysheet_select_save === undefined
      ? oldSheet?.luckysheet_select_save
      : raw.luckysheet_select_save;
    if (savedSelection !== undefined) {
      merged.luckysheet_select_save = normalizeSavedSheetSelection(
        savedSelection,
        merged.row ?? 1000,
        merged.column ?? 26,
      );
    }
    const convertedCells = sparseCellsFromData(raw.data);
    if (convertedCells) {
      merged.celldata = convertedCells;
      delete merged.data;
    } else if (Array.isArray(raw.celldata)) {
      delete merged.data;
    }
    if (raw.charts === undefined && oldSheet?.charts !== undefined) {
      merged.charts = oldSheet.charts;
    }
    return merged;
  });
}

function normalizeData(data: SpreadsheetData): SpreadsheetData {
  if (data.version === 1) {
    const columnCount = Math.min(MAX_COLUMNS, Math.max(1, Math.floor(data.columnCount || 1)));
    const rows = (data.rows ?? []).slice(0, MAX_ROWS);
    const celldata: { r: number; c: number; v: Record<string, unknown> }[] = [];
    rows.forEach((row, rowIndex) => row.slice(0, columnCount).forEach((value, columnIndex) => {
      const text = String(value ?? "").slice(0, MAX_CELL_LENGTH);
      if (!text) return;
      celldata.push({
        r: rowIndex,
        c: columnIndex,
        v: text.startsWith("=") ? { f: text } : { v: text },
      });
    }));
    return {
      kind: "spreadsheet",
      version: 2,
      workbook: [{
        id: "legacy-sheet-1",
        name: "Sheet1",
        order: 0,
        status: 1,
        row: Math.max(1000, rows.length),
        column: columnCount,
        defaultRowHeight: 24,
        defaultColWidth: 100,
        celldata,
        config: {},
      }],
      macros: [],
    };
  }
  if (data.version !== 2 || !Array.isArray(data.workbook) || data.workbook.length === 0) {
    throw new Error("The saved workbook format is not supported.");
  }
  const workbook = normalizeSheets(data.workbook);
  return {
    ...copyData(data),
    kind: "spreadsheet",
    version: 2,
    workbook,
    macros: Array.isArray(data.macros) ? data.macros : [],
  };
}

function formatSavedAt(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? ""
    : timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getReturnLocation() {
  const candidate = new URLSearchParams(window.location.search).get("returnTo");
  return candidate && /^\/(?:queue|chat)(?:\?[^#]*)?$/.test(candidate) ? candidate : "/chat";
}

function activeSheet(workbook: WorkbookSheet[]): WorkbookSheet | null {
  return workbook.find((sheet) => sheet.status === 1 && sheet.hide !== 1) ??
    workbook.find((sheet) => sheet.hide !== 1) ??
    workbook[0] ??
    null;
}

function cellAt(sheet: WorkbookSheet, row: number, column: number): Record<string, unknown> | null {
  if (Array.isArray(sheet.celldata)) {
    const found = sheet.celldata.find((cell) =>
      isRecord(cell) && cell.r === row && cell.c === column,
    );
    return isRecord(found) && isRecord(found.v) ? found.v : null;
  }
  if (!Array.isArray(sheet.data)) return null;
  const rowData = sheet.data[row];
  if (!Array.isArray(rowData)) return null;
  const cell = rowData[column];
  return isRecord(cell) ? cell : null;
}

function displayedCellValue(cell: Record<string, unknown> | null): unknown {
  if (!cell) return "";
  if (cell.m !== undefined && cell.m !== null && cell.m !== "") return cell.m;
  if (cell.v !== undefined && cell.v !== null) return cell.v;
  return cell.f ?? "";
}

function macroCellMap(sheet: WorkbookSheet): Map<string, { row: number; column: number; value: unknown; formula: boolean }> {
  const cells = new Map<string, { row: number; column: number; value: unknown; formula: boolean }>();
  const add = (row: number, column: number, cell: unknown) => {
    if (!isRecord(cell)) return;
    const formula = typeof cell.f === "string" && Boolean(cell.f);
    const value = formula ? cell.f : cell.v;
    if (value === undefined || value === "") return;
    cells.set(`${row}:${column}`, { row, column, value, formula });
  };
  if (Array.isArray(sheet.celldata)) {
    for (const entry of sheet.celldata) {
      if (isRecord(entry) && Number.isInteger(entry.r) && Number.isInteger(entry.c)) {
        add(entry.r as number, entry.c as number, entry.v);
      }
    }
  } else if (Array.isArray(sheet.data)) {
    sheet.data.forEach((row, rowIndex) => {
      if (Array.isArray(row)) row.forEach((cell, columnIndex) => add(rowIndex, columnIndex, cell));
    });
  }
  return cells;
}

function macroDiff(before: WorkbookSheet[], after: WorkbookSheet[]): SafeMacroOperation[] {
  const operations: SafeMacroOperation[] = [];
  for (const nextSheet of after) {
    const oldSheet = before.find((sheet) => sheet.id === nextSheet.id);
    if (!oldSheet) continue;
    const oldCells = macroCellMap(oldSheet);
    const newCells = macroCellMap(nextSheet);
    const keys = new Set([...oldCells.keys(), ...newCells.keys()]);
    for (const key of keys) {
      const oldCell = oldCells.get(key);
      const newCell = newCells.get(key);
      if (
        oldCell &&
        newCell &&
        oldCell.formula === newCell.formula &&
        JSON.stringify(oldCell.value) === JSON.stringify(newCell.value)
      ) continue;
      const coordinates = (newCell ?? oldCell)!;
      const rawValue = newCell?.value;
      const value = rawValue === null || rawValue === undefined ? null :
        typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean"
          ? rawValue
          : null;
      operations.push({
        op: "setCell",
        sheetId: nextSheet.id,
        row: coordinates.row,
        column: coordinates.column,
        value,
        ...(newCell?.formula ? { formula: true } : {}),
      });
    }
  }
  return operations;
}

function isSafeMacroOperation(value: unknown): value is SafeMacroOperation {
  return isRecord(value) &&
    value.op === "setCell" &&
    typeof value.sheetId === "string" &&
    Number.isInteger(value.row) &&
    Number.isInteger(value.column) &&
    (typeof value.value === "string" ||
      typeof value.value === "number" ||
      typeof value.value === "boolean" ||
      value.value === null) &&
    (value.formula === undefined || typeof value.formula === "boolean");
}

function sheetCellDisplay(sheet: WorkbookSheet, row: number, column: number): string {
  const value = displayedCellValue(cellAt(sheet, row, column));
  return value === null || value === undefined ? "" : String(value);
}

function chartModelFor(sheet: WorkbookSheet, chart: SavedChart): ChartModel {
  const series: ChartSeries[] = [];
  const labels: string[] = [];
  if (chart.endColumn <= chart.startColumn || chart.endRow <= chart.startRow) {
    return { labels, series };
  }
  for (let row = chart.startRow + 1; row <= chart.endRow; row += 1) {
    labels.push(sheetCellDisplay(sheet, row, chart.startColumn) || String(row + 1));
  }
  for (let column = chart.startColumn + 1; column <= chart.endColumn; column += 1) {
    const name = sheetCellDisplay(sheet, chart.startRow, column) || `Series ${column - chart.startColumn}`;
    const values = labels.map((_, index) => {
      const raw = displayedCellValue(cellAt(sheet, chart.startRow + 1 + index, column));
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
      const parsed = Number(String(raw ?? "").replace(/[,$%\s]/g, ""));
      return Number.isFinite(parsed) ? parsed : 0;
    });
    series.push({ name, values });
  }
  return { labels, series };
}

function ChartCard({
  chart,
  sheet,
  onDelete,
}: {
  chart: SavedChart;
  sheet: WorkbookSheet;
  onDelete: () => void;
}) {
  const model = chartModelFor(sheet, chart);
  const numbers = model.series.flatMap((item) => item.values);
  const max = Math.max(1, ...numbers);
  const colors = ["#2f80ed", "#21a179", "#f2994a", "#9b51e0", "#e05263"];
  const left = 46;
  const top = 22;
  const plotWidth = 610;
  const plotHeight = 174;
  const categoryWidth = plotWidth / Math.max(1, model.labels.length);

  return (
    <section className="rounded-xl border border-border bg-card p-3" data-testid={`spreadsheet-chart-${chart.id}`}>
      <div className="mb-2 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{chart.title}</h3>
          <p className="text-[11px] text-muted-foreground">
            {chart.type === "bar" ? "Column chart" : "Line chart"} · {model.labels.length} categories
          </p>
        </div>
        <button type="button" onClick={onDelete} aria-label={`Delete ${chart.title}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
          <Trash2 size={14} />
        </button>
      </div>
      {model.labels.length === 0 || model.series.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-lg bg-muted/30 text-xs text-muted-foreground">
          This chart range no longer contains a header row and numeric series.
        </div>
      ) : (
        <svg className="h-52 w-full overflow-visible" viewBox="0 0 700 240" role="img" aria-label={chart.title}>
          <line x1={left} y1={top + plotHeight} x2={left + plotWidth} y2={top + plotHeight} stroke="currentColor" opacity=".22" />
          <line x1={left} y1={top} x2={left} y2={top + plotHeight} stroke="currentColor" opacity=".22" />
          {chart.type === "bar"
            ? model.labels.flatMap((label, categoryIndex) => model.series.map((item, seriesIndex) => {
                const value = Math.max(0, item.values[categoryIndex] ?? 0);
                const groupWidth = categoryWidth * 0.76;
                const barWidth = groupWidth / model.series.length;
                const height = (value / max) * plotHeight;
                const x = left + categoryIndex * categoryWidth + (categoryWidth - groupWidth) / 2 + seriesIndex * barWidth;
                return <rect key={`${categoryIndex}-${seriesIndex}`} x={x} y={top + plotHeight - height} width={Math.max(1, barWidth - 2)} height={height} rx="2" fill={colors[seriesIndex % colors.length]}><title>{`${label} · ${item.name}: ${value}`}</title></rect>;
              }))
            : model.series.map((item, seriesIndex) => {
                const points = item.values.map((value, index) => {
                  const x = left + categoryWidth * (index + 0.5);
                  const y = top + plotHeight - (Math.max(0, value) / max) * plotHeight;
                  return `${x},${y}`;
                }).join(" ");
                return <polyline key={item.name} points={points} fill="none" stroke={colors[seriesIndex % colors.length]} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />;
              })}
          {model.labels.map((label, index) => (
            <text key={index} x={left + categoryWidth * (index + 0.5)} y={top + plotHeight + 18} textAnchor="middle" fontSize="10" fill="currentColor">
              {label.length > 10 ? `${label.slice(0, 9)}…` : label}
            </text>
          ))}
          {model.series.map((item, index) => (
            <g key={item.name} transform={`translate(${left + index * 130}, 220)`}>
              <rect width="9" height="9" rx="2" fill={colors[index % colors.length]} />
              <text x="14" y="9" fontSize="10" fill="currentColor">{item.name.slice(0, 18)}</text>
            </g>
          ))}
        </svg>
      )}
    </section>
  );
}

function SaveStatus({ state, savedAt, error }: { state: SaveState; savedAt: string; error: string }) {
  if (state === "saving") {
    return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="status-spreadsheet-saving"><LoaderCircle size={13} className="animate-spin text-accent" />Saving changes</span>;
  }
  if (state === "conflict") {
    return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive" data-testid="status-spreadsheet-conflict"><TriangleAlert size={13} />Save conflict</span>;
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
  const [fileError, setFileError] = useState("");
  const [fileBusy, setFileBusy] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [workbookKey, setWorkbookKey] = useState(0);
  const [showAutomation, setShowAutomation] = useState(false);
  const [macroName, setMacroName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordedCount, setRecordedCount] = useState(0);
  const [macroMessage, setMacroMessage] = useState("");
  const [chartTitle, setChartTitle] = useState("");
  const [chartType, setChartType] = useState<"bar" | "line">("bar");
  const [chartRange, setChartRange] = useState<ChartRange | null>(null);
  const [chartMessage, setChartMessage] = useState("");
  const [chartDialogOpen, setChartDialogOpen] = useState(false);
  const initializedForId = useRef<string | null>(null);
  const lastSaved = useRef<{ title: string; data: SpreadsheetData } | null>(null);
  const lastServerUpdatedAt = useRef("");
  const lastServerRevision = useRef("");
  const conflictRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ title: string; data: SpreadsheetData } | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveRequestId = useRef(0);
  const titleRef = useRef(title);
  const dataRef = useRef(data);
  const workbookRef = useRef<WorkbookInstance | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const lastWorkbookRef = useRef<WorkbookSheet[]>([]);
  const recordingRef = useRef(false);
  const macroPlaybackRef = useRef(false);
  const macroOperationsRef = useRef<SafeMacroOperation[]>([]);
  const workbookChangeHandlerRef = useRef<(sheets: unknown[]) => void>(() => {});
  const stableWorkbookChangeHandler = useCallback(
    (sheets: unknown[]) => workbookChangeHandlerRef.current(sheets),
    [],
  );
  titleRef.current = title;
  dataRef.current = data;

  const spreadsheet = query.data as Spreadsheet | undefined;
  useEffect(() => {
    if (!spreadsheet) return;
    let nextData: SpreadsheetData;
    try {
      nextData = normalizeData(spreadsheet.data);
    } catch (error) {
      setData(null);
      setSaveError(error instanceof Error ? error.message : "The saved workbook format is not supported.");
      return;
    }
    if (initializedForId.current !== spreadsheetId) {
      initializedForId.current = spreadsheetId;
      conflictRef.current = false;
      lastServerUpdatedAt.current = spreadsheet.updatedAt;
      lastServerRevision.current = spreadsheet.revision;
      lastWorkbookRef.current = (nextData.workbook ?? []) as WorkbookSheet[];
      setTitle(spreadsheet.title);
      setData(nextData);
      setWorkbookKey((key) => key + 1);
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
    lastServerRevision.current = spreadsheet.revision;
    lastWorkbookRef.current = (nextData.workbook ?? []) as WorkbookSheet[];
    setTitle(spreadsheet.title);
    setData(nextData);
    setWorkbookKey((key) => key + 1);
    setSaveError("");
    setSavedAt(formatSavedAt(spreadsheet.updatedAt));
    lastSaved.current = { title: spreadsheet.title, data: copyData(nextData) };
  }, [spreadsheet, spreadsheetId, saveState, updateSpreadsheet.isPending]);

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const commit = async (nextTitle: string, nextData: SpreadsheetData) => {
    if (!initializedForId.current || conflictRef.current) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    pendingRef.current = null;
    const payload = { title: nextTitle.trim(), data: copyData(nextData) };
    if (!payload.title) return;
    if (new TextEncoder().encode(JSON.stringify(payload.data)).length > MAX_SPREADSHEET_BYTES) {
      setSaveState("error");
      setSaveError("This workbook exceeds the 8 MB save limit.");
      return;
    }
    setSaveState("saving");
    setSaveError("");
    const requestId = ++saveRequestId.current;
    const request = saveQueue.current.then(async () => {
      if (conflictRef.current) return;
      const previous = lastSaved.current;
      if (previous && previous.title === payload.title && JSON.stringify(previous.data) === JSON.stringify(payload.data)) {
        if (requestId === saveRequestId.current && !pendingRef.current && !saveTimer.current) {
          setSaveError("");
          setSaveState("saved");
        }
        return;
      }
      try {
        const saved = await updateSpreadsheet.mutateAsync({
          spreadsheetId,
          data: { ...payload, expectedRevision: lastServerRevision.current },
        });
        const savedData = normalizeData(saved.data);
        lastSaved.current = { title: saved.title, data: copyData(savedData) };
        lastServerUpdatedAt.current = saved.updatedAt;
        lastServerRevision.current = saved.revision;
        queryClient.setQueryData(getGetSpreadsheetQueryKey(spreadsheetId), { ...saved, data: savedData });
        setSavedAt(formatSavedAt(saved.updatedAt));
        if (requestId === saveRequestId.current && !pendingRef.current && !saveTimer.current) {
          setSaveState("saved");
        }
      } catch (error) {
        if ((error as { status?: unknown })?.status === 409) {
          conflictRef.current = true;
          if (saveTimer.current) {
            clearTimeout(saveTimer.current);
            saveTimer.current = null;
          }
          pendingRef.current = null;
          setSaveState("conflict");
          setSaveError("Someone else saved a newer version. Your local changes are still here; download a copy before loading the latest version.");
          return;
        }
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
    if (conflictRef.current) return;
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

  const loadLatestVersion = async () => {
    try {
      const latest = await query.refetch();
      if (latest.isError || !latest.data) {
        throw latest.error instanceof Error
          ? latest.error
          : new Error("The latest workbook could not be loaded.");
      }
      const latestData = normalizeData(latest.data.data);
      conflictRef.current = false;
      lastServerUpdatedAt.current = latest.data.updatedAt;
      lastServerRevision.current = latest.data.revision;
      lastWorkbookRef.current = (latestData.workbook ?? []) as WorkbookSheet[];
      lastSaved.current = { title: latest.data.title, data: copyData(latestData) };
      titleRef.current = latest.data.title;
      dataRef.current = latestData;
      setTitle(latest.data.title);
      setData(latestData);
      setWorkbookKey((key) => key + 1);
      setSaveState("saved");
      setSaveError("");
      setSavedAt(formatSavedAt(latest.data.updatedAt));
      setFileError("");
      queryClient.setQueryData(getGetSpreadsheetQueryKey(spreadsheetId), {
        ...latest.data,
        data: latestData,
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The latest workbook could not be loaded.");
    }
  };

  const handleWorkbookChange = (sheets: unknown[]) => {
    const current = dataRef.current;
    if (!current) return;
    let workbook: WorkbookSheet[];
    try {
      workbook = normalizeSheets(sheets, (current.workbook ?? []) as WorkbookSheet[]);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Worksheet changes could not be read.");
      return;
    }
    if (JSON.stringify(workbook) === JSON.stringify(current.workbook ?? [])) {
      lastWorkbookRef.current = workbook;
      return;
    }
    if (recordingRef.current && !macroPlaybackRef.current) {
      const operations = macroDiff(lastWorkbookRef.current, workbook);
      if (operations.length) {
        const nextOperations = [...macroOperationsRef.current, ...operations];
        if (nextOperations.length > MAX_MACRO_OPERATIONS) {
          macroOperationsRef.current = nextOperations.slice(0, MAX_MACRO_OPERATIONS);
          recordingRef.current = false;
          setRecording(false);
          setMacroMessage("Recording stopped at 200 cell changes. Save this macro or start another.");
        } else {
          macroOperationsRef.current = nextOperations;
        }
        setRecordedCount(macroOperationsRef.current.length);
      }
    }
    lastWorkbookRef.current = workbook;
    const nextData = { ...current, kind: "spreadsheet", version: 2, workbook } as SpreadsheetData;
    setData(nextData);
    scheduleSave(titleRef.current, nextData);
  };
  workbookChangeHandlerRef.current = handleWorkbookChange;

  const onTitleChange = (value: string) => {
    const nextTitle = value.slice(0, 120);
    setTitle(nextTitle);
    if (dataRef.current && nextTitle.trim()) scheduleSave(nextTitle, dataRef.current);
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

  const exportWorkbook = async (format: "xlsx" | "csv") => {
    if (!workbookRef.current) return;
    setFileBusy(true);
    setFileError("");
    try {
      const blob = await transformFortuneToExcel(
        workbookRef.current,
        format as Parameters<typeof transformFortuneToExcel>[1],
        false,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const safeName = (titleRef.current.trim() || "tryout-worksheet")
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase();
      link.href = url;
      link.download = `${safeName || "tryout-worksheet"}.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFileError(`Could not export ${format.toUpperCase()}. Try again.`);
    } finally {
      setFileBusy(false);
    }
  };

  const importWorkbook = async (file?: File) => {
    if (!file) return;
    setFileError("");
    if (file.size > MAX_SPREADSHEET_BYTES) {
      setFileError("Files must be 8 MB or smaller.");
      return;
    }
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setFileError("Choose an XLSX or CSV file.");
      return;
    }
    setFileBusy(true);
    try {
      let importedSheets: unknown = null;
      await transformExcelToFortune(
        file,
        (sheets: unknown) => { importedSheets = sheets; },
        setWorkbookKey,
        workbookRef,
      );
      const workbook = normalizeSheets(importedSheets);
      const current = dataRef.current;
      const nextData = {
        ...(current ?? { kind: "spreadsheet", version: 2 }),
        kind: "spreadsheet",
        version: 2,
        workbook,
        macros: [],
      } as SpreadsheetData;
      if (new TextEncoder().encode(JSON.stringify(nextData)).length > MAX_SPREADSHEET_BYTES) {
        throw new Error("The imported workbook expands beyond the 8 MB save limit.");
      }
      lastWorkbookRef.current = workbook;
      setData(nextData);
      setWorkbookKey((key) => key + 1);
      scheduleSave(titleRef.current, nextData);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not import this workbook.");
    } finally {
      setFileBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startRecording = () => {
    if (!dataRef.current) return;
    macroOperationsRef.current = [];
    lastWorkbookRef.current = copyData(dataRef.current).workbook as WorkbookSheet[];
    recordingRef.current = true;
    setRecording(true);
    setRecordedCount(0);
    setMacroMessage("Recording cell values and formulas. Workbook macros and uploaded VBA are never executed.");
  };

  const stopAndSaveMacro = () => {
    recordingRef.current = false;
    setRecording(false);
    const name = macroName.trim();
    const operations = macroOperationsRef.current;
    const current = dataRef.current;
    if (!current) return;
    if (!name || name.length > 80) {
      setMacroMessage("Enter a macro name between 1 and 80 characters.");
      return;
    }
    if (!operations.length) {
      setMacroMessage("No cell changes were recorded.");
      return;
    }
    const macros = (current.macros ?? []) as SafeMacro[];
    if (macros.length >= MAX_MACROS) {
      setMacroMessage("This workbook already has the maximum of 25 macros.");
      return;
    }
    const macro: SafeMacro = {
      id: `macro-${crypto.randomUUID()}`,
      name,
      operations: operations.slice(0, MAX_MACRO_OPERATIONS),
    };
    const nextData = { ...current, macros: [...macros, macro] } as SpreadsheetData;
    setData(nextData);
    scheduleSave(titleRef.current, nextData);
    setMacroName("");
    macroOperationsRef.current = [];
    setRecordedCount(0);
    setMacroMessage(`Saved “${name}” with ${macro.operations.length} cell changes.`);
  };

  const playMacro = (macro: SafeMacro) => {
    const instance = workbookRef.current;
    const workbook = (dataRef.current?.workbook ?? []) as WorkbookSheet[];
    if (!instance) return;
    if (!Array.isArray(macro.operations) || macro.operations.length > MAX_MACRO_OPERATIONS ||
      !macro.operations.every(isSafeMacroOperation)) {
      setMacroMessage("This macro contains unsupported operations and was not run.");
      return;
    }
    if (macro.operations.some((operation) => !workbook.some((sheet) => sheet.id === operation.sheetId))) {
      setMacroMessage("This macro refers to a worksheet that no longer exists.");
      return;
    }
    macroPlaybackRef.current = true;
    try {
      for (const operation of macro.operations) {
        const options = { id: operation.sheetId };
        if (operation.value === null && !operation.formula) {
          instance.clearCell(operation.row, operation.column, options);
        } else {
          instance.setCellValue(
            operation.row,
            operation.column,
            operation.value,
            { ...options, type: operation.formula ? "f" : "v" },
          );
        }
      }
      setMacroMessage(`Ran “${macro.name}” (${macro.operations.length} cell changes).`);
    } catch {
      setMacroMessage(`Could not run “${macro.name}”.`);
    } finally {
      window.setTimeout(() => { macroPlaybackRef.current = false; }, 300);
    }
  };

  const deleteMacro = (macroId: string) => {
    const current = dataRef.current;
    if (!current) return;
    const macros = ((current.macros ?? []) as SafeMacro[]).filter((macro) => macro.id !== macroId);
    const nextData = { ...current, macros } as SpreadsheetData;
    setData(nextData);
    scheduleSave(titleRef.current, nextData);
  };

  const openChartDialog = () => {
    const selection = workbookRef.current?.getSelection()?.[0];
    if (!selection?.row?.length || !selection?.column?.length) {
      setChartMessage("Select a range with a header row, category column, and numeric data first.");
      return;
    }
    const range = {
      startRow: Math.min(...selection.row),
      endRow: Math.max(...selection.row),
      startColumn: Math.min(...selection.column),
      endColumn: Math.max(...selection.column),
    };
    if (range.endRow <= range.startRow || range.endColumn <= range.startColumn) {
      setChartMessage("Select at least two rows and two columns to create a chart.");
      return;
    }
    setChartRange(range);
    setChartTitle("");
    setChartMessage("");
    setChartDialogOpen(true);
  };

  const saveChart = () => {
    const current = dataRef.current;
    const sheet = activeSheet((current?.workbook ?? []) as WorkbookSheet[]);
    if (!current || !sheet || !chartRange) return;
    const titleText = chartTitle.trim();
    if (!titleText || titleText.length > 120) {
      setChartMessage("Enter a chart title between 1 and 120 characters.");
      return;
    }
    const workbook = copyData(current).workbook as WorkbookSheet[];
    const target = workbook.find((item) => item.id === sheet.id);
    if (!target) return;
    const charts = Array.isArray(target.charts) ? target.charts as SavedChart[] : [];
    if (charts.length >= MAX_CHARTS) {
      setChartMessage("This worksheet already has the maximum of 20 saved charts.");
      return;
    }
    const chart: SavedChart = {
      id: `chart-${crypto.randomUUID()}`,
      title: titleText,
      type: chartType,
      ...chartRange,
    };
    target.charts = [...charts, chart];
    const nextData = { ...current, workbook } as SpreadsheetData;
    setData(nextData);
    scheduleSave(titleRef.current, nextData);
    setChartDialogOpen(false);
    setChartMessage("");
  };

  const deleteChart = (chartId: string) => {
    const current = dataRef.current;
    if (!current) return;
    const workbook = copyData(current).workbook as WorkbookSheet[];
    const sheet = activeSheet(workbook);
    if (!sheet) return;
    sheet.charts = (Array.isArray(sheet.charts) ? sheet.charts as SavedChart[] : [])
      .filter((chart) => chart.id !== chartId);
    const nextData = { ...current, workbook } as SpreadsheetData;
    setData(nextData);
    scheduleSave(titleRef.current, nextData);
  };

  const workbook = useMemo(
    () => (data?.workbook ?? []) as WorkbookSheet[],
    [data],
  );
  const currentSheet = activeSheet(workbook);
  const charts = (Array.isArray(currentSheet?.charts) ? currentSheet.charts : []) as SavedChart[];
  const macros = (Array.isArray(data?.macros) ? data.macros : []) as SafeMacro[];
  const gridRows = Math.max(currentSheet?.row ?? 0, 0);
  const gridColumns = Math.max(currentSheet?.column ?? 0, 0);

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
          <p className="mt-2 text-sm text-muted-foreground">{saveError || "This workbook could not be loaded in the current workspace."}</p>
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
      <div className="mx-auto flex max-w-[1700px] flex-col px-3 py-4 sm:px-5 sm:py-5">
        <header className="flex flex-wrap items-start gap-3 border-b border-border pb-4">
          <button type="button" onClick={leaveSpreadsheet} aria-label="Back to chat" data-testid="button-back-to-chat" className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"><ArrowLeft size={16} /></button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-primary"><FileSpreadsheet size={17} /><span className="mono text-[10px] font-bold uppercase tracking-[.18em]">Shared workbook</span></div>
            <input value={title} onChange={event => onTitleChange(event.target.value)} onBlur={restoreTitleIfEmpty} aria-label="Spreadsheet title" data-testid="input-spreadsheet-title" className="mt-1 w-full max-w-2xl bg-transparent text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-foreground sm:text-3xl" placeholder="Name this workbook" maxLength={120} />
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">Authorized interviewers share this workbook. Saved changes from others appear within about 5 seconds. Saves based on an older version are blocked to protect everyone’s work.</p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <SaveStatus state={saveState} savedAt={savedAt} error={saveError} />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(event) => void importWorkbook(event.target.files?.[0])}
              aria-label="Choose XLSX or CSV file"
            />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={fileBusy} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"><Upload size={14} />Import</button>
            <button type="button" onClick={() => void exportWorkbook("xlsx")} disabled={fileBusy} data-testid="button-export-spreadsheet" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"><Download size={14} />{fileBusy ? "Working…" : "XLSX"}</button>
            <button type="button" onClick={() => void exportWorkbook("csv")} disabled={fileBusy} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"><Download size={14} />CSV</button>
          </div>
        </header>

        {saveState === "conflict" && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert" data-testid="spreadsheet-save-conflict">
            <TriangleAlert size={14} />
            <span className="min-w-[240px] flex-1">{saveError || "Someone else saved a newer version. Your local changes are still here."}</span>
            <button type="button" onClick={() => void exportWorkbook("xlsx")} disabled={fileBusy} data-testid="button-download-local-spreadsheet" className="rounded-md border border-destructive/30 px-2 py-1 font-semibold disabled:opacity-50">
              {fileBusy ? "Preparing copy…" : "Download local XLSX"}
            </button>
            <button type="button" onClick={() => void loadLatestVersion()} disabled={query.isFetching} data-testid="button-load-latest-spreadsheet" className="rounded-md border border-destructive/30 px-2 py-1 font-semibold disabled:opacity-50">
              {query.isFetching ? "Loading…" : "Load latest version"}
            </button>
          </div>
        )}

        {(fileError || saveState === "error") && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2.5 text-xs text-destructive" role="alert" data-testid="spreadsheet-save-error">
            <TriangleAlert size={14} /><span>{fileError || saveError || "Your latest changes were not saved."}</span>
            {saveState === "error" && <button type="button" onClick={() => { const titleToSave = titleRef.current.trim() || lastSaved.current?.title || "Untitled spreadsheet"; if (dataRef.current) void commit(titleToSave, dataRef.current); }} data-testid="button-retry-spreadsheet-save" className="ml-auto rounded-md border border-destructive/30 px-2 py-1 font-semibold">Retry save</button>}
            <button type="button" onClick={() => setFileError("")} aria-label="Dismiss message" className="ml-auto rounded p-1 hover:bg-destructive/10"><X size={13} /></button>
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="mono rounded-md bg-muted/70 px-2 py-1">{gridRows.toLocaleString()} rows</span>
            <span className="mono rounded-md bg-muted/70 px-2 py-1">{gridColumns.toLocaleString()} columns</span>
            <span className="mono rounded-md bg-muted/70 px-2 py-1">{workbook.length} {workbook.length === 1 ? "sheet" : "sheets"}</span>
            <span className="hidden lg:inline">Right-click row or column headers for insert, delete, sort, and filter actions.</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={openChartDialog} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary"><BarChart3 size={14} />Chart selection</button>
            <button type="button" onClick={() => { setShowAutomation((show) => !show); setMacroMessage(""); }} aria-expanded={showAutomation} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-semibold hover:border-primary hover:text-primary">Automation ({macros.length})</button>
          </div>
        </div>

        {fileBusy && <p className="mt-2 text-xs text-muted-foreground" role="status"><LoaderCircle size={13} className="mr-1 inline animate-spin" />Processing workbook…</p>}
        {chartMessage && !chartDialogOpen && <p className="mt-2 text-xs text-muted-foreground" role="status">{chartMessage}</p>}

        {showAutomation && (
          <section className="mt-3 rounded-xl border border-border bg-card p-3 sm:p-4" aria-label="Workbook automation">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-[220px] flex-1">
                <h2 className="text-sm font-semibold">Recorded automation</h2>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Record cell value and formula edits, then replay them on this workbook. Uploaded VBA and arbitrary code are never run.</p>
              </div>
              {!recording ? (
                <button type="button" onClick={startRecording} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Square size={13} fill="currentColor" />Start recording</button>
              ) : (
                <button type="button" onClick={stopAndSaveMacro} className="inline-flex items-center gap-2 rounded-lg bg-destructive px-3 py-2 text-xs font-semibold text-destructive-foreground"><Square size={13} fill="currentColor" />Stop and save ({recordedCount})</button>
              )}
            </div>
            {(!recording || recordedCount > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input value={macroName} onChange={(event) => setMacroName(event.target.value.slice(0, 80))} aria-label="Macro name" placeholder="Name this macro" maxLength={80} className="h-9 w-full max-w-xs rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none focus:border-primary" />
                {!recording && <span className="text-[11px] text-muted-foreground">Enter a name, start recording, make edits, then stop.</span>}
              </div>
            )}
            {macroMessage && <p className="mt-2 text-xs text-muted-foreground" role="status">{macroMessage}</p>}
            {macros.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {macros.map((macro) => (
                  <div key={macro.id} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold">{macro.name}</p>
                      <p className="text-[10px] text-muted-foreground">{macro.operations.length} cell changes</p>
                    </div>
                    <button type="button" onClick={() => playMacro(macro)} aria-label={`Run ${macro.name}`} className="rounded-md p-1.5 text-primary hover:bg-primary/10"><Play size={14} /></button>
                    <button type="button" onClick={() => deleteMacro(macro.id)} aria-label={`Delete ${macro.name}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mt-3 overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-label="Spreadsheet">
          <div className="spreadsheet-workbook h-[calc(100dvh-335px)] min-h-[560px] w-full" data-testid="spreadsheet-grid">
            <Workbook
              key={workbookKey}
              ref={workbookRef}
              data={workbook as never}
              onChange={stableWorkbookChangeHandler}
              allowEdit
              showToolbar
              showFormulaBar
              showSheetTabs
              forceCalculation
            />
          </div>
        </section>

        {charts.length > 0 && currentSheet && (
          <section className="mt-4" aria-label="Saved charts">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Charts · {currentSheet.name}</h2>
              <span className="text-[11px] text-muted-foreground">Charts are shared with this workbook.</span>
            </div>
            <div className="grid gap-3 xl:grid-cols-2">
              {charts.map((chart) => <ChartCard key={chart.id} chart={chart} sheet={currentSheet} onDelete={() => deleteChart(chart.id)} />)}
            </div>
          </section>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-2 px-1 pt-3 text-[11px] text-muted-foreground">
          <span>Formula and formatting tools are in the sheet toolbar. CSV export includes the active worksheet; XLSX includes all worksheets. Import is limited to 8 MB.</span>
          <span className="mono">Workbook v2 · {spreadsheetId.slice(0, 8)}</span>
        </footer>
      </div>

      {chartDialogOpen && chartRange && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setChartDialogOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="chart-dialog-title" className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><BarChart3 size={17} /></div>
              <div className="min-w-0 flex-1">
                <h2 id="chart-dialog-title" className="text-base font-semibold">Create a chart</h2>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">The first row supplies series names, the first selected column supplies category labels, and later columns contain numbers.</p>
              </div>
              <button type="button" onClick={() => setChartDialogOpen(false)} aria-label="Close chart dialog" className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X size={16} /></button>
            </div>
            <label className="mt-4 block text-xs font-medium">
              Chart title
              <input value={chartTitle} onChange={(event) => setChartTitle(event.target.value.slice(0, 120))} autoFocus maxLength={120} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary" placeholder="Tryout scores by event" />
            </label>
            <label className="mt-3 block text-xs font-medium">
              Type
              <select value={chartType} onChange={(event) => setChartType(event.target.value as "bar" | "line")} className="mt-1.5 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                <option value="bar">Column chart</option>
                <option value="line">Line chart</option>
              </select>
            </label>
            <p className="mt-3 rounded-lg bg-muted/50 p-2.5 text-[11px] text-muted-foreground">
              Range: rows {chartRange.startRow + 1}–{chartRange.endRow + 1}, columns {chartRange.startColumn + 1}–{chartRange.endColumn + 1}
            </p>
            {chartMessage && <p className="mt-2 text-xs text-destructive" role="alert">{chartMessage}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setChartDialogOpen(false)} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">Cancel</button>
              <button type="button" onClick={saveChart} className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground">Save chart</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}