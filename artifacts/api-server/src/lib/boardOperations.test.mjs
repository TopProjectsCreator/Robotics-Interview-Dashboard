import assert from "node:assert/strict";
import test from "node:test";
import { UpdateBoardResponse } from "../../../../lib/api-zod/src/generated/api.ts";
import { applyBoardOperation, initialBoardData, parseBoardData } from "./boardOperations.ts";

function apply(data, operation) {
  const result = applyBoardOperation(data, operation, "Alex");
  assert.equal(result.ok, true, result.ok ? "" : result.error);
  return result.data;
}

function addCard(data, title, columnId = "backlog") {
  const next = apply(data, {
    operation: "create_card",
    card: { title, columnId },
  });
  return { data: next, card: next.cards.find((card) => card.title === title) };
}

test("cards can be moved between columns and reordered within a column", () => {
  let data = initialBoardData();
  let added = addCard(data, "Review battery plan");
  data = added.data;
  const first = added.card;
  added = addCard(data, "Confirm manipulator handoff");
  data = added.data;
  const second = added.card;

  data = apply(data, {
    operation: "move_card",
    cardId: first.id,
    targetColumnId: "planned",
    beforeCardId: null,
  });
  data = apply(data, {
    operation: "move_card",
    cardId: second.id,
    targetColumnId: "planned",
    beforeCardId: first.id,
  });

  const planned = data.cards
    .filter((card) => card.columnId === "planned")
    .sort((a, b) => a.position - b.position);
  assert.deepEqual(planned.map((card) => card.id), [second.id, first.id]);
  assert.deepEqual(planned.map((card) => card.position), [0, 1]);
});

test("sequential edits preserve changes to different cards", () => {
  let data = initialBoardData();
  let added = addCard(data, "Inspect lidar mount");
  data = added.data;
  const first = added.card;
  added = addCard(data, "Review safety checklist");
  data = added.data;
  const second = added.card;

  data = apply(data, {
    operation: "update_card",
    cardId: first.id,
    cardPatch: { priority: "urgent" },
  });
  data = apply(data, {
    operation: "update_card",
    cardId: second.id,
    cardPatch: { assignee: "Morgan" },
  });

  assert.equal(data.cards.find((card) => card.id === first.id).priority, "urgent");
  assert.equal(data.cards.find((card) => card.id === second.id).assignee, "Morgan");
});

test("bulk additions use their requested column and deleting a column keeps its cards", () => {
  let data = initialBoardData();
  data = apply(data, {
    operation: "create_column",
    title: "Ready for review",
    color: "#778899",
  });
  const reviewColumn = data.columns.find((column) => column.title === "Ready for review");

  data = apply(data, {
    operation: "bulk_add_cards",
    titles: ["Check simulation", "Approve handoff"],
    targetColumnId: reviewColumn.id,
  });
  assert.equal(data.cards.filter((card) => card.columnId === reviewColumn.id).length, 2);

  data = apply(data, {
    operation: "delete_column",
    columnId: reviewColumn.id,
    targetColumnId: "backlog",
  });
  assert.equal(data.columns.some((column) => column.id === reviewColumn.id), false);
  assert.equal(data.cards.every((card) => card.columnId === "backlog"), true);
  assert.deepEqual(data.cards.map((card) => card.position), [0, 1]);
});

test("invalid card dates are rejected instead of being silently stored", () => {
  const result = applyBoardOperation(initialBoardData(), {
    operation: "create_card",
    card: { title: "Schedule review", startDate: "2026-02-31" },
  }, "Alex");

  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /valid start date/i);
});

test("board name and description changes are stored, including clearing the description", () => {
  const renamed = applyBoardOperation(initialBoardData(), {
    operation: "rename_board",
    title: "Hello",
    description: "Plan for the Saturday interviews",
  }, "Alex");

  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  assert.equal(renamed.title, "Hello");
  assert.equal(renamed.data.description, "Plan for the Saturday interviews");

  const cleared = applyBoardOperation(renamed.data, {
    operation: "rename_board",
    description: "",
  }, "Alex");
  assert.equal(cleared.ok, true);
  if (cleared.ok) assert.equal(cleared.data.description, "");
});

test("older boards get a default description and updated responses match the generated schema", () => {
  const legacyData = { ...initialBoardData() };
  delete legacyData.description;
  const parsedLegacy = parseBoardData(JSON.stringify(legacyData));
  assert.equal(parsedLegacy?.description, "Open tasks, handoffs, and timeline");

  const result = applyBoardOperation(initialBoardData(), {
    operation: "rename_board",
    title: "Hello",
    description: "The plan for interview day",
  }, "Alex");
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const now = new Date().toISOString();
  const response = UpdateBoardResponse.parse({
    id: "board-fixture",
    title: result.title,
    data: result.data,
    createdBy: "Alex",
    scope: "shared",
    peer: null,
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(response.title, "Hello");
  assert.equal(response.data.description, "The plan for interview day");
});
