import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateTeamNameRules } from "./nameRules.ts";
import { UpdateTeamNameRulesBody } from "../../../../lib/api-zod/src/generated/api.ts";

test("name rules match case-insensitively using each supported choice", () => {
  const cases = [
    [{ matchType: "contains", text: "bad" }, "Jo Badger", /containing/i],
    [{ matchType: "startsWith", text: "robot" }, "ROBOT Riley", /starting with/i],
    [{ matchType: "endsWith", text: "bot" }, "Riley BOT", /ending with/i],
    [{ matchType: "exact", text: "riley bot" }, "RILEY BOT", /isn't allowed/i],
  ];

  for (const [rule, name, message] of cases) {
    const result = validateTeamNameRules(name, [rule]);
    assert.match(result, message);
    assert.match(result, /choose a different name/i);
  }
});

test("name rules do not reject non-matching names", () => {
  assert.equal(validateTeamNameRules("Sam Riley", [
    { matchType: "contains", text: "bad" },
    { matchType: "startsWith", text: "robot" },
    { matchType: "endsWith", text: "bot" },
    { matchType: "exact", text: "sam" },
  ]), null);
});

test("matching ignores repeated and leading/trailing spaces", () => {
  assert.match(
    validateTeamNameRules("  Riley   Robot ", [{ matchType: "exact", text: "riley robot" }]),
    /isn't allowed/i,
  );
});

test("a team's rules do not affect a different team's rule set", () => {
  const teamARules = [{ matchType: "contains", text: "robot" }];
  const teamBRules = [{ matchType: "exact", text: "Sam" }];

  assert.ok(validateTeamNameRules("Robot Riley", teamARules));
  assert.equal(validateTeamNameRules("Robot Riley", teamBRules), null);
});

test("generated API schema accepts only supported match types and bounded rules", () => {
  assert.equal(UpdateTeamNameRulesBody.safeParse({ rules: [] }).success, true);
  assert.equal(UpdateTeamNameRulesBody.safeParse({
    rules: [{ matchType: "contains", text: "blocked" }],
  }).success, true);
  assert.equal(UpdateTeamNameRulesBody.safeParse({
    rules: [{ matchType: "regex", text: "blocked" }],
  }).success, false);
  assert.equal(UpdateTeamNameRulesBody.safeParse({
    rules: [{ matchType: "exact", text: "x".repeat(41) }],
  }).success, false);
  assert.equal(UpdateTeamNameRulesBody.safeParse({
    rules: Array.from({ length: 51 }, () => ({ matchType: "contains", text: "x" })),
  }).success, false);
});

test("API routes protect rule access and apply the signed-in team's rules at both naming boundaries", async () => {
  const source = await readFile(new URL("../routes/auth.ts", import.meta.url), "utf8");
  assert.ok(source.includes('router.get("/auth/name-rules", requireCoordinator'));
  assert.ok(source.includes('router.put("/auth/name-rules", requireCoordinator'));
  assert.ok(source.includes("where(eq(teamNameRulesTable.teamId, teamId))"));
  assert.ok(source.includes(".values({ teamId, rules })"));
  assert.ok(source.includes("target: teamNameRulesTable.teamId"));
  assert.ok(source.includes("where(eq(teamNameRulesTable.teamId, team.id))"));
  assert.ok(source.includes("where(eq(teamNameRulesTable.teamId, ownTeam))"));
  assert.equal(source.match(/validateTeamNameRules\(displayName, nameRulesRecord\?\.rules \?\? \[\]\)/g)?.length, 2);
});
