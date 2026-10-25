import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { eq, isNull, or } from "drizzle-orm";
import { primaryDb, secondaryDb, hasSecondary, teamsTable, interviewerAccountsTable, DEFAULT_TEAM_ID, normalizeTeamName, type DbInstance } from "@workspace/db";

/**
 * Team isolation helpers. Tenant rows with a nullable `team_id` use NULL for
 * legacy default-team data, except shared supplier catalog rows. Queries for
 * the default team therefore match BOTH `team_id = 'default'` AND `team_id IS
 * NULL`; use sharedCatalogTeamSqlCondition for catalog items so global supplier
 * rows remain visible to every team. New team-owned rows use a concrete ID.
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

/** Ensure the default team exists, seeded from ADMIN_PASSWORD when available. Lives on primary, always. */
export async function ensureDefaultTeam(): Promise<{ id: string; name: string }> {
  try {
    const [existing] = await primaryDb.select().from(teamsTable).where(eq(teamsTable.id, DEFAULT_TEAM_ID)).limit(1);
    if (existing) return existing;
  } catch {
    // Table may not exist yet before `drizzle-kit push`; callers fall back to legacy checks.
    return { id: DEFAULT_TEAM_ID, name: "Default Team" };
  }
  const adminPassword = process.env.ADMIN_PASSWORD?.trim();
  const codeHash = adminPassword ? hashTeamCode(adminPassword) : hashTeamCode(randomBytes(16).toString("hex"));
  try {
    const [created] = await primaryDb.insert(teamsTable).values({
      id: DEFAULT_TEAM_ID,
      name: "Wolverines",
      normalizedName: normalizeTeamName("Wolverines"),
      codeHash,
    }).returning();
    if (created) return created;
  } catch {
    // Raced with another instance; read again.
    try {
      const [row] = await primaryDb.select().from(teamsTable).where(eq(teamsTable.id, DEFAULT_TEAM_ID)).limit(1);
      if (row) return row;
    } catch {
      // ignore, fall through
    }
  }
  return { id: DEFAULT_TEAM_ID, name: "Wolverines" };
}

export type ResolvedTeam = { id: string; name: string; instance: DbInstance };

/**
 * Find the team whose access code matches `code`, on either instance.
 * Secondary first (all new teams live there, and it spares the capped
 * primary instance the scan), then primary teams, then the legacy
 * ADMIN_PASSWORD fallback for the default team on primary.
 */
export async function findTeamByCode(code: string): Promise<ResolvedTeam | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;
  try {
    const secondary = secondaryDb();
    if (secondary) {
      try {
        const teams = await secondary.select().from(teamsTable);
        for (const team of teams) {
          if (verifyTeamCodeHash(trimmed, team.codeHash)) return { ...team, instance: "secondary" as const };
        }
      } catch {
        // Secondary unreachable/missing table: fall through to primary.
      }
    }
    const teams = await primaryDb.select().from(teamsTable);
    for (const team of teams) {
      if (verifyTeamCodeHash(trimmed, team.codeHash)) return { ...team, instance: "primary" as const };
    }
    // Legacy fallback: the current team's ADMIN_PASSWORD still opens the
    // default team even if its stored hash is stale/missing. This keeps the
    // existing team safe through the migration.
    if (legacyCodeMatches(trimmed)) {
      const def = await ensureDefaultTeam();
      return { ...def, instance: "primary" as const };
    }
    return null;
  } catch {
    // Teams table missing (pre-migration): fall back to legacy env check.
    if (legacyCodeMatches(trimmed)) return { id: DEFAULT_TEAM_ID, name: "Wolverines", instance: "primary" as const };
    return null;
  }
}

export async function getTeamById(id: string, instance?: DbInstance | null): Promise<ResolvedTeam | null> {
  const handles: DbInstance[] = instance ? [instance] : ["primary", ...(hasSecondary() ? ["secondary" as const] : [])];
  for (const handle of handles) {
    try {
      const handleDb = handle === "secondary" ? secondaryDb() ?? primaryDb : primaryDb;
      const [team] = await handleDb.select().from(teamsTable).where(eq(teamsTable.id, id)).limit(1);
      if (team) return { ...team, instance: handle };
    } catch {
      // Missing table on a fresh instance: keep looking.
    }
  }
  return id === DEFAULT_TEAM_ID ? { id: DEFAULT_TEAM_ID, name: "Wolverines", instance: "primary" as const } : null;
}

/** Find an account on either instance (primary first). Used by login-adjacent
 * and WebSocket upgrade paths that run outside a routed request context. */
export async function findAccountAnywhere(id: string): Promise<{ account: typeof interviewerAccountsTable.$inferSelect; instance: DbInstance } | null> {
  try {
    const [account] = await primaryDb.select().from(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, id)).limit(1);
    if (account) return { account, instance: "primary" };
  } catch {
    // ignore, try secondary
  }
  try {
    const secondary = secondaryDb();
    if (secondary) {
      const [account] = await secondary.select().from(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, id)).limit(1);
      if (account) return { account, instance: "secondary" };
    }
  } catch {
    // ignore
  }
  return null;
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
