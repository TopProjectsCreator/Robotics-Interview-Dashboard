import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { UpdateBoardResponse } from "../../../../lib/api-zod/src/generated/api.ts";
import { interviewerAccountsTable } from "../../../../lib/db/src/schema/interviewerAccounts.ts";
import { revokedSessionsTable } from "../../../../lib/db/src/schema/sessions.ts";
import { interviewWhiteboardsTable } from "../../../../lib/db/src/schema/whiteboards.ts";
import { applyBoardOperation, initialBoardData, parseBoardData } from "./boardOperations.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        try {
          return nextResolve(`${specifier}.ts`, context);
        } catch {
          return nextResolve(`${specifier}/index.ts`, context);
        }
      }
      throw error;
    }
  },
});

const databaseTableNames = [
  "applicantsTable",
  "assistantConversationsTable",
  "assistantMessagesTable",
  "broadcastAcksTable",
  "broadcastsTable",
  "chatCustomEmojisTable",
  "chatMessageReactionsTable",
  "chatPollsTable",
  "chatPollVotesTable",
  "chatSettingsTable",
  "dashboardChartsTable",
  "dataSnapshotsTable",
  "displaySettingsTable",
  "importsTable",
  "interviewChatMessagesTable",
  "interviewQueueTable",
  "pageVisitsTable",
  "partsCatalogItemsTable",
  "partsInventoryTable",
  "partsRobotAllocationsTable",
  "partsRobotsTable",
  "partsSupplierPriceSnapshotsTable",
  "partsSupplierSyncStatesTable",
  "postsTable",
  "presenceHeartbeatsTable",
  "seatingSettingsTable",
];

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

test("an authenticated board task remains present after a fresh GET", async (t) => {
  const account = {
    id: "board-persistence-interviewer",
    displayName: "Alex",
    normalizedName: "alex",
    passwordHash: "configured",
    role: "coordinator",
  };
  const board = {
    id: "board-persistence-fixture",
    title: "Persistence check",
    data: JSON.stringify(initialBoardData()),
    createdBy: account.displayName,
    conversationScope: "shared",
    conversationPeer: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const whereValue = (clause) =>
    clause?.queryChunks?.find((chunk) => chunk.constructor.name === "Param")?.value;
  const rowsFor = (table, clause) => {
    if (table === revokedSessionsTable) return [];
    if (table === interviewerAccountsTable) {
      return whereValue(clause) === account.id ? [account] : [];
    }
    if (table === interviewWhiteboardsTable) {
      return whereValue(clause) === board.id ? [board] : [];
    }
    return [];
  };
  const db = {
    select() {
      const query = {
        table: undefined,
        clause: undefined,
        from(table) {
          this.table = table;
          return this;
        },
        where(clause) {
          this.clause = clause;
          return this;
        },
        limit() {
          return this;
        },
        for() {
          return this;
        },
        then(resolve, reject) {
          return Promise.resolve(rowsFor(this.table, this.clause)).then(resolve, reject);
        },
      };
      return query;
    },
    update(table) {
      let values;
      let clause;
      const updateQuery = {
        set(nextValues) {
          values = nextValues;
          return this;
        },
        where(nextClause) {
          clause = nextClause;
          return this;
        },
        returning() {
          assert.equal(table, interviewWhiteboardsTable);
          assert.equal(whereValue(clause), board.id);
          Object.assign(board, values);
          return Promise.resolve([board]);
        },
      };
      return updateQuery;
    },
    async transaction(callback) {
      return callback(this);
    },
  };

  const mockedTables = Object.fromEntries(databaseTableNames.map((name) => [name, {}]));
  mock.module("@workspace/db", {
    namedExports: {
      ...mockedTables,
      db,
      pool: {},
      interviewerAccountsTable,
      revokedSessionsTable,
      interviewWhiteboardsTable,
    },
  });
  t.after(() => mock.restoreAll());

  const [{ default: express }, { default: roboticsRouter }, { createInterviewerSession }] = await Promise.all([
    import("express"),
    import("../routes/robotics.ts"),
    import("../middlewares/adminAuth.ts"),
  ]);
  const app = express();
  app.use(express.json());
  app.use("/api", roboticsRouter);
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const path = `/boards/${board.id}`;

    const unauthorized = await fetch(`${baseUrl}${path}`);
    assert.equal(unauthorized.status, 401, "board reads must require an interviewer session");

    const session = createInterviewerSession(account.id);
    const patchResponse = await fetch(`${baseUrl}${path}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${session}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        operation: "create_card",
        card: { title: "Confirm saved task", columnId: "backlog" },
      }),
    });
    assert.equal(patchResponse.status, 200);
    const patchedBoard = await patchResponse.json();
    assert.ok(patchedBoard.data.cards.some((card) => card.title === "Confirm saved task"));

    const reloadResponse = await fetch(`${baseUrl}${path}`, {
      headers: { authorization: `Bearer ${session}` },
    });
    assert.equal(reloadResponse.status, 200);
    const reloadedBoard = await reloadResponse.json();
    assert.ok(
      reloadedBoard.data.cards.some((card) => card.title === "Confirm saved task"),
      "a fresh authenticated GET must return the task written by PATCH",
    );
    assert.equal(parseBoardData(board.data)?.cards.some((card) => card.title === "Confirm saved task"), true);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
});
