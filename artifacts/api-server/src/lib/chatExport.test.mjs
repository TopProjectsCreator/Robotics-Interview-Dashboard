import test from "node:test";
import assert from "node:assert/strict";

const {
  CHAT_EXPORT_CSV_COLUMNS,
  activitySummaries,
  chatExportConversationLabel,
  chatExportFileName,
  chatExportHeader,
  escapeCsvCell,
  formatExportTimestamp,
  parseChatExportFormat,
  parseChatExportLastParam,
  rowToChunk,
  sanitizeExportLabel,
} = await import("./chatExport.ts");

const baseRow = {
  id: "msg-1",
  author: "Alex",
  message: "Hello world",
  parentMessageId: null,
  editedAt: null,
  deletedAt: null,
  activities: "[]",
  createdAt: new Date("2026-08-01T14:23:05.000Z"),
};

test("format param accepts the three formats and their aliases", () => {
  assert.equal(parseChatExportFormat("csv"), "csv");
  assert.equal(parseChatExportFormat("MD"), "md");
  assert.equal(parseChatExportFormat("markdown"), "md");
  assert.equal(parseChatExportFormat(" text "), "txt");
  assert.equal(parseChatExportFormat("pdf"), null);
  assert.equal(parseChatExportFormat(undefined), null);
});

test("last param parses positive integers and rejects junk", () => {
  assert.equal(parseChatExportLastParam(undefined), null);
  assert.equal(parseChatExportLastParam(""), null);
  assert.equal(parseChatExportLastParam("5"), 5);
  assert.equal(parseChatExportLastParam("0007"), 7);
  assert.equal(parseChatExportLastParam("0"), "invalid");
  assert.equal(parseChatExportLastParam("-3"), "invalid");
  assert.equal(parseChatExportLastParam("3.5"), "invalid");
  assert.equal(parseChatExportLastParam("99999999999999999999"), "invalid");
  assert.equal(parseChatExportLastParam(["5"]), "invalid");
});

test("csv cells follow RFC 4180 quoting", () => {
  assert.equal(escapeCsvCell("plain"), "plain");
  assert.equal(escapeCsvCell("a,b"), '"a,b"');
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvCell("multi\nline"), '"multi\nline"');
  assert.equal(escapeCsvCell("a\r\nb"), '"a\nb"');
});

test("csv rows carry the full history columns and escape embedded newlines", () => {
  const line = rowToChunk({ ...baseRow, message: "line one\nline two, with comma" }, "csv");
  const cells = line.replace(/\r\n$/, "");
  assert.ok(cells.startsWith("msg-1,"));
  assert.ok(cells.includes('"line one\nline two, with comma"'));
  assert.ok(cells.includes("2026-08-01T14:23:05.000Z"));
  assert.deepEqual([...CHAT_EXPORT_CSV_COLUMNS], ["id", "created_at", "author", "parent_message_id", "edited_at", "deleted_at", "activities", "message"]);
});

test("deleted messages are masked everywhere but keep their timestamp", () => {
  const deleted = { ...baseRow, message: "secret words", deletedAt: new Date("2026-08-02T00:00:00.000Z") };
  for (const format of ["csv", "md", "txt"]) {
    const out = rowToChunk(deleted, format);
    assert.ok(!out.includes("secret words"), `${format} leaked the deleted body`);
    assert.ok(out.includes("[message deleted]"));
  }
  assert.ok(rowToChunk(deleted, "csv").includes("2026-08-02T00:00:00.000Z"));
});

test("activity pills render as compact lines in human formats", () => {
  const row = { ...baseRow, activities: JSON.stringify([{ tool: "web_search", detail: "ftc rules\n2026" }, { tool: "noop" }]) };
  const md = rowToChunk(row, "md");
  assert.ok(md.includes("↳ web_search: ftc rules 2026"));
  assert.ok(md.includes("↳ noop"));
  assert.equal(activitySummaries("not json").length, 0);
  assert.equal(activitySummaries('{"tool":"x"}').length, 0);
});

test("timestamps are UTC and stable", () => {
  assert.equal(formatExportTimestamp(baseRow.createdAt), "2026-08-01 14:23:05 UTC");
});

test("filenames are filesystem-safe slugs", () => {
  const now = new Date("2026-11-13T09:30:05.000Z");
  assert.equal(chatExportFileName("Team chat", "md", now), "chat-export-team-chat-20261113-093005.md");
  assert.equal(chatExportFileName('Weird <>: "Name"! & such', "csv", now), "chat-export-weird-name-such-20261113-093005.csv");
  assert.equal(chatExportFileName("   ", "txt", now), "chat-export-chat-20261113-093005.txt");
  assert.equal(sanitizeExportLabel("a".repeat(200)).length <= 40, true);
});

test("headers differ per format", () => {
  const now = new Date("2026-11-13T09:30:05.000Z");
  assert.equal(chatExportHeader("csv", "Team chat", now), CHAT_EXPORT_CSV_COLUMNS.join(",") + "\r\n");
  assert.ok(chatExportHeader("md", "Team chat", now).startsWith("# Chat export — Team chat\n"));
  assert.ok(chatExportHeader("txt", "Team chat", now).startsWith("Chat export — Team chat\n"));
});

test("conversation labels map shared/direct/channel", () => {
  assert.equal(chatExportConversationLabel({ scope: "shared", peer: null, channelName: null }), "Team chat");
  assert.equal(chatExportConversationLabel({ scope: "direct", peer: "Jordan", channelName: null }), "Jordan");
  assert.equal(chatExportConversationLabel({ scope: "channel", peer: "x", channelName: "CAD War Room" }), "CAD War Room");
  assert.equal(chatExportConversationLabel({ scope: "channel", peer: null, channelName: null }), "channel");
});
