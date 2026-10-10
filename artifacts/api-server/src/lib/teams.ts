import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { eq, isNull, or } from "drizzle-orm";
import { db, teamsTable, DEFAULT_TEAM_ID, normalizeTeamName } from "@workspace/db";

/**
 * Team isolation helpers. Every tenant table carries a nullable `team_id`;
 * NULL means "legacy row belonging to the default team". Queries for the
 * default team therefore match BOTH `team_id = 'default'` AND `team_id IS
 * NULL`, so rows written before the multi-team migration are never lost and
 * the current team keeps working through the migration window. New teams
 * always write their concrete id, so they are completely separate.
 */

export function hashTeamCode(code: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(code, salt, 64).toString("hex")}`;
}

export function verifyTeamCodeHash(code: string, encoded: string | null | undefined): boolean {
  if (!encoded) return false;
  const [saltHex, hashHex] = encoded.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const actual = scryptSync(code, Buffer.from(saltHex, "hex"), 64);
    const expected = Buffer.from(hashHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function legacyCodeMatches(code: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  try {
    const a = createHash("sha256").update(code.trim()).digest();
    const b = createHash("sha256").update(expected.trim()).digest();
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Ensure the default team exists, seeded from ADMIN_PASSWORD when available. */
export async function ensureDefaultTeam(): Promise<{ id: string; name: string }> {
  try {
    const [existing] = await db.select().from(teamsTable).where(eq(teamsTable.id, DEFAULT_TEAM_ID)).limit(1);
    if (existing) return existing;
  } catch {
    // Table may not exist yet before `drizzle-kit push`; callers fall back to legacy checks.
    return { id: DEFAULT_TEAM_ID, name: "Default Team" };
  }
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const codeHash = adminPassword ? hashTeamCode(adminPassword) : hashTeamCode(randomBytes(16).toString("hex"));
  try {
    const [created] = await db.insert(teamsTable).values({
      id: DEFAULT_TEAM_ID,
      name: "Wolverines",
      normalizedName: normalizeTeamName("Wolverines"),
      codeHash,
    }).returning();
    if (created) return created;
  } catch {
    // Raced with another instance; read again.
    try {
      const [row] = await db.select().from(teamsTable).where(eq(teamsTable.id, DEFAULT_TEAM_ID)).limit(1);
      if (row) return row;
    } catch {
      // ignore, fall through
    }
  }
  return { id: DEFAULT_TEAM_ID, name: "Wolverines" };
}

/** Find the team whose access code matches `code`. Tries DB teams, then legacy ADMIN_PASSWORD. */
export async function findTeamByCode(code: string): Promise<{ id: string; name: string } | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  try {
    const teams = await db.select().from(teamsTable);
    for (const team of teams) {
      if (verifyTeamCodeHash(trimmed, team.codeHash)) return team;
    }
    // Legacy fallback: the current team's ADMIN_PASSWORD still opens the
    // default team even if its stored hash is stale/missing. This keeps the
    // existing team safe through the migration.
    if (legacyCodeMatches(trimmed)) {
      const def = await ensureDefaultTeam();
      return def;
    }
    return null;
  } catch {
    // Teams table missing (pre-migration): fall back to legacy env check.
    if (legacyCodeMatches(trimmed)) return { id: DEFAULT_TEAM_ID, name: "Wolverines" };
    return null;
  }
}

export async function getTeamById(id: string): Promise<{ id: string; name: string } | null> {
  try {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, id)).limit(1);
    return team ?? null;
  } catch {
    return id === DEFAULT_TEAM_ID ? { id: DEFAULT_TEAM_ID, name: "Wolverines" } : null;
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
 * Raw-SQL equivalent of {@link teamFilter} for routes that query via `pool`.
 * `columnSql` is the qualified column (e.g. `c."team_id"`), `placeholder` the
 * `$n` placeholder holding the team id. Appends the team value to the query's
 * values array at the call site.
 */
export function teamSqlCondition(columnSql: string, placeholder: string): string {
  return `(${columnSql} = ${placeholder} or (${placeholder} = 'default' and ${columnSql} is null))`;
}

export { normalizeTeamName, DEFAULT_TEAM_ID };

/** Generate a human-friendly random team code, e.g. "CLAW-4821-KILO". */
export function randomTeamCode(): string {
  const words = ["CLAW", "BOLT", "GEAR", "SPARK", "ORBIT", "VOLT", "FLUX", "NOVA", "AXIOM", "KILO", "PULSE", "TITAN"];
  const pick = () => words[Math.floor(Math.random() * words.length)];
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `${pick()}-${digits}-${pick()}`;
}
