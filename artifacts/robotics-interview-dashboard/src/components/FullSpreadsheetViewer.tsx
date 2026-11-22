import { useEffect, useMemo, useState } from "react";
import DOMPurify from "dompurify";

import {
  MAX_PREVIEW_ROWS,
  parseSpreadsheetWorkbook,
  renderWorksheetToHtml,
  type ParsedSpreadsheetWorkbook,
} from "../lib/spreadsheetFullPreview";

export type FullSpreadsheetViewerProps = {
  /** Original file name, shown in the header and used for the download. */
  name: string;
  /** The original bytes; parsed here with SheetJS (XLSX/XLS/CSV/TSV/ODS). */
  blob: Blob;
  /** URL for the original file. When null, no download button is rendered. */
  downloadUrl: string | null;
};

/** Only table markup and presentation attributes survive sanitization. */
const SANITIZE_CONFIG = {
  ALLOWED_TAGS: ["table", "tbody", "thead", "tr", "td", "th", "a", "b", "i", "u", "strong", "em", "span", "br"],
  ALLOWED_ATTR: [
    "class", "style", "title", "colspan", "rowspan",
    "data-address", "data-formula", "data-t", "data-v",
    "href", "target", "rel",
  ],
  ALLOW_DATA_ATTR: true,
};

function triggerSpreadsheetDownload(url: string, name: string): void {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.style.position = "fixed";
  anchor.style.left = "-10000px";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

const CELL_GRID_CSS = `
.spreadsheet-grid-table { border-collapse: collapse; width: max-content; min-width: 100%; font-size: 12px; }
.spreadsheet-grid-table td { border: 1px solid #e3eceb; padding: 4px 8px; vertical-align: top; color: #33454d; white-space: pre-wrap; word-break: break-word; }
.spreadsheet-grid-table a { color: #16869a; text-decoration: underline; }
.dark .spreadsheet-grid-table td { border-color: #2a3f52; color: #c4d2dc; }
.dark .spreadsheet-grid-table a { color: #8fd7e0; }
`;

/**
 * Self-contained, full-fidelity spreadsheet preview. It owns its own parsing,
 * sheet tabs, formula toggle, sanitized HTML table and download button, so the
 * shared WorkspaceFileViewer only has to hand it the original blob.
 */
export function FullSpreadsheetViewer({ name, blob, downloadUrl }: FullSpreadsheetViewerProps) {
  const [workbook, setWorkbook] = useState<ParsedSpreadsheetWorkbook | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [showFormulas, setShowFormulas] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setWorkbook(null);
    setActiveSheet(0);
    setFailed(false);
    parseSpreadsheetWorkbook(blob)
      .then((parsed) => {
        if (!active) return;
        if (!parsed.sheetNames.length) throw new Error("Workbook has no sheets");
        setWorkbook(parsed);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [blob]);

  const sheetName = workbook?.sheetNames[Math.min(activeSheet, Math.max(0, workbook.sheetNames.length - 1))] ?? null;
  const worksheet = sheetName ? workbook?.sheets[sheetName] : undefined;
  const rendered = useMemo(
    () => (worksheet ? renderWorksheetToHtml(worksheet, { showFormulas }) : null),
    [worksheet, showFormulas],
  );
  const safeHtml = useMemo(
    () => (rendered ? DOMPurify.sanitize(rendered.html, SANITIZE_CONFIG) : ""),
    [rendered],
  );

  return (
    <div className="my-2 space-y-2" data-testid="full-spreadsheet-preview">
      <style>{CELL_GRID_CSS}</style>
      <div className="rounded-xl border border-[#dce9e8] bg-white dark:border-[#2a3f52] dark:bg-[#10232d]">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dce9e8] px-3 py-2 dark:border-[#2a3f52]">
          <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">
            {name} · spreadsheet preview
          </p>
          <button
            type="button"
            aria-pressed={showFormulas}
            data-testid="spreadsheet-show-formulas"
            onClick={() => setShowFormulas((value) => !value)}
            className="inline-flex items-center rounded-lg border border-[#d5e0e0] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#16869a] hover:bg-[#f7faf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] aria-pressed:bg-[#edf4f3] dark:border-[#355663] dark:bg-[#172b38] dark:text-[#8fd7e0] dark:hover:bg-[#1c3542]"
          >
            Show formulas
          </button>
        </div>

        {workbook && workbook.sheetNames.length > 1 && (
          <div role="tablist" aria-label={`Sheets in ${name}`} className="flex flex-wrap gap-1 border-b border-[#eef3f2] bg-[#f7faf9] px-2 py-1 dark:border-[#2a3f52] dark:bg-[#0d1e27]">
            {workbook.sheetNames.map((sheet, index) => (
              <button
                key={sheet}
                type="button"
                role="tab"
                aria-selected={index === activeSheet}
                onClick={() => setActiveSheet(index)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] ${
                  index === activeSheet
                    ? "bg-white text-[#16869a] shadow-sm dark:bg-[#172b38] dark:text-[#8fd7e0]"
                    : "text-[#667b82] hover:bg-white/70 dark:text-[#a8bac8] dark:hover:bg-[#172b38]"
                }`}
              >
                {sheet}
              </button>
            ))}
          </div>
        )}

        {failed ? (
          <div role="alert" data-testid="spreadsheet-preview-error" className="p-3 text-xs text-[#a34d46] dark:text-[#f1aaa4]">
            Couldn’t preview {name}. The workbook may be malformed or use an unsupported format. Download the original to open it.
          </div>
        ) : !workbook ? (
          <p role="status" className="p-3 text-xs text-[#7c8c91]">Preparing spreadsheet preview…</p>
        ) : !rendered || !rendered.rowCount ? (
          <p role="status" className="p-3 text-xs text-[#7c8c91]">This spreadsheet is empty.</p>
        ) : (
          <>
            <div
              role="tabpanel"
              aria-label={`Sheet ${sheetName ?? ""}`}
              data-testid="spreadsheet-sheet-panel"
              className="max-h-[560px] overflow-auto p-2"
            >
              {workbook.sheetNames.length === 1 && (
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[.12em] text-[#16869a]">
                  {sheetName}
                </p>
              )}
              <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
            </div>
            {rendered.truncated && (
              <p className="border-t border-[#eef3f2] px-3 py-2 text-[11px] text-[#7c8c91] dark:border-[#2a3f52]">
                Showing the first {rendered.rowCount.toLocaleString()} of {rendered.totalRows.toLocaleString()} rows
                {rendered.columnCount < rendered.totalColumns
                  ? ` and ${rendered.columnCount.toLocaleString()} of ${rendered.totalColumns.toLocaleString()} columns`
                  : ""}
                . Download the original for the full workbook.
              </p>
            )}
            {rendered.formulaCount > 0 && !showFormulas && (
              <p className="px-3 pb-2 text-[11px] text-[#7c8c91]">
                {rendered.formulaCount} formula cell{rendered.formulaCount === 1 ? "" : "s"} · hover a cell to see its formula.
              </p>
            )}
          </>
        )}
      </div>

      {downloadUrl && (
        <button
          type="button"
          data-testid="workspace-attachment-download"
          onClick={(event) => {
            event.stopPropagation();
            triggerSpreadsheetDownload(downloadUrl, name);
          }}
          className="inline-flex w-fit items-center rounded-lg border border-[#d5e0e0] bg-white px-3 py-1.5 text-xs font-semibold text-[#16869a] hover:bg-[#f7faf9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16869a] dark:border-[#355663] dark:bg-[#172b38] dark:text-[#8fd7e0] dark:hover:bg-[#1c3542]"
        >
          Download {name}
        </button>
      )}
    </div>
  );
}

/** Alias for callers that prefer the "Preview" naming used elsewhere. */
export const FullSpreadsheetPreview = FullSpreadsheetViewer;
export { MAX_PREVIEW_ROWS };
