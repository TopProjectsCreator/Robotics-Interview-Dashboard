type SelectionRecord = Record<string, unknown> & {
  row?: unknown;
  column?: unknown;
  row_focus?: unknown;
  column_focus?: unknown;
};

function clampedIndex(value: unknown, limit: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const maximum = Math.max(1, Math.floor(limit));
  return Math.max(0, Math.min(maximum - 1, Math.floor(value)));
}

function focusedIndex(value: unknown, start: number, end: number, limit: number): number {
  const index = clampedIndex(value, limit);
  return index === null ? start : Math.max(start, Math.min(end, index));
}

function firstCellSelection(): Record<string, unknown>[] {
  return [{
    row: [0, 0],
    column: [0, 0],
    row_focus: 0,
    column_focus: 0,
  }];
}

export function normalizeSavedSheetSelection(
  value: unknown,
  rowCount: number,
  columnCount: number,
): Record<string, unknown>[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return firstCellSelection();

  const normalized: Record<string, unknown>[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const selection = candidate as SelectionRecord;
    if (!Array.isArray(selection.row) || selection.row.length < 2) continue;
    if (!Array.isArray(selection.column) || selection.column.length < 2) continue;

    const rowStart = clampedIndex(selection.row[0], rowCount);
    const rowEnd = clampedIndex(selection.row[1], rowCount);
    const columnStart = clampedIndex(selection.column[0], columnCount);
    const columnEnd = clampedIndex(selection.column[1], columnCount);
    if (rowStart === null || rowEnd === null || columnStart === null || columnEnd === null) continue;

    const row = [Math.min(rowStart, rowEnd), Math.max(rowStart, rowEnd)];
    const column = [Math.min(columnStart, columnEnd), Math.max(columnStart, columnEnd)];
    normalized.push({
      ...selection,
      row,
      column,
      row_focus: focusedIndex(selection.row_focus, row[0], row[1], rowCount),
      column_focus: focusedIndex(selection.column_focus, column[0], column[1], columnCount),
    });
  }

  return normalized.length > 0 ? normalized : firstCellSelection();
}