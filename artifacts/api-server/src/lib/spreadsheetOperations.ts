import type { SpreadsheetData, SpreadsheetDataWorkbookItem } from "@workspace/api-zod";

const LEGACY_MAX_COLUMNS = 40;
const LEGACY_MAX_ROWS = 1000;
const LEGACY_MAX_CELL_LENGTH = 4000;
const MAX_COLUMNS = 16_384;
const MAX_ROWS = 1_048_576;
const MAX_CELL_LENGTH = 32_767;
export const MAX_SPREADSHEET_DATA_BYTES = 8_000_000;
const MAX_SHEETS = 255;
const MAX_SPARSE_CELLS = 100_000;
const MAX_MACROS = 25;
const MAX_MACRO_OPERATIONS = 200;

type PlainRecord = Record<string, unknown>;
type StoredCell = { r: number; c: number; v: PlainRecord | null };
type StoredSheet = SpreadsheetDataWorkbookItem & {
  row?: number;
  column?: number;
  status?: number;
  hide?: number;
  data?: unknown;
  celldata?: unknown;
  charts?: unknown;
};

export type SpreadsheetAssistantEdits = {
  title?: string;
  sheetName?: string;
  cells?: { row: number; column: number; value: string }[];
  appendRows?: string[][];
  appendColumns?: { values: string[] }[];
};

type SpreadsheetAssistantEditResult =
  | { ok: true; data: SpreadsheetData; title?: string }
  | { ok: false; error: string };

function isRecord(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isLegacySpreadsheetData(data: PlainRecord): boolean {
  return (
    data.version === 1 &&
    Number.isInteger(data.columnCount) &&
    (data.columnCount as number) >= 1 &&
    (data.columnCount as number) <= LEGACY_MAX_COLUMNS &&
    Array.isArray(data.rows) &&
    data.rows.length >= 1 &&
    data.rows.length <= LEGACY_MAX_ROWS &&
    data.rows.every((row) =>
      Array.isArray(row) &&
      row.length === data.columnCount &&
      row.every((cell) => typeof cell === "string" && cell.length <= LEGACY_MAX_CELL_LENGTH),
    )
  );
}

function isStoredCell(value: unknown): value is StoredCell {
  return isRecord(value) &&
    Number.isInteger(value.r) &&
    (value.r as number) >= 0 &&
    (value.r as number) < MAX_ROWS &&
    Number.isInteger(value.c) &&
    (value.c as number) >= 0 &&
    (value.c as number) < MAX_COLUMNS &&
    (value.v === null || isRecord(value.v));
}

function isStoredChart(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 120 &&
    typeof value.title === "string" &&
    value.title.trim().length > 0 &&
    value.title.length <= 120 &&
    (value.type === "bar" || value.type === "line") &&
    Number.isInteger(value.startRow) &&
    Number.isInteger(value.endRow) &&
    Number.isInteger(value.startColumn) &&
    Number.isInteger(value.endColumn) &&
    (value.startRow as number) >= 0 &&
    (value.startRow as number) <= (value.endRow as number) &&
    (value.endRow as number) < MAX_ROWS &&
    (value.startColumn as number) >= 0 &&
    (value.startColumn as number) <= (value.endColumn as number) &&
    (value.endColumn as number) < MAX_COLUMNS;
}

function isStoredSheet(value: unknown): value is StoredSheet {
  if (!isRecord(value)) return false;
  if (
    typeof value.id !== "string" ||
    !value.id.trim() ||
    value.id.length > 120 ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 31 ||
    (value.row !== undefined &&
      (!Number.isInteger(value.row) || (value.row as number) < 1 || (value.row as number) > MAX_ROWS)) ||
    (value.column !== undefined &&
      (!Number.isInteger(value.column) || (value.column as number) < 1 || (value.column as number) > MAX_COLUMNS))
  ) {
    return false;
  }
  if (value.celldata !== undefined) {
    if (
      !Array.isArray(value.celldata) ||
      value.celldata.length > MAX_SPARSE_CELLS ||
      !value.celldata.every(isStoredCell)
    ) {
      return false;
    }
  }
  if (value.data !== undefined) {
    if (
      !Array.isArray(value.data) ||
      value.data.length > MAX_ROWS ||
      value.data.some((row) =>
        !Array.isArray(row) ||
        row.length > MAX_COLUMNS ||
        row.some((cell) => cell !== null && !isRecord(cell)),
      )
    ) {
      return false;
    }
  }
  if (value.charts !== undefined) {
    if (!Array.isArray(value.charts) || value.charts.length > 20 || !value.charts.every(isStoredChart)) {
      return false;
    }
  }
  return true;
}

function isValidMacro(value: unknown): boolean {
  return isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 120 &&
    typeof value.name === "string" &&
    value.name.trim().length > 0 &&
    value.name.length <= 80 &&
    Array.isArray(value.operations) &&
    value.operations.length > 0 &&
    value.operations.length <= MAX_MACRO_OPERATIONS &&
    value.operations.every((operation) =>
      isRecord(operation) &&
      operation.op === "setCell" &&
      typeof operation.sheetId === "string" &&
      operation.sheetId.length > 0 &&
      operation.sheetId.length <= 120 &&
      Number.isInteger(operation.row) &&
      (operation.row as number) >= 0 &&
      (operation.row as number) < MAX_ROWS &&
      Number.isInteger(operation.column) &&
      (operation.column as number) >= 0 &&
      (operation.column as number) < MAX_COLUMNS &&
      (typeof operation.value === "string" ||
        typeof operation.value === "number" ||
        typeof operation.value === "boolean" ||
        operation.value === null) &&
      (typeof operation.value !== "string" || operation.value.length <= MAX_CELL_LENGTH) &&
      (operation.formula === undefined || typeof operation.formula === "boolean"),
    );
}

function isRichSpreadsheetData(data: PlainRecord): boolean {
  if (
    data.version !== 2 ||
    !Array.isArray(data.workbook) ||
    data.workbook.length < 1 ||
    data.workbook.length > MAX_SHEETS ||
    !data.workbook.every(isStoredSheet)
  ) {
    return false;
  }
  const sheets = data.workbook as StoredSheet[];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const sheet of sheets) {
    const normalizedName = sheet.name.trim().toLocaleLowerCase();
    if (ids.has(sheet.id) || names.has(normalizedName)) return false;
    ids.add(sheet.id);
    names.add(normalizedName);
  }
  return data.macros === undefined ||
    (Array.isArray(data.macros) &&
      data.macros.length <= MAX_MACROS &&
      data.macros.every(isValidMacro));
}

export function isSpreadsheetRecordData(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as { kind?: unknown };
    return parsed?.kind === "spreadsheet";
  } catch {
    return false;
  }
}

export function parseSpreadsheetData(raw: unknown): SpreadsheetData | null {
  let value = raw;
  if (typeof raw === "string") {
    if (Buffer.byteLength(raw, "utf8") > MAX_SPREADSHEET_DATA_BYTES) return null;
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!isRecord(value) || value.kind !== "spreadsheet") return null;
  try {
    if (Buffer.byteLength(JSON.stringify(value), "utf8") > MAX_SPREADSHEET_DATA_BYTES) return null;
  } catch {
    return null;
  }
  if (isLegacySpreadsheetData(value) || isRichSpreadsheetData(value)) {
    return value as unknown as SpreadsheetData;
  }
  return null;
}

export function initialSpreadsheetData(): SpreadsheetData {
  return {
    kind: "spreadsheet",
    version: 2,
    workbook: [{
      id: "sheet-1",
      name: "Sheet1",
      order: 0,
      status: 1,
      row: 1000,
      column: 26,
      defaultRowHeight: 24,
      defaultColWidth: 100,
      celldata: [],
      config: {},
    }],
    macros: [],
  };
}

function stringCell(value: unknown): string {
  if (!isRecord(value)) return "";
  if (typeof value.f === "string" && value.f) return value.f;
  if (value.m !== undefined && value.m !== null) return String(value.m);
  if (value.v !== undefined && value.v !== null) return String(value.v);
  return "";
}

function activeSheet(data: SpreadsheetData, requestedName?: string): StoredSheet | null {
  if (data.version !== 2 || !Array.isArray(data.workbook)) return null;
  const sheets = data.workbook as StoredSheet[];
  if (requestedName) {
    return sheets.find((sheet) => sheet.name.toLocaleLowerCase() === requestedName.toLocaleLowerCase()) ?? null;
  }
  return sheets.find((sheet) => sheet.status === 1 && sheet.hide !== 1) ??
    sheets.find((sheet) => sheet.hide !== 1) ??
    sheets[0] ??
    null;
}

function sparseCells(sheet: StoredSheet): StoredCell[] {
  if (Array.isArray(sheet.celldata)) {
    return sheet.celldata.filter(isStoredCell).map((cell) => ({
      r: cell.r,
      c: cell.c,
      v: cell.v ? { ...cell.v } : null,
    }));
  }
  const result: StoredCell[] = [];
  if (!Array.isArray(sheet.data)) return result;
  for (let r = 0; r < sheet.data.length; r += 1) {
    const row = sheet.data[r];
    if (!Array.isArray(row)) continue;
    for (let c = 0; c < row.length; c += 1) {
      const cell = row[c];
      if (isRecord(cell)) result.push({ r, c, v: { ...cell } });
    }
  }
  return result;
}

export function spreadsheetSheetNames(data: SpreadsheetData): string[] {
  if (data.version === 1) return ["Sheet1"];
  return ((data.workbook ?? []) as StoredSheet[]).map((sheet) => sheet.name);
}

export function spreadsheetGridSize(
  data: SpreadsheetData,
  requestedSheetName?: string,
): { rows: number; columns: number; sheets: number } {
  if (data.version === 1) {
    return {
      rows: data.rows?.length ?? 0,
      columns: data.columnCount ?? 0,
      sheets: 1,
    };
  }
  const sheet = activeSheet(data, requestedSheetName);
  if (!sheet) return { rows: 0, columns: 0, sheets: data.workbook?.length ?? 0 };
  const cells = sparseCells(sheet);
  const usedRows = cells.reduce((max, cell) => Math.max(max, cell.r + 1), 0);
  const usedColumns = cells.reduce((max, cell) => Math.max(max, cell.c + 1), 0);
  return {
    rows: Math.max(sheet.row ?? 0, usedRows),
    columns: Math.max(sheet.column ?? 0, usedColumns),
    sheets: data.workbook?.length ?? 0,
  };
}

export function spreadsheetPreviewRows(
  data: SpreadsheetData,
  options: { sheetName?: string; offset?: number; limit?: number; columnOffset?: number; columnLimit?: number } = {},
): { sheetName: string; rows: string[][]; rowCount: number; columnCount: number } | null {
  const offset = Math.max(0, Math.floor(options.offset ?? 0));
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 25)));
  const columnOffset = Math.max(0, Math.floor(options.columnOffset ?? 0));
  const columnLimit = Math.max(1, Math.min(40, Math.floor(options.columnLimit ?? 20)));
  if (data.version === 1) {
    const sourceRows = data.rows ?? [];
    const rows = sourceRows.slice(offset, offset + limit).map((row) =>
      row.slice(columnOffset, columnOffset + columnLimit).map((cell) => cell.slice(0, 300)),
    );
    return {
      sheetName: "Sheet1",
      rows,
      rowCount: sourceRows.length,
      columnCount: data.columnCount ?? 0,
    };
  }

  const sheet = activeSheet(data, options.sheetName);
  if (!sheet) return null;
  const cells = sparseCells(sheet);
  const usedRows = cells.reduce((max, cell) => Math.max(max, cell.r + 1), 0);
  const usedColumns = cells.reduce((max, cell) => Math.max(max, cell.c + 1), 0);
  const rowCount = Math.max(usedRows, sheet.row ?? 0);
  const columnCount = Math.max(usedColumns, sheet.column ?? 0);
  const rowEnd = Math.min(rowCount, offset + limit);
  const rows = Array.from({ length: Math.max(0, rowEnd - offset) }, () =>
    Array.from({ length: Math.max(0, Math.min(columnLimit, columnCount - columnOffset)) }, () => ""),
  );
  for (const cell of cells) {
    if (
      cell.r < offset ||
      cell.r >= rowEnd ||
      cell.c < columnOffset ||
      cell.c >= columnOffset + columnLimit ||
      !cell.v
    ) continue;
    const value = stringCell(cell.v);
    rows[cell.r - offset][cell.c - columnOffset] = value.slice(0, 300);
  }
  return { sheetName: sheet.name, rows, rowCount, columnCount };
}

function applyLegacySpreadsheetEdits(
  current: SpreadsheetData,
  edits: SpreadsheetAssistantEdits,
): SpreadsheetAssistantEditResult {
  const columnCount = current.columnCount ?? 0;
  const rows = (current.rows ?? []).map((row) => [...row]);
  for (const cell of edits.cells ?? []) {
    if (
      !Number.isInteger(cell.row) ||
      !Number.isInteger(cell.column) ||
      cell.row < 0 ||
      cell.row >= rows.length ||
      cell.column < 0 ||
      cell.column >= columnCount
    ) {
      return { ok: false, error: "Cell coordinates must refer to an existing zero-based row and column." };
    }
    if (typeof cell.value !== "string" || cell.value.length > LEGACY_MAX_CELL_LENGTH) {
      return { ok: false, error: "Legacy cell values must be text of 4,000 characters or fewer." };
    }
    rows[cell.row][cell.column] = cell.value;
  }
  for (const row of edits.appendRows ?? []) {
    if (!Array.isArray(row) || row.length > columnCount || row.some((cell) =>
      typeof cell !== "string" || cell.length > LEGACY_MAX_CELL_LENGTH,
    )) {
      return { ok: false, error: "Each appended row must contain text values that fit the current columns." };
    }
    if (rows.length >= LEGACY_MAX_ROWS) {
      return { ok: false, error: "This legacy spreadsheet has reached its 1,000-row limit." };
    }
    rows.push([...row, ...Array.from({ length: columnCount - row.length }, () => "")]);
  }
  let nextColumnCount = columnCount;
  for (const column of edits.appendColumns ?? []) {
    if (!Array.isArray(column.values) || column.values.length > rows.length || column.values.some((cell) =>
      typeof cell !== "string" || cell.length > LEGACY_MAX_CELL_LENGTH,
    )) {
      return { ok: false, error: "Each appended column must contain text values for existing rows only." };
    }
    if (nextColumnCount >= LEGACY_MAX_COLUMNS) {
      return { ok: false, error: "This legacy spreadsheet has reached the 40-column limit." };
    }
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      rows[rowIndex].push(column.values[rowIndex] ?? "");
    }
    nextColumnCount += 1;
  }
  return {
    ok: true,
    data: { kind: "spreadsheet", version: 1, columnCount: nextColumnCount, rows },
  };
}

function setSparseCell(cells: StoredCell[], row: number, column: number, value: string): void {
  const existing = cells.find((cell) => cell.r === row && cell.c === column);
  const nextValue: PlainRecord = existing?.v ? { ...existing.v } : {};
  delete nextValue.m;
  if (value.startsWith("=")) {
    nextValue.f = value;
    delete nextValue.v;
  } else {
    nextValue.v = value;
    delete nextValue.f;
  }
  if (existing) {
    existing.v = nextValue;
  } else {
    cells.push({ r: row, c: column, v: nextValue });
  }
}

function applyRichSpreadsheetEdits(
  current: SpreadsheetData,
  edits: SpreadsheetAssistantEdits,
): SpreadsheetAssistantEditResult {
  const workbook = JSON.parse(JSON.stringify(current.workbook ?? [])) as StoredSheet[];
  const sheet = activeSheet({ ...current, workbook } as SpreadsheetData, edits.sheetName);
  if (!sheet) return { ok: false, error: "The requested worksheet was not found." };
  const cells = sparseCells(sheet);

  for (const cell of edits.cells ?? []) {
    if (
      !Number.isInteger(cell.row) ||
      !Number.isInteger(cell.column) ||
      cell.row < 0 ||
      cell.row >= MAX_ROWS ||
      cell.column < 0 ||
      cell.column >= MAX_COLUMNS
    ) {
      return { ok: false, error: "Cell coordinates must stay within Excel's row and column limits." };
    }
    if (typeof cell.value !== "string" || cell.value.length > MAX_CELL_LENGTH) {
      return { ok: false, error: "Cell values must be text of 32,767 characters or fewer." };
    }
    setSparseCell(cells, cell.row, cell.column, cell.value);
  }

  let lastUsedRow = cells.reduce((max, cell) => Math.max(max, cell.r), -1);
  let lastUsedColumn = cells.reduce((max, cell) => Math.max(max, cell.c), -1);
  for (const row of edits.appendRows ?? []) {
    if (!Array.isArray(row) || row.length > MAX_COLUMNS || row.some((cell) =>
      typeof cell !== "string" || cell.length > MAX_CELL_LENGTH,
    )) {
      return { ok: false, error: "Each appended row must contain text values that fit within Excel's column limit." };
    }
    if (lastUsedRow + 1 >= MAX_ROWS) {
      return { ok: false, error: "This worksheet has reached Excel's 1,048,576-row limit." };
    }
    lastUsedRow += 1;
    row.forEach((value, column) => {
      if (value) setSparseCell(cells, lastUsedRow, column, value);
    });
    lastUsedColumn = Math.max(lastUsedColumn, row.length - 1);
  }

  for (const column of edits.appendColumns ?? []) {
    if (!Array.isArray(column.values) || column.values.length > MAX_ROWS || column.values.some((cell) =>
      typeof cell !== "string" || cell.length > MAX_CELL_LENGTH,
    )) {
      return { ok: false, error: "Each appended column must contain text values within Excel's row limit." };
    }
    if (lastUsedColumn + 1 >= MAX_COLUMNS) {
      return { ok: false, error: "This worksheet has reached Excel's 16,384-column limit." };
    }
    lastUsedColumn += 1;
    column.values.forEach((value, row) => {
      if (value) setSparseCell(cells, row, lastUsedColumn, value);
    });
    lastUsedRow = Math.max(lastUsedRow, column.values.length - 1);
  }

  if (cells.length > MAX_SPARSE_CELLS) {
    return { ok: false, error: "This worksheet contains too many populated or formatted cells for an assistant edit." };
  }
  sheet.celldata = cells;
  delete sheet.data;
  sheet.row = Math.max(sheet.row ?? 1, lastUsedRow + 1);
  sheet.column = Math.max(sheet.column ?? 1, lastUsedColumn + 1);
  const data = {
    kind: "spreadsheet",
    version: 2,
    workbook,
    macros: current.macros ?? [],
  } as SpreadsheetData;
  return { ok: true, data };
}

export function applySpreadsheetAssistantEdits(
  current: SpreadsheetData,
  edits: SpreadsheetAssistantEdits,
): SpreadsheetAssistantEditResult {
  const hasChanges =
    (edits.title !== undefined && edits.title.trim().length > 0) ||
    Boolean(edits.cells?.length) ||
    Boolean(edits.appendRows?.length) ||
    Boolean(edits.appendColumns?.length);
  if (!hasChanges) return { ok: false, error: "Provide a title change, cell update, or rows/columns to append." };

  const title = edits.title?.trim();
  if (edits.title !== undefined && (!title || title.length > 120)) {
    return { ok: false, error: "Spreadsheet titles must contain 1 to 120 characters." };
  }
  if ((edits.cells?.length ?? 0) > 50) {
    return { ok: false, error: "Update no more than 50 cells in one assistant edit." };
  }
  if ((edits.appendRows?.length ?? 0) > 50) {
    return { ok: false, error: "Append no more than 50 rows in one assistant edit." };
  }
  if ((edits.appendColumns?.length ?? 0) > 20) {
    return { ok: false, error: "Append no more than 20 columns in one assistant edit." };
  }

  const applied = current.version === 1
    ? applyLegacySpreadsheetEdits(current, edits)
    : applyRichSpreadsheetEdits(current, edits);
  if (!applied.ok) return applied;
  return {
    ...applied,
    ...(title ? { title } : {}),
  };
}