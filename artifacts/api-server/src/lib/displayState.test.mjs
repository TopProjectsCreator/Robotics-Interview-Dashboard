import assert from "node:assert/strict";
import { once } from "node:events";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

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

const tableNames = [
  "applicantsTable",
  "assistantConversationsTable",
  "assistantMessagesTable",
  "broadcastAcksTable",
  "broadcastsTable",
  "chatCustomEmojisTable",
  "chatMessageReadsTable",
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
  "interviewWhiteboardsTable",
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
  "scheduledChatMessagesTable",
];

test("public display state scopes by event code and exposes only approved fields", async (t) => {
  const team = { id: "team-matching-event-code", name: "Stored Team Name" };
  const visibleApplicant = {
    id: "public-applicant-id",
    name: "Visible Applicant",
    grade: "7th",
    lane: "Interviewer A",
    email: "private@example.test",
    transcript: "private interview transcript",
    notes: "private interviewer notes",
    accountId: "private-account-id",
  };
  const view = {
    mode: "queue",
    headline: "Welcome",
    subheadline: "Please wait",
    announcement: "Visible Applicant, please go to Interviewer A",
    currentApplicants: [visibleApplicant],
    updatedAt: "2026-10-17T12:00:00.000Z",
  };
  const queriedTeams = [];
  const displayedTeams = [];
  const settings = { announce: true, showNames: true };

  const database = Object.fromEntries(tableNames.map((name) => [name, {}]));
  Object.assign(database, {
    db: {},
    pool: {},
    primaryDb: {},
    primaryPool: {},
    secondaryDb: () => null,
    secondaryPool: () => null,
    hasSecondary: () => false,
    currentInstance: () => "primary",
    runWithInstance: (_instance, callback) => callback(),
    enterInstance: () => {},
    DEFAULT_TEAM_ID: "default",
    codeFilesTable: {},
    teamsTable: {},
    interviewerAccountsTable: {},
    revokedSessionsTable: {},
    normalizeTeamName: (name) => name.toLowerCase(),
  });
  mock.module("@workspace/db", { namedExports: database });

  const dataNames = [
    "applicantResponse", "assignSeat", "csvToApplicant", "displaySettingsResponse",
    "ensureDemoData", "getApplicants", "getInterviewSettings", "getQueueState",
    "getSeatingSettings", "seatingSettingsResponse", "normalizeAiScore", "importDiff",
    "parseSemicolonCsv", "queueApplicantResponse", "transferInterviewers",
  ];
  mock.module("../lib/roboticsData", {
    namedExports: {
      ...Object.fromEntries(dataNames.map((name) => [name, () => {}])),
      getDisplayView: async (teamId) => {
        displayedTeams.push(teamId);
        return view;
      },
      getDisplaySettings: async () => settings,
    },
  });
  mock.module("../lib/httpCache", {
    namedExports: {
      applicantVersion: async (teamId) => `applicants:${teamId}`,
      queueVersion: async (teamId) => `queue:${teamId}`,
      displaySettingsVersion: async (teamId) => `settings:${teamId}`,
      notModified: async () => false,
      sendVersioned: async () => {},
    },
  });
  mock.module("../lib/teams", {
    namedExports: {
      findTeamByCode: async (code) => {
        queriedTeams.push(code);
        return code === "EVENT-123" ? team : null;
      },
      getTeamById: async () => team,
      teamFilter: () => ({}),
      teamSqlCondition: () => "",
      findAccountAnywhere: async () => null,
    },
  });
  t.after(() => mock.restoreAll());

  const [{ default: express }, { default: roboticsRouter }] = await Promise.all([
    import("express"),
    import("../routes/robotics.ts"),
  ]);
  const app = express();
  app.use("/api", roboticsRouter);
  const server = app.listen(0, "127.0.0.1");

  try {
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const url = `http://127.0.0.1:${address.port}/api/display/state?eventPassword=EVENT-123`;

    const visibleResponse = await fetch(url);
    assert.equal(visibleResponse.status, 200);
    const visibleState = await visibleResponse.json();
    assert.deepEqual(Object.keys(visibleState).sort(), [
      "announce",
      "announcement",
      "currentApplicants",
      "headline",
      "mode",
      "subheadline",
      "teamName",
      "updatedAt",
    ]);
    assert.equal(visibleState.teamName, "Stored Team Name");
    assert.deepEqual(visibleState.currentApplicants, [{
      id: "public-applicant-id",
      name: "Visible Applicant",
      grade: "7th",
      lane: "Interviewer A",
    }]);
    assert.deepEqual(Object.keys(visibleState.currentApplicants[0]).sort(), ["grade", "id", "lane", "name"]);
    assert.equal(JSON.stringify(visibleState).includes("private@example.test"), false);
    assert.equal(JSON.stringify(visibleState).includes("private interview transcript"), false);
    assert.equal(JSON.stringify(visibleState).includes("private interviewer notes"), false);
    assert.deepEqual(queriedTeams, ["EVENT-123"]);
    assert.deepEqual(displayedTeams, [team.id]);

    settings.showNames = false;
    const hiddenResponse = await fetch(url);
    assert.equal(hiddenResponse.status, 200);
    const hiddenState = await hiddenResponse.json();
    assert.deepEqual(hiddenState.currentApplicants, []);
    assert.equal(hiddenState.teamName, team.name);

    const invalidResponse = await fetch(
      `http://127.0.0.1:${address.port}/api/display/state?eventPassword=NOT-A-TEAM`,
    );
    assert.equal(invalidResponse.status, 404);
    assert.deepEqual(await invalidResponse.json(), { error: "Invalid team access code." });
    assert.deepEqual(queriedTeams, ["EVENT-123", "EVENT-123", "NOT-A-TEAM"]);
    assert.deepEqual(displayedTeams, [team.id, team.id], "invalid codes must not load display data");
  } finally {
    if (server.listening) await new Promise((resolve) => server.close(resolve));
  }
});
