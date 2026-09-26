import assert from "node:assert/strict";
import test from "node:test";
import {
  initialSpreadsheetData,
  isSpreadsheetRecordData,
  parseSpreadsheetData,
  applySpreadsheetAssistantEdits,
  spreadsheetPreviewRows,
  spreadsheetRevision,
  spreadsheetRevisionMatches,
} from "./spreadsheetOperations.ts";

test("new spreadsheets start as a multi-sheet workbook with a sparse grid", () => {
  const data = initialSpreadsheetData();

  assert.equal(data.kind, "spreadsheet");
  assert.equal(data.version, 2);
  assert.equal(data.workbook.length, 1);
  assert.equal(data.workbook[0].name, "Sheet1");
  assert.equal(data.workbook[0].row, 1000);
  assert.equal(data.workbook[0].column, 26);
  assert.deepEqual(data.workbook[0].celldata, []);
  assert.deepEqual(parseSpreadsheetData(JSON.stringify(data)), data);
});

test("spreadsheet validation rejects invalid workbook coordinates, duplicate sheets, and unsafe macros", () => {
  const base = initialSpreadsheetData();

  assert.equal(parseSpreadsheetData({
    ...base,
    workbook: [
      { id: "one", name: "Roster", celldata: [] },
      { id: "two", name: "roster", celldata: [] },
    ],
  }), null);
  assert.equal(parseSpreadsheetData({
    ...base,
    workbook: [{ id: "one", name: "Roster", celldata: [{ r: 1_048_576, c: 0, v: { v: "outside" } }] }],
  }), null);
  assert.equal(parseSpreadsheetData({
    ...base,
    macros: [{ id: "bad", name: "Unsafe", operations: [{ op: "runJavaScript", source: "alert(1)" }] }],
  }), null);
  assert.equal(parseSpreadsheetData("{not json"), null);
});

test("spreadsheet discriminator detection preserves non-spreadsheet rows", () => {
  assert.equal(isSpreadsheetRecordData(JSON.stringify(initialSpreadsheetData())), true);
  assert.equal(isSpreadsheetRecordData(JSON.stringify({ kind: "document" })), false);
  assert.equal(isSpreadsheetRecordData("legacy whiteboard data"), false);
});

test("two sessions editing different cells produce a clear conflict instead of replacing the first save", () => {
  const title = "Interview notes";
  const initial = initialSpreadsheetData();
  const sessionA = structuredClone(initial);
  const sessionB = structuredClone(initial);
  sessionA.workbook[0].celldata.push({ r: 0, c: 0, v: { v: "Session A" } });
  sessionB.workbook[0].celldata.push({ r: 0, c: 1, v: { v: "Session B" } });

  const revisionSeenByBothSessions = spreadsheetRevision(title, initial);
  let persisted = { title, data: initial };

  const save = (expectedRevision, nextData) => {
    if (!spreadsheetRevisionMatches(expectedRevision, persisted.title, persisted.data)) {
      return { status: 409, current: persisted };
    }
    persisted = { title: persisted.title, data: nextData };
    return { status: 200, current: persisted };
  };

  assert.equal(save(revisionSeenByBothSessions, sessionA).status, 200);
  const staleSave = save(revisionSeenByBothSessions, sessionB);

  assert.equal(staleSave.status, 409);
  assert.equal(staleSave.current.data.workbook[0].celldata[0].v.v, "Session A");
  assert.equal(staleSave.current.data.workbook[0].celldata.some((cell) => cell.v.v === "Session B"), false);
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

test("assistant edits retain workbook formatting, formulas, charts, and macros", () => {
  const current = initialSpreadsheetData();
  current.workbook[0].celldata = [
    { r: 0, c: 0, v: { v: "Name", bg: "#ddeeff" } },
    { r: 0, c: 1, v: { v: "Points", bl: 1 } },
    { r: 1, c: 0, v: { v: "Ari" } },
    { r: 1, c: 1, v: { v: 4 } },
  ];
  current.workbook[0].charts = [{
    id: "chart-1",
    title: "Points",
    type: "bar",
    startRow: 0,
    endRow: 1,
    startColumn: 0,
    endColumn: 1,
  }];
  current.macros = [{
    id: "macro-1",
    name: "Add total",
    operations: [{
      op: "setCell",
      sheetId: "sheet-1",
      row: 2,
      column: 1,
      value: "=SUM(B2:B3)",
      formula: true,
    }],
  }];

  const result = applySpreadsheetAssistantEdits(current, {
    sheetName: "Sheet1",
    cells: [{ row: 2, column: 1, value: "=SUM(B2:B2)" }],
    appendRows: [["Bea", "7"]],
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.version, 2);
  assert.deepEqual(result.data.workbook[0].charts, current.workbook[0].charts);
  assert.deepEqual(result.data.macros, current.macros);
  const formula = result.data.workbook[0].celldata.find((cell) => cell.r === 2 && cell.c === 1);
  assert.equal(formula.v.f, "=SUM(B2:B2)");
  assert.equal(result.data.workbook[0].celldata.find((cell) => cell.r === 0 && cell.c === 0).v.bg, "#ddeeff");
  assert.deepEqual(spreadsheetPreviewRows(result.data, { limit: 4, columnLimit: 3 }).rows.slice(0, 3), [
    ["Name", "Points", ""],
    ["Ari", "4", ""],
    ["", "=SUM(B2:B2)", ""],
  ]);
  assert.deepEqual(spreadsheetPreviewRows(result.data, { offset: 3, limit: 1, columnLimit: 3 }).rows, [
    ["Bea", "7", ""],
  ]);
});

test("legacy spreadsheet records remain readable and assistant-editable", () => {
  const legacy = {
    kind: "spreadsheet",
    version: 1,
    columnCount: 2,
    rows: [["Name", "Status"], ["Ari", "Queued"]],
  };
  assert.deepEqual(parseSpreadsheetData(legacy), legacy);
  const edited = applySpreadsheetAssistantEdits(legacy, {
    cells: [{ row: 1, column: 1, value: "Ready" }],
  });
  assert.equal(edited.ok, true);
  assert.equal(edited.data.version, 1);
  assert.equal(edited.data.rows[1][1], "Ready");
});