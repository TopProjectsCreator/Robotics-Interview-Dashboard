import type { SpreadsheetData } from "@workspace/api-zod";

const MAX_COLUMNS = 40;
const MAX_ROWS = 1000;
const MAX_CELL_LENGTH = 4000;

export type SpreadsheetAssistantEdits = {
  title?: string;
  cells?: { row: number; column: number; value: string }[];
  appendRows?: string[][];
  appendColumns?: { values: string[] }[];
};

type SpreadsheetAssistantEditResult =
  | { ok: true; data: SpreadsheetData; title?: string }
  | { ok: false; error: string };

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
    try {
      value = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const data = value as Partial<SpreadsheetData>;
  if (
    data.kind !== "spreadsheet" ||
    data.version !== 1 ||
    !Number.isInteger(data.columnCount) ||
    (data.columnCount ?? 0) < 1 ||
    (data.columnCount ?? 0) > MAX_COLUMNS ||
    !Array.isArray(data.rows) ||
    data.rows.length < 1 ||
    data.rows.length > MAX_ROWS ||
    data.rows.some((row) =>
      !Array.isArray(row) ||
      row.length !== data.columnCount ||
      row.some((cell) => typeof cell !== "string" || cell.length > MAX_CELL_LENGTH),
    )
  ) {
    return null;
  }
  return data as SpreadsheetData;
}

export function initialSpreadsheetData(): SpreadsheetData {
  const columnCount = 8;
  return {
    kind: "spreadsheet",
    version: 1,
    columnCount,
    rows: Array.from({ length: 20 }, () => Array.from({ length: columnCount }, () => "")),
  };
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

  const rows = current.rows.map((row) => [...row]);
  const columnCount = current.columnCount;
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
    if (typeof cell.value !== "string" || cell.value.length > MAX_CELL_LENGTH) {
      return { ok: false, error: "Cell values must be text of 4,000 characters or fewer." };
    }
    rows[cell.row][cell.column] = cell.value;
  }

  for (const row of edits.appendRows ?? []) {
    if (!Array.isArray(row) || row.length > columnCount || row.some((cell) =>
      typeof cell !== "string" || cell.length > MAX_CELL_LENGTH,
    )) {
      return { ok: false, error: "Each appended row must contain text values that fit the current columns." };
    }
    if (rows.length >= MAX_ROWS) {
      return { ok: false, error: "This spreadsheet has reached the 1,000-row limit." };
    }
    rows.push([...row, ...Array.from({ length: columnCount - row.length }, () => "")]);
  }

  let nextColumnCount = columnCount;
  for (const column of edits.appendColumns ?? []) {
    if (!Array.isArray(column.values) || column.values.length > rows.length || column.values.some((cell) =>
      typeof cell !== "string" || cell.length > MAX_CELL_LENGTH,
    )) {
      return { ok: false, error: "Each appended column must contain text values for existing rows only." };
    }
    if (nextColumnCount >= MAX_COLUMNS) {
      return { ok: false, error: "This spreadsheet has reached the 40-column limit." };
    }
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      rows[rowIndex].push(column.values[rowIndex] ?? "");
    }
    nextColumnCount += 1;
  }

  return {
    ok: true,
    data: { kind: "spreadsheet", version: 1, columnCount: nextColumnCount, rows },
    ...(title ? { title } : {}),
  };
}