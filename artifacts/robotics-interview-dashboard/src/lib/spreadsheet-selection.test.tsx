import { describe, expect, it } from "vitest";
import { normalizeSavedSheetSelection } from "./spreadsheet-selection";

describe("normalizeSavedSheetSelection", () => {
  it("replaces a malformed saved endpoint with the first cell", () => {
    expect(normalizeSavedSheetSelection(
      [{ row: [0, 0], column: [0, null] }],
      1000,
      26,
    )).toEqual([{
      row: [0, 0],
      column: [0, 0],
      row_focus: 0,
      column_focus: 0,
    }]);
  });

  it("clamps valid ranges and focus coordinates to worksheet dimensions", () => {
    expect(normalizeSavedSheetSelection(
      [{ row: [3, 9], column: [2, 7], row_focus: 8, column_focus: 6 }],
      5,
      5,
    )).toEqual([{
      row: [3, 4],
      column: [2, 4],
      row_focus: 4,
      column_focus: 4,
    }]);
  });
});