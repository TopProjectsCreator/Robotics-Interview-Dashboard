/**
 * Full-fidelity spreadsheet preview helpers.
 *
 * SheetJS's community `sheet_to_html` only emits cached values and merge
 * spans: despite what its name suggests, 0.18.5 drops cell styles, number
 * formats and formulas. This module builds the equivalent table directly from
 * worksheet cells so fonts, fills, alignment, borders, merged ranges,
 * hyperlinks and formulas all survive. The output is escaped HTML that the
 * viewer sanitizes with DOMPurify before it reaches the DOM.
 */

import type { CellObject, WorkSheet } from "xlsx";

/** A generous ceiling: never freeze the browser on a 1M-row export. */
export const MAX_PREVIEW_ROWS = 5000;
export const MAX_PREVIEW_COLUMNS = 256;

export type ParsedSpreadsheetWorkbook = {
  sheetNames: string[];
  sheets: Record<string, WorkSheet>;
};

export type WorksheetRenderOptions = {
  /** Replace cached values with `=FORMULA` text while keeping the tooltip. */
  showFormulas?: boolean;
  maxRows?: number;
  maxColumns?: number;
};

export type RenderedWorksheet = {
  html: string;
  rowCount: number;
  columnCount: number;
  totalRows: number;
  totalColumns: number;
  truncated: boolean;
  formulaCount: number;
};

/** Reads any XLSX/XLS/CSV/TSV blob with styles, formulas and stubs retained. */
export async function parseSpreadsheetWorkbook(blob: Blob): Promise<ParsedSpreadsheetWorkbook> {
  // Dynamic import keeps the large SheetJS bundle out of the initial app load.
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await blob.arrayBuffer(), {
    type: "array",
    cellDates: true,
    cellStyles: true,
    cellFormula: true,
    cellNF: true,
    sheetStubs: true,
  });
  const sheets: Record<string, WorkSheet> = {};
  for (const name of workbook.SheetNames) sheets[name] = workbook.Sheets[name];
  return { sheetNames: [...workbook.SheetNames], sheets };
}

type ParsedAddress = { row: number; column: number };

function parseAddress(address: string): ParsedAddress {
  const match = /^([A-Z]+)(\d+)$/i.exec(address.trim());
  if (!match) return { row: 0, column: 0 };
  let column = 0;
  for (const character of match[1].toUpperCase()) column = column * 26 + (character.charCodeAt(0) - 64);
  return { row: Math.max(0, Number(match[2]) - 1), column: Math.max(0, column - 1) };
}

/** Zero-based column index to Excel letters (0 -> A, 25 -> Z, 26 -> AA). */
export function columnLabel(index: number): string {
  let label = "";
  let remaining = Math.max(0, index) + 1;
  while (remaining > 0) {
    const digit = (remaining - 1) % 26;
    label = String.fromCharCode(65 + digit) + label;
    remaining = Math.floor((remaining - 1) / 26);
  }
  return label;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ExcelColor = { rgb?: string; indexed?: number; theme?: number } | string | undefined;

// Standard Office theme / indexed palettes, so theme-based colours still show.
const THEME_COLORS = [
  "#FFFFFF", "#000000", "#EEECE1", "#1F497D", "#4F81BD", "#C0504D", "#9BBB59", "#8064A2",
  "#4BACC6", "#F79646", "#0000FF", "#800080", "#FFFFFF", "#000000", "#EEECE1", "#1F497D",
];
const INDEXED_COLORS = [
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
  "#000000", "#FFFFFF", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF",
];

function colorToCss(color: ExcelColor): string | null {
  if (!color) return null;
  if (typeof color === "string") return /^#[0-9a-f]{3,8}$/i.test(color) ? color : null;
  if (typeof color.rgb === "string" && /^(?:[0-9a-f]{6}|[0-9a-f]{8})$/i.test(color.rgb)) {
    // SheetJS stores ARGB; CSS wants RGB.
    return `#${(color.rgb.length === 8 ? color.rgb.slice(2) : color.rgb).toUpperCase()}`;
  }
  if (typeof color.theme === "number" && THEME_COLORS[color.theme]) return THEME_COLORS[color.theme];
  if (typeof color.indexed === "number" && INDEXED_COLORS[color.indexed]) return INDEXED_COLORS[color.indexed];
  return null;
}

function cellStyleToCss(cell: CellObject): string {
  const style = cell.s as Record<string, any> | undefined;
  if (!style || typeof style !== "object") return "";
  const css: string[] = [];

  const font = style.font as Record<string, any> | undefined;
  if (font) {
    if (font.bold || font.b) css.push("font-weight:bold");
    if (font.italic || font.i) css.push("font-style:italic");
    const decorations: string[] = [];
    if (font.underline || font.u) decorations.push("underline");
    if (font.strike) decorations.push("line-through");
    if (decorations.length) css.push(`text-decoration:${decorations.join(" ")}`);
    if (typeof font.sz === "number") css.push(`font-size:${font.sz}pt`);
    if (typeof font.name === "string" && /^[\w\s,-]+$/.test(font.name)) css.push(`font-family:${font.name}`);
    const color = colorToCss(font.color);
    if (color) css.push(`color:${color}`);
  }

  const fill = style.fill as Record<string, any> | undefined;
  if (fill) {
    const color = colorToCss(fill.fgColor ?? fill.bgColor);
    if (color) css.push(`background-color:${color}`);
  }

  const alignment = style.alignment as Record<string, any> | undefined;
  if (alignment) {
    if (["left", "center", "right", "justify"].includes(alignment.horizontal))
      css.push(`text-align:${alignment.horizontal}`);
    if (["top", "center", "bottom"].includes(alignment.vertical))
      css.push(`vertical-align:${alignment.vertical === "center" ? "middle" : alignment.vertical}`);
    if (alignment.wrapText) css.push("white-space:pre-wrap");
  }

  const border = style.border as Record<string, any> | undefined;
  if (border) {
    for (const side of ["top", "right", "bottom", "left"] as const) {
      const edge = border[side] as Record<string, any> | undefined;
      if (!edge?.style) continue;
      const width = edge.style === "medium" ? "2px" : edge.style === "thick" ? "3px" : "1px";
      css.push(`border-${side}:${width} solid ${colorToCss(edge.color) ?? "#dce9e8"}`);
    }
  }

  return css.join(";");
}

/**
 * Renders one worksheet to a table. Merged ranges become colspan/rowspan (the
 * covered cells are omitted), formulas get a tooltip and a `data-formula`
 * hook, and every value is escaped before the viewer sanitizes the markup.
 */
export function renderWorksheetToHtml(
  worksheet: WorkSheet,
  options: WorksheetRenderOptions = {},
): RenderedWorksheet {
  const empty: RenderedWorksheet = {
    html: "", rowCount: 0, columnCount: 0, totalRows: 0, totalColumns: 0, truncated: false, formulaCount: 0,
  };
  const ref = worksheet?.["!ref"];
  if (!ref) return empty;

  const bounds = String(ref).split(":");
  const start = parseAddress(bounds[0] ?? "A1");
  const end = parseAddress(bounds[1] ?? bounds[0] ?? "A1");
  const firstRow = Math.min(start.row, end.row);
  const lastRow = Math.max(start.row, end.row);
  const firstColumn = Math.min(start.column, end.column);
  const lastColumn = Math.max(start.column, end.column);
  const totalRows = lastRow - firstRow + 1;
  const totalColumns = lastColumn - firstColumn + 1;

  const maxRows = Math.max(1, options.maxRows ?? MAX_PREVIEW_ROWS);
  const maxColumns = Math.max(1, options.maxColumns ?? MAX_PREVIEW_COLUMNS);
  const renderLastRow = Math.min(lastRow, firstRow + maxRows - 1);
  const renderLastColumn = Math.min(lastColumn, firstColumn + maxColumns - 1);
  const truncated = renderLastRow < lastRow || renderLastColumn < lastColumn;

  const covered = new Set<string>();
  const spans = new Map<string, { rowspan: number; colspan: number }>();
  for (const merge of worksheet["!merges"] ?? []) {
    const r0 = Math.max(merge.s.r, firstRow);
    const c0 = Math.max(merge.s.c, firstColumn);
    const r1 = Math.min(merge.e.r, renderLastRow);
    const c1 = Math.min(merge.e.c, renderLastColumn);
    if (r0 > r1 || c0 > c1) continue;
    for (let row = r0; row <= r1; row += 1) {
      for (let column = c0; column <= c1; column += 1) {
        if (row !== merge.s.r || column !== merge.s.c) covered.add(`${row}:${column}`);
      }
    }
    if (
      merge.s.r >= firstRow && merge.s.c >= firstColumn &&
      merge.s.r <= renderLastRow && merge.s.c <= renderLastColumn
    ) {
      const rowspan = Math.max(1, r1 - merge.s.r + 1);
      const colspan = Math.max(1, c1 - merge.s.c + 1);
      if (rowspan > 1 || colspan > 1) spans.set(`${merge.s.r}:${merge.s.c}`, { rowspan, colspan });
    }
  }

  const html: string[] = ['<table class="spreadsheet-grid-table"><tbody>'];
  let formulaCount = 0;
  for (let row = firstRow; row <= renderLastRow; row += 1) {
    html.push("<tr>");
    for (let column = firstColumn; column <= renderLastColumn; column += 1) {
      if (covered.has(`${row}:${column}`)) continue;
      const address = `${columnLabel(column)}${row + 1}`;
      const cell = worksheet[address] as CellObject | undefined;
      const attributes: string[] = [`data-address="${escapeHtml(address)}"`];
      const span = spans.get(`${row}:${column}`);
      if (span && span.rowspan > 1) attributes.push(`rowspan="${span.rowspan}"`);
      if (span && span.colspan > 1) attributes.push(`colspan="${span.colspan}"`);
      const css = cell ? cellStyleToCss(cell) : "";
      if (css) attributes.push(`style="${escapeHtml(css)}"`);

      let content: string;
      if (options.showFormulas && cell?.f) content = escapeHtml(`=${cell.f}`);
      else if (cell?.h) content = cell.h; // SheetJS rich-text HTML; sanitized by the viewer.
      else content = escapeHtml(cell ? String(cell.w ?? cell.v ?? "") : "");

      if (cell?.f) {
        formulaCount += 1;
        const formula = `=${cell.f}`;
        attributes.push(`title="${escapeHtml(`Formula: ${formula}`)}"`);
        attributes.push(`data-formula="${escapeHtml(formula)}"`);
      } else {
        const comment = (cell?.c as { Text?: string } | undefined)?.Text;
        if (typeof comment === "string") attributes.push(`title="${escapeHtml(`Comment: ${comment}`)}"`);
      }

      const target = cell?.l?.Target;
      if (target && !target.startsWith("#")) content = `<a href="${escapeHtml(target)}">${content}</a>`;
      html.push(`<td ${attributes.join(" ")}>${content}</td>`);
    }
    html.push("</tr>");
  }
  html.push("</tbody></table>");

  return {
    html: html.join(""),
    rowCount: renderLastRow - firstRow + 1,
    columnCount: renderLastColumn - firstColumn + 1,
    totalRows,
    totalColumns,
    truncated,
    formulaCount,
  };
}
