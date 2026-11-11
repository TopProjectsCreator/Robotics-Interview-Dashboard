import assert from "node:assert/strict";
import test from "node:test";
import {
  buildProductivityInput,
  noActivityAssessment,
  parseProductivityResults,
} from "./chatProductivityAnalysis.ts";

const validAssessment = {
  score: 6,
  summary: "The team coordinated next steps and made some project progress.",
  activities: [{ activity: "Reviewed the drivetrain plan", assessment: "productive" }],
  breakdown: {
    projectProgress: 6,
    planningCoordination: 8,
    focusDiscipline: 5,
  },
};

test("builds one payload with separate keys and excludes authors", () => {
  const { payload, includedMessages } = buildProductivityInput([
    {
      scope: "shared",
      key: "team",
      name: "Team conversation",
      messages: [{
        message: "We finished the wheel mount.",
        createdAt: "2026-11-10T20:00:00.000Z",
        author: "Private author name",
      }],
    },
    {
      scope: "channel",
      key: "drive-team",
      name: "Drive team",
      messages: [{
        message: "The motor test passed.",
        createdAt: "2026-11-10T20:01:00.000Z",
        author: "Another private author",
      }],
    },
  ], 20_000);

  assert.deepEqual(Object.keys(payload.channels).sort(), ["drive-team", "team"]);
  assert.equal(payload.channels.team.messages[0]?.text, "We finished the wheel mount.");
  assert.equal(payload.channels["drive-team"].messages[0]?.text, "The motor test passed.");
  assert.equal(JSON.stringify(payload).includes("Private author"), false);
  assert.equal(includedMessages.get("team")?.length, 1);
});

test("round-robins the newest message from each conversation within the input budget", () => {
  const conversations = [
    {
      scope: "shared",
      key: "team",
      name: "Team",
      messages: [
        { message: "new team update", createdAt: "2026-11-10T20:02:00.000Z" },
        { message: "older team update", createdAt: "2026-11-10T19:00:00.000Z" },
      ],
    },
    {
      scope: "channel",
      key: "build",
      name: "Build",
      messages: [
        { message: "new build update", createdAt: "2026-11-10T20:01:00.000Z" },
        { message: "older build update", createdAt: "2026-11-10T18:00:00.000Z" },
      ],
    },
  ];
  const basePayload = {
    channels: {
      team: { name: "Team", messages: [] },
      build: { name: "Build", messages: [] },
    },
  };
  const firstRoundBytes = [
    { at: "2026-11-10T20:02:00.000Z", text: "new team update" },
    { at: "2026-11-10T20:01:00.000Z", text: "new build update" },
  ].reduce((total, message) => total + Buffer.byteLength(JSON.stringify(message)) + 1, 0);
  const budget = Buffer.byteLength(JSON.stringify(basePayload)) + firstRoundBytes + 4;

  const { payload } = buildProductivityInput(conversations, budget);
  assert.equal(payload.channels.team.messages[0]?.text, "new team update");
  assert.equal(payload.channels.build.messages[0]?.text, "new build update");
  assert.equal(payload.channels.team.messages.length, 1);
  assert.equal(payload.channels.build.messages.length, 1);
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= budget);
});

test("requires exactly one valid JSON assessment for every conversation key", () => {
  const response = JSON.stringify({ team: validAssessment, build: validAssessment });
  const result = parseProductivityResults(response, ["team", "build"]);
  assert.equal(result.team.score, 6);
  assert.equal(result.build.breakdown.planningCoordination, 8);

  assert.throws(
    () => parseProductivityResults(JSON.stringify({ team: validAssessment }), ["team", "build"]),
    /every shared conversation/,
  );
  assert.throws(
    () => parseProductivityResults("{not-json", ["team"]),
    /valid JSON/,
  );
});

test("represents an empty history as no recorded progress rather than an inferred score", () => {
  assert.deepEqual(noActivityAssessment(), {
    score: 0,
    summary: "No chat activity was available for this review.",
    activities: [{ activity: "No recorded progress", assessment: "no_recorded_progress" }],
    breakdown: { projectProgress: 0, planningCoordination: 0, focusDiscipline: 0 },
  });
});
