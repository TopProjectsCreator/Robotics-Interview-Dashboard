import assert from "node:assert/strict";
import test from "node:test";
import {
  initialSpreadsheetData,
  isSpreadsheetRecordData,
  parseSpreadsheetData,
  applySpreadsheetAssistantEdits,
} from "./spreadsheetOperations.ts";

test("new spreadsheets start as an editable rectangular grid", () => {
  const data = initialSpreadsheetData();

  assert.equal(data.kind, "spreadsheet");
  assert.equal(data.version, 1);
  assert.equal(data.columnCount, 8);
  assert.equal(data.rows.length, 20);
  assert.ok(data.rows.every((row) => row.length === 8 && row.every((cell) => cell === "")));
  assert.deepEqual(parseSpreadsheetData(JSON.stringify(data)), data);
});

test("spreadsheet validation rejects ragged and oversized cell data", () => {
  const base = initialSpreadsheetData();

  assert.equal(parseSpreadsheetData({ ...base, rows: [["a"], ["a", "b"]] }), null);
  assert.equal(parseSpreadsheetData({
    ...base,
    rows: [[...Array(8).fill("x"), "extra"]],
  }), null);
  assert.equal(parseSpreadsheetData({
    ...base,
    rows: [[...Array(7).fill(""), "x".repeat(4001)]],
  }), null);
  assert.equal(parseSpreadsheetData("{not json"), null);
});

test("spreadsheet discriminator detection preserves non-spreadsheet rows", () => {
  assert.equal(isSpreadsheetRecordData(JSON.stringify(initialSpreadsheetData())), true);
  assert.equal(isSpreadsheetRecordData(JSON.stringify({ kind: "document" })), false);
  assert.equal(isSpreadsheetRecordData("legacy whiteboard data"), false);
});

test("assistant spreadsheet edits update cells and append rectangular rows and columns", () => {
  const current = {
    kind: "spreadsheet",
    version: 1,
    columnCount: 2,
    rows: [["Name", "Status"], ["Ari", "Queued"]],
  };
  const result = applySpreadsheetAssistantEdits(current, {
    cells: [{ row: 1, column: 1, value: "Scheduled" }],
    appendRows: [["Bea"]],
    appendColumns: [{ values: ["Interviewer", "Mina", "Noah"] }],
    title: "Interview plan",
  });

  assert.equal(result.ok, true);
  assert.equal(result.title, "Interview plan");
  assert.deepEqual(result.data, {
    kind: "spreadsheet",
    version: 1,
    columnCount: 3,
    rows: [
      ["Name", "Status", "Interviewer"],
      ["Ari", "Scheduled", "Mina"],
      ["Bea", "", "Noah"],
    ],
  });
  assert.deepEqual(current.rows, [["Name", "Status"], ["Ari", "Queued"]]);
});

test("assistant spreadsheet edits reject out-of-range cells and oversized grids", () => {
  const current = {
    kind: "spreadsheet",
    version: 1,
    columnCount: 1,
    rows: [["Header"]],
  };

  assert.deepEqual(
    applySpreadsheetAssistantEdits(current, { cells: [{ row: 1, column: 0, value: "bad" }] }),
    { ok: false, error: "Cell coordinates must refer to an existing zero-based row and column." },
  );
  assert.deepEqual(
    applySpreadsheetAssistantEdits(current, { appendRows: [["a", "b"]] }),
    { ok: false, error: "Each appended row must contain text values that fit the current columns." },
  );
});