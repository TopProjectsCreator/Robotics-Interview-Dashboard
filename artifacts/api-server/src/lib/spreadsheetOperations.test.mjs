import assert from "node:assert/strict";
import test from "node:test";
import {
  initialSpreadsheetData,
  isSpreadsheetRecordData,
  parseSpreadsheetData,
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