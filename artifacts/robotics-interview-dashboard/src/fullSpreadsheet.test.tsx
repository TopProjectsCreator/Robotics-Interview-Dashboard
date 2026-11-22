import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import * as XLSX from "xlsx";
import { afterEach, describe, expect, it, vi } from "vitest";

import { FullSpreadsheetViewer } from "./components/FullSpreadsheetViewer";
import { renderWorksheetToHtml } from "./lib/spreadsheetFullPreview";

function twoSheetWorkbookBlob(): Blob {
  const scores = XLSX.utils.aoa_to_sheet([
    ["Quarterly results", "", ""],
    ["Name", "Score", "Notes"],
    ["Ada", 10, "first"],
    ["Grace", 20, "second"],
    ["Total", 30, ""],
  ]);
  scores["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
  scores.B5.f = "SUM(B3:B4)";
  scores.B5.v = 30;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, scores, "Scores");
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet([["Region", "Units"], ["West", 5], ["East", 7]]),
    "Regions",
  );
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("full-fidelity spreadsheet preview", () => {
  it("renders every sheet as a tab with merged cells and a formula tooltip", async () => {
    const { container } = render(
      <FullSpreadsheetViewer name="results.xlsx" blob={twoSheetWorkbookBlob()} downloadUrl="blob:results" />,
    );

    expect(await screen.findByRole("tab", { name: "Scores" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Regions" })).toHaveAttribute("aria-selected", "false");

    const merged = await waitFor(() => {
      const cell = container.querySelector('[data-testid="spreadsheet-sheet-panel"] td[colspan="3"]');
      expect(cell).not.toBeNull();
      return cell as HTMLElement;
    });
    expect(merged).toHaveTextContent("Quarterly results");

    const formulaCell = await waitFor(() => {
      const cell = container.querySelector('[data-formula="=SUM(B3:B4)"]');
      expect(cell).not.toBeNull();
      return cell as HTMLElement;
    });
    expect(formulaCell).toHaveAttribute("title", "Formula: =SUM(B3:B4)");
    expect(formulaCell).toHaveTextContent("30");
    expect(within(screen.getByTestId("spreadsheet-sheet-panel")).getByText("Grace")).toBeInTheDocument();
  });

  it("switches sheets without losing the download action", async () => {
    const clicks: HTMLAnchorElement[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });
    const { container } = render(
      <FullSpreadsheetViewer name="results.xlsx" blob={twoSheetWorkbookBlob()} downloadUrl="blob:results" />,
    );

    fireEvent.click(await screen.findByRole("tab", { name: "Regions" }));

    const panel = screen.getByTestId("spreadsheet-sheet-panel");
    await waitFor(() => expect(panel).toHaveTextContent("West"));
    expect(panel).toHaveTextContent("East");
    expect(panel).not.toHaveTextContent("Quarterly results");
    expect(container.querySelector('td[colspan="3"]')).toBeNull();

    const download = screen.getByRole("button", { name: "Download results.xlsx" });
    fireEvent.click(download);
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(clicks[0]?.download).toBe("results.xlsx");
  });

  it("shows the formula text when Show formulas is enabled", async () => {
    const { container } = render(
      <FullSpreadsheetViewer name="results.xlsx" blob={twoSheetWorkbookBlob()} downloadUrl={null} />,
    );
    const toggle = await screen.findByTestId("spreadsheet-show-formulas");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    const formulaCell = await waitFor(() => {
      const cell = container.querySelector('[data-formula="=SUM(B3:B4)"]');
      expect(cell).not.toBeNull();
      return cell as HTMLElement;
    });
    expect(formulaCell).toHaveTextContent("30");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    // dangerouslySetInnerHTML replaces the whole subtree, so re-query.
    const formulaView = await waitFor(() => {
      const cell = container.querySelector('[data-formula="=SUM(B3:B4)"]');
      expect(cell).toHaveTextContent("=SUM(B3:B4)");
      return cell as HTMLElement;
    });
    expect(formulaView).toHaveAttribute("title", "Formula: =SUM(B3:B4)");
  });

  it("keeps cell styling, merges and formulas when rendering a worksheet directly", () => {
    const worksheet = XLSX.utils.aoa_to_sheet([["Header", "Value"], ["Label", 42]]);
    worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];
    worksheet.A1.s = {
      font: { bold: true, sz: 14, color: { rgb: "FFFF0000" } },
      fill: { patternType: "solid", fgColor: { rgb: "FFFFFF00" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: { bottom: { style: "thin", color: { rgb: "FF000000" } } },
    };
    worksheet.B2.f = "A1";
    worksheet.B2.v = "Header";

    const result = renderWorksheetToHtml(worksheet);

    expect(result.html).toContain('colspan="2"');
    expect(result.html).toContain("font-weight:bold");
    expect(result.html).toContain("font-size:14pt");
    expect(result.html).toContain("color:#FF0000");
    expect(result.html).toContain("background-color:#FFFF00");
    expect(result.html).toContain("text-align:center");
    expect(result.html).toContain("border-bottom:1px solid #000000");
    expect(result.html).toContain('data-formula="=A1"');
    expect(result.formulaCount).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("reports truncation instead of silently dropping rows", () => {
    const rows = Array.from({ length: 12 }, (_, index) => [`Row ${index + 1}`, index]);
    const result = renderWorksheetToHtml(XLSX.utils.aoa_to_sheet(rows), { maxRows: 5, maxColumns: 1 });

    expect(result.truncated).toBe(true);
    expect(result.rowCount).toBe(5);
    expect(result.columnCount).toBe(1);
    expect(result.totalRows).toBe(12);
    expect(result.totalColumns).toBe(2);
    expect(result.html).toContain("Row 5");
    expect(result.html).not.toContain("Row 6");
  });

  it("escapes cell text so spreadsheet content cannot inject markup", async () => {
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["Payload", "Value"],
      ["<img src=x onerror=alert(1)>", "</td><script>alert(1)</script>"],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Injection");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

    const { container } = render(<FullSpreadsheetViewer name="payload.xlsx" blob={blob} downloadUrl={null} />);

    await waitFor(() => expect(container.querySelector("table")).not.toBeNull());
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("img")).toBeNull();
    expect(container).toHaveTextContent("<img src=x onerror=alert(1)>");
    expect(container).toHaveTextContent("</td><script>alert(1)</script>");
  });
});
