import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import * as apiZod from "../../../../lib/api-zod/src/generated/api.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.(?:ts|js|mjs|json)$/.test(specifier)) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const assessmentsTable = {
  id: "assessments.id",
  teamId: "assessments.teamId",
  createdAt: "assessments.createdAt",
};
const assignmentsTable = {
  teamId: "assignments.teamId",
  assessmentId: "assignments.assessmentId",
};
const submissionsTable = {
  teamId: "submissions.teamId",
  assessmentId: "submissions.assessmentId",
};
const interviewerAccountsTable = { id: "accounts.id", displayName: "accounts.displayName" };
const assessmentRows = [
  {
    id: "team-a-assessment",
    teamId: "team-a",
    title: "Team A assessment",
    description: "",
    kind: "quiz",
    status: "draft",
    required: true,
    stylePreset: "robotics",
    questions: [{ id: "q-a", type: "single_choice", prompt: "Choose", required: true, options: ["One", "Two"], correctAnswers: ["One"] }],
    createdBy: "coordinator-a",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  {
    id: "team-b-assessment",
    teamId: "team-b",
    title: "Team B assessment",
    description: "",
    kind: "survey",
    status: "draft",
    required: true,
    stylePreset: "ocean",
    questions: [{ id: "q-b", type: "long_answer", prompt: "Explain", required: true }],
    createdBy: "coordinator-b",
    createdAt: new Date("2026-01-02T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  },
];
const assignmentRows = [{ teamId: "team-a", assessmentId: "team-a-assessment" }];
const submissionRows = [{ teamId: "team-a", assessmentId: "team-a-assessment" }];
const queryCounts = { reconciliation: 0 };
let insertError = null;

function conditionsForTeam(condition) {
  if (!condition) return [];
  if (Array.isArray(condition.conditions)) return condition.conditions.flatMap(conditionsForTeam);
  return [condition];
}

function rowsFor(table) {
  if (table === assessmentsTable) return assessmentRows;
  if (table === assignmentsTable) return assignmentRows;
  if (table === submissionsTable) return submissionRows;
  return [];
}

const db = {
  execute: async () => {
    queryCounts.reconciliation += 1;
    throw new Error("List reads must not reconcile assignments");
  },
  select(selection) {
    return {
      from(table) {
        let rows = rowsFor(table);
        const query = {
          where(condition) {
            const team = conditionsForTeam(condition).find(({ field }) => field === table.teamId)?.value;
            if (team !== undefined) rows = rows.filter((row) => row.teamId === team);
            return query;
          },
          orderBy() {
            rows = [...rows].sort((left, right) => left.createdAt - right.createdAt);
            return query;
          },
          groupBy() {
            const counts = new Map();
            for (const row of rows) counts.set(row.assessmentId, (counts.get(row.assessmentId) ?? 0) + 1);
            return Promise.resolve([...counts].map(([assessmentId, count]) => ({ assessmentId, count })));
          },
          then(resolve, reject) {
            return Promise.resolve(rows).then(resolve, reject);
          },
        };
        return query;
      },
    };
  },
  insert(table) {
    return {
      values(values) {
        return {
          returning: async () => {
            if (table !== assessmentsTable) return [];
            if (insertError) throw insertError;
            const now = new Date();
            const row = {
              ...values,
              createdAt: now,
              updatedAt: now,
            };
            assessmentRows.push(row);
            return [row];
          },
        };
      },
    };
  },
};

mock.module("drizzle-orm", {
  namedExports: {
    and: (...conditions) => ({ conditions }),
    asc: (field) => ({ field }),
    count: () => ({ count: true }),
    eq: (field, value) => ({ field, value }),
    notExists: (query) => ({ notExists: query }),
    sql: (strings, ...values) => ({ strings, values }),
  },
});
mock.module("@workspace/db", {
  namedExports: {
    db,
    interviewerAccountsTable,
    teamAssessmentAssignmentsTable: assignmentsTable,
    teamAssessmentsTable: assessmentsTable,
    teamAssessmentSubmissionsTable: submissionsTable,
    DEFAULT_TEAM_ID: "default",
  },
});
mock.module("@workspace/api-zod", { namedExports: { ...apiZod } });
mock.module("../lib/teams", {
  namedExports: {
    teamFilter: (field, teamId) => ({ field, value: teamId }),
  },
});
mock.module("../lib/objectStorage", {
  namedExports: { ObjectStorageService: class ObjectStorageService {} },
});
mock.module("../lib/teamAssessmentRules", {
  namedExports: {
    TEAM_ASSESSMENT_MAX_FILE_BYTES: 5 * 1024 * 1024,
    TEAM_ASSESSMENT_MAX_TOTAL_FILE_BYTES: 10 * 1024 * 1024,
    validateTeamAssessmentAnswers: () => ({ score: null, maxScore: null, files: [] }),
    validateTeamAssessmentQuestions: () => undefined,
  },
});
mock.module("../middlewares/adminAuth", {
  namedExports: {
    authenticatedInterviewerId: (req) => req.coordinator?.interviewerId,
    requestTeamId: async (req) => req.coordinator?.teamId ?? "default",
    requireAdmin: (_req, _res, next) => next(),
    requireCoordinator: (req, res, next) => {
      const coordinator = {
        "session-a": { interviewerId: "coordinator-a", teamId: "team-a" },
        "session-b": { interviewerId: "coordinator-b", teamId: "team-b" },
        "session-empty": { interviewerId: "coordinator-empty", teamId: "team-empty" },
      }[req.get("x-test-session")];
      if (!coordinator) {
        res.status(401).json({ error: "Authentication required" });
        return;
      }
      req.coordinator = coordinator;
      next();
    },
  },
});

const [{ default: express }, { default: teamAssessmentsRouter }] = await Promise.all([
  import("express"),
  import("../routes/teamAssessments.ts"),
]);

const app = express();
app.use(express.json(), teamAssessmentsRouter);
app.use((error, _req, res, _next) => res.status(500).json({ error: error.message }));
const server = app.listen(0);
await new Promise((resolve) => server.once("listening", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
test.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

test("coordinator assessment lists return only their team's records without reconciliation", async () => {
  const response = await fetch(`${origin}/team-assessments`, {
    headers: { "x-test-session": "session-a" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).items.map(({ id }) => id), ["team-a-assessment"]);
  assert.equal(queryCounts.reconciliation, 0);

  const emptyResponse = await fetch(`${origin}/team-assessments`, {
    headers: { "x-test-session": "session-empty" },
  });
  assert.equal(emptyResponse.status, 200);
  assert.deepEqual((await emptyResponse.json()).items, []);

  const teamBResponse = await fetch(`${origin}/team-assessments`, {
    headers: { "x-test-session": "session-b" },
  });
  assert.deepEqual((await teamBResponse.json()).items.map(({ id }) => id), ["team-b-assessment"]);
});

test("draft creation stores the assessment under the signed-in coordinator's team", async () => {
  const response = await fetch(`${origin}/team-assessments`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-test-session": "session-a",
    },
    body: JSON.stringify({
      title: "Team A draft",
      description: "",
      kind: "quiz",
      required: true,
      stylePreset: "robotics",
      questions: [{ id: "new-question", type: "single_choice", prompt: "Choose", required: true, options: ["One", "Two"], correctAnswers: ["One"] }],
    }),
  });
  const created = await response.json();

  assert.equal(response.status, 201);
  assert.equal(created.title, "Team A draft");
  assert.equal(assessmentRows.find((row) => row.id === created.id)?.teamId, "team-a");
  const otherTeamResponse = await fetch(`${origin}/team-assessments`, {
    headers: { "x-test-session": "session-b" },
  });
  assert.deepEqual((await otherTeamResponse.json()).items.map(({ id }) => id), ["team-b-assessment"]);
});

test("draft creation failures return an error response instead of waiting", async () => {
  insertError = new Error("Assessment storage is temporarily unavailable.");
  try {
    const response = await fetch(`${origin}/team-assessments`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-test-session": "session-a",
      },
      body: JSON.stringify({
        title: "Team A draft",
        description: "",
        kind: "quiz",
        required: true,
        stylePreset: "robotics",
        questions: [{ id: "new-question", type: "single_choice", prompt: "Choose", required: true, options: ["One", "Two"], correctAnswers: ["One"] }],
      }),
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Assessment storage is temporarily unavailable." });
  } finally {
    insertError = null;
  }
});
