import assert from "node:assert/strict";
import test from "node:test";
import { buildProductivityHistory } from "./chatProductivityHistory.ts";

const breakdown = {
  projectProgress: 6,
  planningCoordination: 7,
  focusDiscipline: 5,
};

test("legacy empty or invalid periods do not affect history or its aggregates", () => {
  const rows = [
    {
      score: 9,
      summary: "Valid assessment",
      breakdown,
      periodStart: new Date("2026-11-10T19:30:00.000Z"),
      periodEnd: new Date("2026-11-10T20:00:00.000Z"),
      createdAt: new Date("2026-11-10T20:00:00.000Z"),
    },
    {
      score: 0,
      summary: "Legacy empty assessment",
      breakdown,
      periodStart: null,
      periodEnd: null,
      createdAt: new Date("2026-11-10T20:01:00.000Z"),
    },
    {
      score: 2,
      summary: "Incomplete period",
      breakdown,
      periodStart: new Date("2026-11-10T20:00:00.000Z"),
      periodEnd: null,
      createdAt: new Date("2026-11-10T20:02:00.000Z"),
    },
    {
      score: 1,
      summary: "Reversed period",
      breakdown,
      periodStart: new Date("2026-11-10T20:00:00.000Z"),
      periodEnd: new Date("2026-11-10T19:30:00.000Z"),
      createdAt: new Date("2026-11-10T20:03:00.000Z"),
    },
  ];

  assert.deepEqual(
    buildProductivityHistory(rows, "30d", 0, 1),
    {
      range: "30d",
      reviewCount: 1,
      truncated: false,
      points: [{
        score: 9,
        summary: "Valid assessment",
        breakdown,
        periodStart: new Date("2026-11-10T19:30:00.000Z"),
        periodEnd: new Date("2026-11-10T20:00:00.000Z"),
        createdAt: new Date("2026-11-10T20:00:00.000Z"),
      }],
      daily: [{
        date: "2026-11-10",
        averageScore: 9,
        maxScore: 9,
        reviewCount: 1,
      }],
    },
  );
});

test("invalid legacy rows are removed before trend truncation", () => {
  const row = (score, periodStart, periodEnd, minute) => ({
    score,
    summary: `Review ${score}`,
    breakdown,
    periodStart,
    periodEnd,
    createdAt: new Date(`2026-11-10T20:${String(minute).padStart(2, "0")}:00.000Z`),
  });
  const history = buildProductivityHistory([
    row(3, new Date("2026-11-10T19:30:00.000Z"), new Date("2026-11-10T20:00:00.000Z"), 0),
    row(0, null, null, 1),
    row(8, new Date("2026-11-10T20:00:00.000Z"), new Date("2026-11-10T20:30:00.000Z"), 2),
  ], "30d", 0, 1);

  assert.equal(history.reviewCount, 2);
  assert.equal(history.truncated, true);
  assert.deepEqual(history.points.map((point) => point.score), [8]);
  assert.deepEqual(history.daily.map((day) => day.reviewCount), [2]);
});
