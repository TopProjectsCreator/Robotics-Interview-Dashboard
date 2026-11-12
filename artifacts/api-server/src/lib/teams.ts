import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { eq, isNull, or } from "drizzle-orm";
import { primaryDb, secondaryDb, teamsTable, interviewerAccountsTable, DEFAULT_TEAM_ID, normalizeTeamName, type DbInstance } from "@workspace/db";
import { activeTeamDatabaseInstance } from "./activeTeamDatabase";
import { isDatabaseConnectionError } from "./databaseErrors";
import { teamSqlCondition } from "./teamSqlCondition.ts";
export { teamSqlCondition };

/** Normalize only letter casing; callers retain their existing whitespace rules. */
export function normalizeTeamCode(code: string): string {
  return code.toLowerCase();
}

/**
 * Team isolation helpers. Tenant rows with a nullable `team_id` use NULL for
 * legacy default-team data, except shared supplier catalog rows. Queries for
 * the default team therefore match BOTH `team_id = 'default'` AND `team_id IS
 * NULL`; use sharedCatalogTeamSqlCondition for catalog items so global supplier
 * rows remain visible to every team. New team-owned rows use a concrete ID.
 */

export function hashTeamCode(code: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(normalizeTeamCode(code), salt, 64).toString("hex")}`;
}

export function verifyTeamCodeHash(code: string, encoded: string | null | undefined): boolean {
  if (!encoded) return false;
  const [saltHex, hashHex] = encoded.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(hashHex, "hex");
    const normalized = normalizeTeamCode(code);
    const actual = scryptSync(normalized, salt, 64);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
    // Legacy rows hashed the caller-provided casing.
    if (normalized === code) return false;
    const legacy = scryptSync(code, salt, 64);
    return legacy.length === expected.length && timingSafeEqual(legacy, expected);
  } catch {
    return false;
  }
}

export function teamCodesMatch(left: string, right: string): boolean {
  const a = createHash("sha256").update(normalizeTeamCode(left)).digest();
  const b = createHash("sha256").update(normalizeTeamCode(right)).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

export function hasTeamCode(
  code: string,
  teams: readonly { codeHash: string | null }[],
): boolean {
  return teams.some((team) => verifyTeamCodeHash(code, team.codeHash));
}

function legacyCodeMatches(code: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  try {
    return teamCodesMatch(code.trim(), expected.trim());
  } catch {
    return false;
  }
}

function databaseFor(instance: DbInstance) {
  return instance === "secondary" ? secondaryDb() : primaryDb;
}

/** Ensure the default team exists on the active request instance. */
export async function ensureDefaultTeam(instance: DbInstance = activeTeamDatabaseInstance()): Promise<{ id: string; name: string }> {
  const handle = databaseFor(instance);
  if (!handle) throw new Error("The secondary database is not configured.");
  try {
    const [existing] = await handle.select().from(teamsTable).where(eq(teamsTable.id, DEFAULT_TEAM_ID)).limit(1);
    if (existing) return existing;
  } catch {
    // Table may not exist yet before `drizzle-kit push`; callers fall back to legacy checks.
    return { id: DEFAULT_TEAM_ID, name: "Default Team" };
  }
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const codeHash = adminPassword ? hashTeamCode(adminPassword) : hashTeamCode(randomBytes(16).toString("hex"));
  try {
    const [created] = await handle.insert(teamsTable).values({
      id: DEFAULT_TEAM_ID,
      name: "Wolverines",
      normalizedName: normalizeTeamName("Wolverines"),
      codeHash,
    }).returning();
    if (created) return created;
  } catch {
    // Raced with another instance; read again.
    try {
      const [row] = await handle.select().from(teamsTable).where(eq(teamsTable.id, DEFAULT_TEAM_ID)).limit(1);
      if (row) return row;
    } catch {
      // ignore, fall through
    }
  }
  return { id: DEFAULT_TEAM_ID, name: "Wolverines" };
}

export type ResolvedTeam = { id: string; name: string; instance: DbInstance };

/** Find a team by access code on the active team database. */
export async function findTeamByCode(code: string): Promise<ResolvedTeam | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  const instance = activeTeamDatabaseInstance();
  const handle = databaseFor(instance);
  if (!handle) return null;
  try {
    const teams = await handle.select().from(teamsTable);
    for (const team of teams) {
      if (verifyTeamCodeHash(trimmed, team.codeHash)) return { ...team, instance };
    }
    if (legacyCodeMatches(trimmed)) {
      const def = await ensureDefaultTeam(instance);
      return { ...def, instance };
    }
    return null;
  } catch (error) {
    if (isDatabaseConnectionError(error)) throw error;
    // A pre-migration database may not have the teams table yet.
    if (legacyCodeMatches(trimmed)) {
      return { id: DEFAULT_TEAM_ID, name: "Wolverines", instance };
    }
    return null;
  }
}

export async function getTeamById(id: string, instance?: DbInstance | null): Promise<ResolvedTeam | null> {
  const activeInstance = activeTeamDatabaseInstance();
  const handles: DbInstance[] = [instance ?? activeInstance];
  for (const handle of handles) {
    try {
      const handleDb = databaseFor(handle);
      if (!handleDb) continue;
      const [team] = await handleDb.select().from(teamsTable).where(eq(teamsTable.id, id)).limit(1);
      if (team) return { ...team, instance: handle };
    } catch (error) {
      if (isDatabaseConnectionError(error)) throw error;
      // Missing table on a fresh instance: keep looking.
    }
  }
  return id === DEFAULT_TEAM_ID ? { id: DEFAULT_TEAM_ID, name: "Wolverines", instance: activeInstance } : null;
}

/** Find an account on the active team database. Used by login-adjacent
 * and WebSocket upgrade paths that run outside a routed request context. */
export async function findAccountAnywhere(id: string): Promise<{ account: typeof interviewerAccountsTable.$inferSelect; instance: DbInstance } | null> {
  const activeInstance = activeTeamDatabaseInstance();
  const handle = databaseFor(activeInstance);
  if (!handle) return null;
  try {
    const [account] = await handle.select().from(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, id)).limit(1);
    return account ? { account, instance: activeInstance } : null;
  } catch {
    return null;
  }
}

/** Normalize an account's team: NULL (legacy) => default team. */
export function teamIdForAccount(account: { teamId?: string | null } | null | undefined): string {
  return account?.teamId?.trim() ? account.teamId : DEFAULT_TEAM_ID;
}

/**
 * Drizzle condition matching rows belonging to `teamId`, including legacy
 * NULL rows when `teamId` is the default team. Pass a `team_id` column.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function teamFilter(column: any, teamId: string) {
  if (teamId === DEFAULT_TEAM_ID) {
    return or(eq(column, DEFAULT_TEAM_ID), isNull(column));
  }
  return eq(column, teamId);
}

/**
 * Catalog rows without a team are shared supplier products. Manual rows are
 * always assigned a team before this condition is used, so legacy NULL rows
 * remain visible to the default team through teamSqlCondition while shared
 * supplier rows are visible to every team.
 */
export function sharedCatalogTeamSqlCondition(
  alias: string,
  placeholder: string,
): string {
  return `(${teamSqlCondition(`${alias}."team_id"`, placeholder)} or (${alias}."team_id" is null and ${alias}."is_manual" = false))`;
}

export { normalizeTeamName, DEFAULT_TEAM_ID };

/** Generate a human-friendly random team code, e.g. "CLAW-4821-KILO". */
export function randomTeamCode(): string {
  const words = ["CLAW", "BOLT", "GEAR", "SPARK", "ORBIT", "VOLT", "FLUX", "NOVA", "AXIOM", "KILO", "PULSE", "TITAN"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${pick()}-${digits}-${pick()}`;
}
