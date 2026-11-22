import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

import { dbMockExports } from "./testDbExports.mjs";
import { UpdateBoardResponse } from "../../../../lib/api-zod/src/generated/api.ts";
import { interviewerAccountsTable } from "../../../../lib/db/src/schema/interviewerAccounts.ts";
import { revokedSessionsTable } from "../../../../lib/db/src/schema/sessions.ts";
import { interviewWhiteboardsTable } from "../../../../lib/db/src/schema/whiteboards.ts";
import { assistantSkillsTable } from "../../../../lib/db/src/schema/assistant.ts";
import { chatChannelsTable, chatChannelMembersTable } from "../../../../lib/db/src/schema/interview.ts";
import { teamsTable, DEFAULT_TEAM_ID, normalizeTeamName } from "../../../../lib/db/src/schema/teams.ts";
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
  "assistantBuilderRunsTable",
  "assistantBuilderSubagentsTable",
  "assistantConversationSharesTable",
  "assistantConversationsTable",
  "assistantIntegrationPoliciesTable",
  "assistantMessagesTable",
  "assistantModelPoliciesTable",
  "assistantModelPolicyHistoryTable",
  "assistantPromptRunsTable",
  "assistantScheduledTaskRunsTable",
  "assistantScheduledTasksTable",
  "assistantSkillsTable",
  "assistantToolPoliciesTable",
  "assistantUsagePromptsTable",
  "assistantUsageRequestsTable",
  "assistantUsageToolsTable",
  "broadcastAcksTable",
  "broadcastsTable",
  "cadBotsTable",
  "cadFoldersTable",
  "cadModelsTable",
  "cadPreviewJobsTable",
  "chatChannelMembersTable",
  "chatChannelsTable",
  "chatCustomEmojisTable",
  "chatMessageReactionsTable",
  "chatMessageReadsTable",
  "chatPollVotesTable",
  "chatPollsTable",
  "chatProductivitySettingsTable",
  "chatProductivitySnapshotsTable",
  "chatSettingsTable",
  "chunkedUploadsTable",
  "codeFilesTable",
  "codePresenceTable",
  "codeProjectsTable",
  "codeRevisionsTable",
  "dashboardChartsTable",
  "dataSnapshotsTable",
  "displaySettingsTable",
  "featureRequestsTable",
  "importsTable",
  "ingestedEmailsTable",
  "interviewChatMessagesTable",
  "interviewQueueTable",
  "interviewWhiteboardsTable",
  "interviewerAccountsTable",
  "maildropInboxesTable",
  "pageVisitsTable",
  "partsCatalogItemsTable",
  "partsInventoryTable",
  "partsRobotAllocationsTable",
  "partsRobotsTable",
  "partsSupplierPriceSnapshotsTable",
  "partsSupplierSyncStatesTable",
  "partsTeamSettingsTable",
  "partsVendorBlocksTable",
  "personalNotepadTable",
  "postsTable",
  "presenceHeartbeatsTable",
  "revokedSessionsTable",
  "scheduledChatMessagesTable",
  "seatingSettingsTable",
  "teamAssistantProvidersTable",
  "teamNameRulesTable",
  "teamRolesTable",
  "teamsTable",
  "webauthnCredentialsTable",
  "workspaceSettingsTable",
  "workspaceUsageActivityTable",
  "workspaceUsageVisitsTable",
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

test("legacy string labels and cards without collaboration fields remain readable", () => {
  let data = initialBoardData();
  const added = addCard(data, "Legacy intake checklist");
  data = added.data;
  const legacy = structuredClone(data);
  const card = legacy.cards[0];
  card.labels = ["hardware", "handoff"];
  delete card.checklist;
  delete card.attachments;
  delete card.cover;
  delete card.comments;
  delete card.activity;

  const parsed = parseBoardData(JSON.stringify(legacy));
  assert.ok(parsed);
  assert.deepEqual(parsed.cards[0].labels.map((label) => label.name), ["hardware", "handoff"]);
  assert.deepEqual(parsed.cards[0].checklist, []);
  assert.deepEqual(parsed.cards[0].attachments, []);
  assert.equal(parsed.cards[0].cover, null);
  assert.deepEqual(parsed.cards[0].comments, []);
  assert.deepEqual(parsed.cards[0].activity, []);
});

test("checklists, colored labels, and card history persist through board operations", () => {
  let data = initialBoardData();
  const added = addCard(data, "Verify odometry");
  data = added.data;
  const card = added.card;
  assert.equal(card.activity[0].actor, "Alex");
  assert.equal(card.activity[0].action, "created");

  data = apply(data, {
    operation: "update_card",
    cardId: card.id,
    cardPatch: {
      labels: [{ name: "robotics", color: "#16869a" }],
      checklist: [
        { id: "step-1", title: "Check encoder direction", completed: false },
        { id: "step-2", title: "Compare wheel distances", completed: true },
      ],
    },
  });
  const updated = data.cards.find((item) => item.id === card.id);
  assert.equal(updated.labels[0].name, "robotics");
  assert.equal(updated.labels[0].color, "#16869a");
  assert.deepEqual(updated.checklist.map((item) => item.completed), [false, true]);
  assert.equal(updated.activity.at(-1).action, "edited");
  assert.equal(updated.activity.at(-1).actor, "Alex");

  data = apply(data, {
    operation: "move_card",
    cardId: card.id,
    targetColumnId: "planned",
  });
  const moved = data.cards.find((item) => item.id === card.id);
  assert.equal(moved.activity.at(-1).action, "moved");
  assert.equal(moved.activity.at(-1).actor, "Alex");
  const reloaded = parseBoardData(JSON.stringify(data));
  assert.equal(reloaded.cards[0].checklist[1].completed, true);
  assert.equal(reloaded.cards[0].activity.at(-1).action, "moved");
});

test("unsafe web links and cross-shape covers are rejected", () => {
  const added = addCard(initialBoardData(), "Attach a safe reference");
  const unsafeLink = applyBoardOperation(added.data, {
    operation: "update_card",
    cardId: added.card.id,
    cardPatch: {
      attachments: [{ type: "link", id: "link-1", label: "unsafe", url: "javascript:alert(1)" }],
    },
  }, "Alex");
  assert.equal(unsafeLink.ok, false);

  const missingCover = applyBoardOperation(added.data, {
    operation: "update_card",
    cardId: added.card.id,
    cardPatch: { cover: { type: "image", assetId: "not-attached" } },
  }, "Alex");
  assert.equal(missingCover.ok, false);

  const nonImageCover = applyBoardOperation(added.data, {
    operation: "update_card",
    cardId: added.card.id,
    cardPatch: {
      attachments: [{
        type: "file",
        id: "asset-12345678",
        name: "spec.pdf",
        contentType: "application/pdf",
        size: 12,
        objectPath: "/objects/board-assets/team-a/board-12345678/asset-12345678",
      }],
      cover: { type: "image", assetId: "asset-12345678" },
    },
  }, "Alex");
  assert.equal(nonImageCover.ok, false, "only image attachments can be used as image covers");
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

test("coordinator board and assistant skill operations remain persisted and team-scoped", async (t) => {
  const account = {
    id: "board-persistence-interviewer",
    displayName: "Alex",
    normalizedName: "alex",
    passwordHash: "configured",
    role: "coordinator",
    teamId: "team-a",
  };
  const otherCoordinator = {
    id: "skill-coordinator-b",
    displayName: "Taylor",
    normalizedName: "taylor",
    passwordHash: "configured",
    role: "coordinator",
    teamId: "team-b",
  };
  const interviewer = {
    id: "skill-interviewer",
    displayName: "Jordan",
    normalizedName: "jordan",
    passwordHash: "configured",
    role: "interviewer",
    teamId: "team-a",
  };
  const outsiderCoordinator = {
    id: "board-direct-outsider",
    displayName: "Casey",
    normalizedName: "casey",
    passwordHash: "configured",
    role: "coordinator",
    teamId: "team-a",
  };
  const accounts = [account, otherCoordinator, interviewer, outsiderCoordinator];
  const board = {
    id: "board-persistence-fixture",
    teamId: account.teamId,
    title: "Persistence check",
    data: JSON.stringify(initialBoardData()),
    createdBy: account.displayName,
    conversationScope: "shared",
    conversationPeer: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const directBoard = {
    id: "board-direct-fixture",
    teamId: account.teamId,
    title: "Private handoff",
    data: JSON.stringify(initialBoardData()),
    createdBy: "Alex",
    conversationScope: "direct",
    conversationPeer: "Alex\u001fMorgan",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const privateChannel = { id: "channel-private", teamId: account.teamId, name: "Invite only" };
  const channelBoard = {
    id: "board-channel-fixture",
    teamId: account.teamId,
    title: "Private channel board",
    data: JSON.stringify(initialBoardData()),
    createdBy: "Alex",
    conversationScope: "channel",
    conversationPeer: privateChannel.id,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
  const skillRows = [
    {
      id: "skill-a",
      teamId: "team-a",
      name: "Team A skill",
      description: "A team-specific workflow",
      instructions: "Use the approved actions.",
      actions: ["search_applicants"],
      enabled: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    {
      id: "skill-b",
      teamId: "team-b",
      name: "Team B skill",
      description: "Another team-specific workflow",
      instructions: "Use the approved actions.",
      actions: ["get_applicant"],
      enabled: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ];
  const storedBoardAssets = new Map();
  const deletedBoardAssetPaths = [];
  class MockObjectStorageService {
    async uploadBoardCardAsset(data, contentType, teamId, boardId, assetId) {
      const objectPath = `/objects/board-assets/${teamId}/${boardId}/${assetId}`;
      storedBoardAssets.set(objectPath, { data: Buffer.from(data), contentType });
      return objectPath;
    }
    async downloadObject(objectPath) {
      const file = storedBoardAssets.get(objectPath);
      if (!file) throw new Error("File not found");
      return file;
    }
    async deleteObject(objectPath) {
      deletedBoardAssetPaths.push(objectPath);
      storedBoardAssets.delete(objectPath);
    }
  }
  // Collect every bound Param value, recursing into nested chunks: team
  // scoping wraps id lookups in and(...), so the id is no longer always the
  // first top-level chunk.
  const paramValues = (clause) => {
    const out = [];
    const visit = (node) => {
      if (!node || typeof node !== "object") return;
      if (node.constructor?.name === "Param") {
        out.push(node.value);
        return;
      }
      if (Array.isArray(node.queryChunks)) node.queryChunks.forEach(visit);
    };
    visit(clause);
    return out;
  };
  const rowsFor = (table, clause) => {
    const params = paramValues(clause);
    if (table === revokedSessionsTable) return [];
    if (table === interviewerAccountsTable) {
      return accounts.filter((candidate) => params.includes(candidate.id));
    }
    if (table === chatChannelsTable) {
      return params.includes(privateChannel.id) && params.includes(privateChannel.teamId) ? [privateChannel] : [];
    }
    if (table === chatChannelMembersTable) return [];
    if (table === interviewWhiteboardsTable) {
      return [board, directBoard, channelBoard].filter((candidate) =>
        params.includes(candidate.id) && params.includes(candidate.teamId),
      );
    }
    if (table === assistantSkillsTable) {
      return skillRows.filter((skill) => params.includes(skill.teamId));
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
        orderBy() {
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
          if (table === assistantSkillsTable) {
            const params = paramValues(clause);
            const skill = skillRows.find((row) => params.includes(row.id) && params.includes(row.teamId));
            if (!skill) return Promise.resolve([]);
            Object.assign(skill, values);
            return Promise.resolve([skill]);
          }
          assert.equal(table, interviewWhiteboardsTable);
          assert.ok(paramValues(clause).includes(board.id));
          Object.assign(board, values);
          return Promise.resolve([board]);
        },
        then(resolve, reject) {
          if (table !== interviewWhiteboardsTable) return Promise.resolve().then(resolve, reject);
          assert.ok(paramValues(clause).includes(board.id));
          Object.assign(board, values);
          return Promise.resolve().then(resolve, reject);
        },
      };
      return updateQuery;
    },
    insert(table) {
      let values;
      return {
        values(nextValues) {
          values = nextValues;
          return this;
        },
        returning() {
          assert.equal(table, assistantSkillsTable);
          const duplicate = skillRows.some((row) =>
            row.teamId === values.teamId && row.name.toLowerCase() === values.name.toLowerCase());
          if (duplicate) return Promise.reject(Object.assign(new Error("duplicate skill"), { code: "23505" }));
          const now = new Date();
          const created = { createdAt: now, updatedAt: now, ...values };
          skillRows.push(created);
          return Promise.resolve([created]);
        },
      };
    },
    delete(table) {
      let clause;
      return {
        where(nextClause) {
          clause = nextClause;
          return this;
        },
        returning() {
          assert.equal(table, assistantSkillsTable);
          const params = paramValues(clause);
          const index = skillRows.findIndex((row) => params.includes(row.id) && params.includes(row.teamId));
          if (index < 0) return Promise.resolve([]);
          const [removed] = skillRows.splice(index, 1);
          return Promise.resolve([{ id: removed.id }]);
        },
      };
    },
    async transaction(callback) {
      return callback(this);
    },
  };

  const mockedTables = Object.fromEntries(databaseTableNames.map((name) => [name, {}]));
  mock.module("@workspace/db", {
    namedExports: {
      ...dbMockExports(),
      ...mockedTables,
      db,
      primaryDb: db,
      pool: {},
      primaryPool: {},
      interviewerAccountsTable,
      revokedSessionsTable,
      interviewWhiteboardsTable,
      chatChannelsTable,
      chatChannelMembersTable,
      assistantSkillsTable,
      teamsTable,
      DEFAULT_TEAM_ID,
      normalizeTeamName,
      runWithInstance: (_instance, fn) => fn(),
      currentInstance: () => "primary",
      enterInstance: () => {},
      secondaryDb: () => null,
      secondaryPool: () => null,
      hasSecondary: () => false,
    },
  });
  mock.module("../lib/objectStorage", {
    namedExports: { ObjectStorageService: MockObjectStorageService },
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

    const request = (session, method, path, body) => fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(session ? { authorization: `Bearer ${session}` } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const coordinatorSession = session;
    const interviewerSession = createInterviewerSession(interviewer.id);
    const otherCoordinatorSession = createInterviewerSession(otherCoordinator.id);
    const outsiderCoordinatorSession = createInterviewerSession(outsiderCoordinator.id);

    const taskCardId = patchedBoard.data.cards.find((card) => card.title === "Confirm saved task").id;
    const commentPath = `/boards/${board.id}/cards/${taskCardId}/comments`;
    assert.equal((await request(undefined, "POST", commentPath, { text: "No session" })).status, 401);
    assert.equal((await request(interviewerSession, "POST", commentPath, { text: "Not a coordinator" })).status, 403);
    assert.equal((await request(otherCoordinatorSession, "GET", path)).status, 404, "another team's board remains hidden");
    const directCommentPath = `/boards/${directBoard.id}/cards/unknown-card/comments`;
    assert.equal((await request(outsiderCoordinatorSession, "GET", `/boards/${directBoard.id}`)).status, 404, "direct boards remain limited to their conversation participants");
    assert.equal((await request(outsiderCoordinatorSession, "POST", directCommentPath, { text: "Not a participant" })).status, 404);
    assert.equal((await request(interviewerSession, "GET", `/boards/${channelBoard.id}`)).status, 404, "invite-only channel boards remain hidden from nonmembers");
    const blockedDirectUpload = await fetch(`${baseUrl}/boards/${directBoard.id}/assets?fileName=private.png`, {
      method: "POST",
      headers: { authorization: `Bearer ${outsiderCoordinatorSession}`, "content-type": "image/png" },
      body: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    });
    assert.equal(blockedDirectUpload.status, 404);
    const commentResponse = await request(coordinatorSession, "POST", commentPath, {
      text: "Check the encoder direction before the next run.",
      author: "Forged author",
    });
    assert.equal(commentResponse.status, 201);
    const comment = await commentResponse.json();
    assert.equal(comment.author, "Alex", "comment authors must come from the authenticated session");
    assert.equal(comment.text, "Check the encoder direction before the next run.");
    const afterComment = await (await request(coordinatorSession, "GET", path)).json();
    const commentedCard = afterComment.data.cards.find((card) => card.id === taskCardId);
    assert.equal(commentedCard.comments[0].id, comment.id);
    assert.equal(commentedCard.activity.at(-1).actor, "Alex", "activity actors must come from the authenticated session");
    assert.equal(commentedCard.activity.at(-1).action, "commented");
    const invalidComment = await request(coordinatorSession, "POST", commentPath, { text: " " });
    assert.equal(invalidComment.status, 400);
    const unknownAssetId = "00000000-0000-4000-8000-000000000000";
    assert.equal((await request(undefined, "GET", `/boards/${board.id}/assets/${unknownAssetId}`)).status, 401);
    assert.equal((await request(otherCoordinatorSession, "GET", `/boards/${board.id}/assets/${unknownAssetId}`)).status, 404);
    assert.equal((await request(undefined, "POST", `/boards/${board.id}/assets?fileName=test.png`, {})).status, 401);
    const invalidImage = await fetch(`${baseUrl}/boards/${board.id}/assets?fileName=bad.png`, {
      method: "POST",
      headers: { authorization: `Bearer ${coordinatorSession}`, "content-type": "image/png" },
      body: Buffer.from("not a png"),
    });
    assert.equal(invalidImage.status, 400, "the upload route rejects a mismatched file signature");
    const validImageBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const uploadResponse = await fetch(`${baseUrl}/boards/${board.id}/assets?fileName=odometry-cover.png`, {
      method: "POST",
      headers: { authorization: `Bearer ${coordinatorSession}`, "content-type": "image/png" },
      body: validImageBytes,
    });
    assert.equal(uploadResponse.status, 201);
    const uploadedAsset = await uploadResponse.json();
    assert.equal(uploadedAsset.name, "odometry-cover.png");
    const fileAttachment = { ...uploadedAsset, type: "file" };
    const secondCardResponse = await request(coordinatorSession, "PATCH", path, {
      operation: "create_card",
      card: { title: "Share the same cover", columnId: "backlog" },
    });
    assert.equal(secondCardResponse.status, 200);
    const secondCard = (await secondCardResponse.json()).data.cards.find((card) => card.title === "Share the same cover");

    const attach = (cardId) => request(coordinatorSession, "PATCH", path, {
      operation: "update_card",
      cardId,
      cardPatch: { attachments: [fileAttachment], cover: { type: "image", assetId: uploadedAsset.id } },
    });
    assert.equal((await attach(taskCardId)).status, 200);
    assert.equal((await attach(secondCard.id)).status, 200);
    assert.equal((await request(coordinatorSession, "DELETE", `/boards/${board.id}/assets/${uploadedAsset.id}`)).status, 409);
    const downloadedAsset = await request(coordinatorSession, "GET", `/boards/${board.id}/assets/${uploadedAsset.id}`);
    assert.equal(downloadedAsset.status, 200);
    assert.deepEqual(Buffer.from(await downloadedAsset.arrayBuffer()), validImageBytes);

    const detach = (cardId) => request(coordinatorSession, "PATCH", path, {
      operation: "update_card",
      cardId,
      cardPatch: { attachments: [], cover: null },
    });
    assert.equal((await detach(taskCardId)).status, 200);
    assert.equal(deletedBoardAssetPaths.length, 0, "a file still attached to another card must not be deleted");
    assert.equal((await detach(secondCard.id)).status, 200);
    assert.deepEqual(deletedBoardAssetPaths, [uploadedAsset.objectPath], "the final detach removes the private object");

    assert.equal((await request(undefined, "GET", "/assistant/skills")).status, 401);
    assert.equal((await request(interviewerSession, "GET", "/assistant/skills")).status, 403);

    const listA = await request(coordinatorSession, "GET", "/assistant/skills");
    const listAData = await listA.json();
    assert.deepEqual(listAData.items.map((skill) => skill.id), ["skill-a"]);
    assert.equal(listAData.items[0].githubRepositoryUrl, null, "legacy skills are returned with an empty repository field");
    const listB = await request(otherCoordinatorSession, "GET", "/assistant/skills");
    assert.deepEqual((await listB.json()).items.map((skill) => skill.id), ["skill-b"]);
    assert.equal((await request(coordinatorSession, "GET", "/assistant/skills")).status, 200);

    const invalidAction = await request(coordinatorSession, "POST", "/assistant/skills", {
      name: "Invalid tool",
      description: "Do not allow unapproved tools",
      instructions: "Try a shell.",
      actions: ["shell_exec"],
      enabled: true,
    });
    assert.equal(invalidAction.status, 400);

    const skillInput = {
      name: "Interview summary",
      description: "Summarize applicant evidence after an interview",
      instructions: "Use only confirmed records.",
      actions: ["search_applicants"],
      enabled: true,
    };
    const created = await request(coordinatorSession, "POST", "/assistant/skills", skillInput);
    assert.equal(created.status, 201);
    const createdSkill = await created.json();
    assert.equal(createdSkill.teamId, undefined);
    assert.equal(createdSkill.name, skillInput.name);
    assert.equal(createdSkill.githubRepositoryUrl, null, "skills created by older clients get a null repository URL");
    const invalidRepository = await request(coordinatorSession, "POST", "/assistant/skills", {
      ...skillInput,
      name: "Invalid repository",
      githubRepositoryUrl: "https://github.com.evil.example/org/repo",
    });
    assert.equal(invalidRepository.status, 400);
    const linkedSkillResponse = await request(coordinatorSession, "PATCH", `/assistant/skills/${createdSkill.id}`, {
      githubRepositoryUrl: "https://github.com/example/team-playbook.git/",
    });
    assert.equal(linkedSkillResponse.status, 200);
    const linkedSkill = await linkedSkillResponse.json();
    assert.equal(linkedSkill.githubRepositoryUrl, "https://github.com/example/team-playbook");
    const teamList = await request(coordinatorSession, "GET", "/assistant/skills");
    const teamSkills = (await teamList.json()).items;
    assert.equal(teamSkills.find((skill) => skill.id === createdSkill.id)?.githubRepositoryUrl, "https://github.com/example/team-playbook");
    const otherTeamSkills = (await (await request(otherCoordinatorSession, "GET", "/assistant/skills")).json()).items;
    assert.ok(otherTeamSkills.every((skill) => skill.id !== createdSkill.id), "repository links stay inside the owning team");
    const duplicate = await request(coordinatorSession, "POST", "/assistant/skills", {
      ...skillInput,
      name: "INTERVIEW SUMMARY",
    });
    assert.equal(duplicate.status, 409);
    const sameNameOtherTeam = await request(otherCoordinatorSession, "POST", "/assistant/skills", skillInput);
    assert.equal(sameNameOtherTeam.status, 201);

    const emptyPatch = await request(coordinatorSession, "PATCH", "/assistant/skills/skill-a", {});
    assert.equal(emptyPatch.status, 400);
    const invalidUpdateAction = await request(coordinatorSession, "PATCH", "/assistant/skills/skill-a", {
      actions: ["shell_exec"],
    });
    assert.equal(invalidUpdateAction.status, 400);
    const invalidRepositoryUpdate = await request(coordinatorSession, "PATCH", "/assistant/skills/skill-a", {
      githubRepositoryUrl: "https://example.com/repo",
    });
    assert.equal(invalidRepositoryUpdate.status, 400);
    const crossTeamPatch = await request(coordinatorSession, "PATCH", "/assistant/skills/skill-b", { enabled: false });
    assert.equal(crossTeamPatch.status, 404);
    const crossTeamDelete = await request(coordinatorSession, "DELETE", "/assistant/skills/skill-b");
    assert.equal(crossTeamDelete.status, 404);
    const updated = await request(coordinatorSession, "PATCH", `/assistant/skills/${createdSkill.id}`, { enabled: false });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).enabled, false);
    const clearedRepository = await request(coordinatorSession, "PATCH", `/assistant/skills/${createdSkill.id}`, { githubRepositoryUrl: null });
    assert.equal(clearedRepository.status, 200);
    assert.equal((await clearedRepository.json()).githubRepositoryUrl, null);
    const deleted = await request(coordinatorSession, "DELETE", `/assistant/skills/${createdSkill.id}`);
    assert.equal(deleted.status, 204);
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
});
