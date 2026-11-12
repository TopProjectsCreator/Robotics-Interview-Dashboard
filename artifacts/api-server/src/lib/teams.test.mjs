import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { scryptSync } from "node:crypto";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !/\.(?:ts|js|mjs|json)$/.test(specifier)) {
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

test("team code lookups and duplicate checks ignore letter casing", async (t) => {
  const { teamsTable, DEFAULT_TEAM_ID, normalizeTeamName } = await import("../../../../lib/db/src/schema/teams.ts");
  let teamRows = [];
  const database = {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => teamRows.filter((team) => team.id === DEFAULT_TEAM_ID).slice(0, 1),
              };
            },
            then(resolve, reject) {
              return Promise.resolve(teamRows).then(resolve, reject);
            },
          };
        },
      };
    },
  };

  mock.module("@workspace/db", {
    namedExports: {
      primaryDb: database,
      secondaryDb: () => null,
      teamsTable,
      interviewerAccountsTable: {},
      DEFAULT_TEAM_ID,
      normalizeTeamName,
      hasSecondary: () => false,
    },
  });

  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  process.env.ADMIN_PASSWORD = "Legacy-Mixed-Code";
  t.after(() => {
    mock.restoreAll();
    if (originalAdminPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalAdminPassword;
  });

  const { findTeamByCode, hashTeamCode, hasTeamCode, teamCodesMatch, verifyTeamCodeHash } =
    await import("./teams.ts");
  const team = {
    id: "team-1",
    name: "Team One",
    normalizedName: "team one",
    codeHash: hashTeamCode("Spark-4281"),
  };
  const legacyCode = "MiXeD-Legacy-42";
  const legacySalt = Buffer.from("legacy-team-code-salt");
  const legacyTeam = {
    id: "team-legacy",
    name: "Legacy Team",
    normalizedName: "legacy team",
    codeHash: `${legacySalt.toString("hex")}:${scryptSync(legacyCode, legacySalt, 64).toString("hex")}`,
  };
  const defaultTeam = {
    id: DEFAULT_TEAM_ID,
    name: "Wolverines",
    normalizedName: "wolverines",
    codeHash: hashTeamCode("different-default-code"),
  };
  teamRows = [team, legacyTeam, defaultTeam];

  for (const code of ["SPARK-4281", "spark-4281", "sPaRk-4281"]) {
    assert.equal(verifyTeamCodeHash(code, team.codeHash), true);
    assert.equal((await findTeamByCode(code))?.id, team.id);
  }
  assert.equal(verifyTeamCodeHash("SPARK-4282", team.codeHash), false);
  assert.equal(await findTeamByCode("SPARK-4282"), null);
  assert.equal(verifyTeamCodeHash(legacyCode, legacyTeam.codeHash), true);
  assert.equal((await findTeamByCode(legacyCode))?.id, legacyTeam.id);

  assert.equal(hasTeamCode("sPaRk-4281", [team, defaultTeam]), true);
  assert.equal(hasTeamCode("SPARK-9999", [team, defaultTeam]), false);
  assert.equal(teamCodesMatch("Legacy-Mixed-Code", "legacy-mixed-code"), true);
  assert.equal(teamCodesMatch("Legacy-Mixed-Code", "legacy-other-code"), false);
  assert.equal((await findTeamByCode("lEgAcY-mIxEd-CoDe"))?.id, DEFAULT_TEAM_ID);
});
