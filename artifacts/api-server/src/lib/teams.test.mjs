import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { scrypt, scryptSync } from "node:crypto";

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
  let fullScans = 0;
  let candidateReads = 0;
  let derivations = 0;
  let secondary = false;
  let unavailable = false;
  const database = {
    select() {
      if (unavailable) throw Object.assign(new Error("test database unavailable"), { code: "ECONNREFUSED" });
      return {
        from() {
          return {
            where(condition) {
              candidateReads += 1;
              return {
                limit: async () => teamRows.filter((team) => team.id === condition.value).slice(0, 1),
              };
            },
            then(resolve, reject) {
              fullScans += 1;
              return Promise.resolve(teamRows).then(resolve, reject);
            },
          };
        },
      };
    },
  };

  mock.module("./asyncScrypt", {
    namedExports: {
      deriveSecret: async (value, salt) => {
        derivations += 1;
        return new Promise((resolve, reject) => {
          scrypt(value, salt, 64, (error, key) => error ? reject(error) : resolve(key));
        });
      },
    },
  });
  mock.module("drizzle-orm", {
    namedExports: {
      eq: (field, value) => ({ field, value }),
      isNull: (field) => ({ field }),
      or: (...conditions) => ({ conditions }),
    },
  });
  mock.module("@workspace/db", {
    namedExports: {
      primaryDb: database,
      secondaryDb: () => database,
      teamsTable,
      interviewerAccountsTable: {},
      DEFAULT_TEAM_ID,
      normalizeTeamName,
      hasSecondary: () => secondary,
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
    codeHash: await hashTeamCode("Spark-4281"),
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
    codeHash: await hashTeamCode("different-default-code"),
  };
  teamRows = [team, legacyTeam, defaultTeam];

  for (const code of ["SPARK-4281", "spark-4281", "sPaRk-4281"]) {
    assert.equal(await verifyTeamCodeHash(code, team.codeHash), true);
    assert.equal((await findTeamByCode(code))?.id, team.id);
  }
  const scansAfterWarmup = fullScans;
  const readsAfterWarmup = candidateReads;
  const derivationsAfterWarmup = derivations;
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await findTeamByCode("SPARK-4281"))?.id, team.id);
  }
  assert.equal(fullScans, scansAfterWarmup, "warm public polls must not scan all teams");
  assert.equal(candidateReads - readsAfterWarmup, 5, "each poll still checks the current team hash");
  assert.equal(derivations, derivationsAfterWarmup, "warm polls must not derive any hashes");
  unavailable = true;
  await assert.rejects(findTeamByCode("SPARK-4281"), /database unavailable/);
  unavailable = false;
  const now = Date.now();
  const clock = t.mock.method(Date, "now", () => now + 6 * 60_000);
  assert.equal((await findTeamByCode("SPARK-4281"))?.id, team.id);
  assert.equal(fullScans, scansAfterWarmup + 1, "expired candidates must be verified again");
  assert.ok(derivations > derivationsAfterWarmup);
  clock.mock.restore();
  team.name = "Renamed Team";
  assert.equal((await findTeamByCode("SPARK-4281"))?.name, "Renamed Team");
  // Even another process's code rotation invalidates a warm candidate.
  team.codeHash = await hashTeamCode("Rotated-Team-Code");
  assert.equal(await findTeamByCode("SPARK-4281"), null);
  assert.equal((await findTeamByCode("Rotated-Team-Code"))?.id, team.id);
  teamRows = [legacyTeam, defaultTeam];
  assert.equal(await findTeamByCode("Rotated-Team-Code"), null, "deleted teams invalidate candidates");
  teamRows = [team, legacyTeam, defaultTeam];
  team.codeHash = await hashTeamCode("Spark-4281");

  assert.equal(await verifyTeamCodeHash("SPARK-4282", team.codeHash), false);
  assert.equal(await findTeamByCode("SPARK-4282"), null);
  assert.equal(await verifyTeamCodeHash(legacyCode, legacyTeam.codeHash), true);
  assert.equal((await findTeamByCode(legacyCode))?.id, legacyTeam.id);
  assert.equal(await findTeamByCode(legacyCode.toLowerCase()), null, "a warm cache must not widen legacy casing");

  assert.equal(await hasTeamCode("sPaRk-4281", [team, defaultTeam]), true);
  assert.equal(await hasTeamCode("SPARK-9999", [team, defaultTeam]), false);
  assert.equal(teamCodesMatch("Legacy-Mixed-Code", "legacy-mixed-code"), true);
  assert.equal(teamCodesMatch("Legacy-Mixed-Code", "legacy-other-code"), false);
  // Once the default team has an explicit code hash, the legacy fallback must
  // not continue accepting ADMIN_PASSWORD behind that configured code.
  assert.equal(await findTeamByCode("lEgAcY-mIxEd-CoDe"), null);
  assert.equal((await findTeamByCode("different-default-code"))?.id, DEFAULT_TEAM_ID);

  // An identical hash in another database is still a different candidate.
  assert.equal((await findTeamByCode("spark-4281"))?.instance, "primary");
  secondary = true;
  teamRows = [{ ...team, id: "secondary-team" }];
  assert.equal((await findTeamByCode("spark-4281"))?.id, "secondary-team");
  assert.equal((await findTeamByCode("spark-4281"))?.instance, "secondary");
  secondary = false;

  // The legacy password remains a fallback when the default team row has not
  // yet been created on a pre-migration database.
  teamRows = [team];
  assert.equal((await findTeamByCode("lEgAcY-mIxEd-CoDe"))?.id, DEFAULT_TEAM_ID);
});
