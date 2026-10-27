import assert from "node:assert/strict";
import test from "node:test";
import { activeRosterCountsByTeam } from "./siteStats.ts";

test("site stats count configured roster members, not historical account rows", () => {
  const counts = activeRosterCountsByTeam([
    { teamId: null, interviewerLabels: JSON.stringify(Array.from({ length: 12 }, (_, i) => `member ${i}`)) },
  ]);

  assert.equal(counts.get("default"), 12);
});

test("site stats normalize legacy default team IDs and prefer primary roster rows", () => {
  const counts = activeRosterCountsByTeam(
    [{ teamId: null, interviewerLabels: '["A","B","C"]' }],
    [{ teamId: "default", interviewerLabels: '["X","Y"]' }],
  );

  assert.equal(counts.get("default"), 3);
});

test("site stats use the same fallback roster size as interview settings", () => {
  const counts = activeRosterCountsByTeam([
    { teamId: "team-empty", interviewerLabels: "[]" },
    { teamId: "team-invalid", interviewerLabels: "not json" },
  ]);

  assert.equal(counts.get("team-empty"), 2);
  assert.equal(counts.get("team-invalid"), 2);
});
