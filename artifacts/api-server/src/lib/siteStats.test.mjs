import assert from "node:assert/strict";
import test from "node:test";
import { deduplicateSiteStatsAccounts } from "./siteStats.ts";

test("site stats deduplicate team accounts shared across database instances", () => {
  const primaryAccounts = [
    { id: "primary-1", teamId: "default", normalizedName: "alex chen" },
    { id: "primary-2", teamId: null, normalizedName: "jordan lee" },
  ];
  const secondaryAccounts = [
    { id: "secondary-1", teamId: "default", normalizedName: " Alex   Chen " },
    { id: "secondary-2", teamId: null, normalizedName: "JORDAN LEE" },
    { id: "secondary-legacy", teamId: null, normalizedName: "legacy account" },
    { id: "secondary-3", teamId: "team-b", normalizedName: "alex chen" },
  ];

  assert.deepEqual(
    deduplicateSiteStatsAccounts(primaryAccounts, secondaryAccounts).map((account) => account.id),
    ["primary-1", "primary-2", "secondary-3"],
  );
});
