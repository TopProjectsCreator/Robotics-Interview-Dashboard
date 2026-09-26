import type { SpreadsheetData } from "@workspace/api-zod";

const MAX_COLUMNS = 40;
const MAX_ROWS = 1000;
const MAX_CELL_LENGTH = 4000;

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