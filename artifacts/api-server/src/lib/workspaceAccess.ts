import {
  DEFAULT_WORKSPACE_VISIBILITY,
  normalizeWorkspaceVisibility,
  type WorkspaceVisibility,
} from "./workspaceVisibility";

export * from "./workspaceVisibility";

/**
 * Reads the admin-configured visibility map, falling back to defaults when the
 * settings row has not been created yet or is unreadable. A settings read must
 * never be the reason nobody can sign in, so failures degrade to defaults.
 *
 * `@workspace/db` is imported lazily on purpose: this module is pulled in by the
 * auth middleware, and a static import here would make every auth path depend on
 * the schema module being resolvable.
 */
function teamIdOrDefault(teamId?: string | null): string {
  return teamId?.trim() ? teamId : "default";
}

export async function readWorkspaceVisibility(teamId?: string | null): Promise<WorkspaceVisibility> {
  const defaults = normalizeWorkspaceVisibility(DEFAULT_WORKSPACE_VISIBILITY);
  try {
    const { db, workspaceSettingsTable } = await import("@workspace/db");
    const { eq, isNull, or } = await import("drizzle-orm");
    const team = teamIdOrDefault(teamId);
    const cond = team === "default"
      ? or(eq(workspaceSettingsTable.teamId, "default"), isNull(workspaceSettingsTable.teamId))
      : eq(workspaceSettingsTable.teamId, team);
    const [row] = await db
      .select({ visibility: workspaceSettingsTable.visibility })
      .from(workspaceSettingsTable)
      .where(cond)
      .limit(1);
    if (!row) {
      // Fall back to the legacy global row (id=1, team_id NULL) for the default
      // team so existing settings are never lost.
      if (team === "default") {
        const [legacy] = await db
          .select({ visibility: workspaceSettingsTable.visibility })
          .from(workspaceSettingsTable)
          .limit(1);
        if (!legacy) return defaults;
        return normalizeWorkspaceVisibility(legacy.visibility);
      }
      return defaults;
    }
    return normalizeWorkspaceVisibility(row.visibility);
  } catch {
    return defaults;
  }
}

export async function writeWorkspaceVisibility(value: unknown, teamId?: string | null): Promise<WorkspaceVisibility> {
  // Accepts the loose input shape from the API and normalises it, so unknown
  // workspaces and roles are discarded rather than trusted.
  const normalized = normalizeWorkspaceVisibility(value);
  const { db, workspaceSettingsTable } = await import("@workspace/db");
  const { eq, isNull, or } = await import("drizzle-orm");
  const team = teamIdOrDefault(teamId);
  try {
    const cond = team === "default"
      ? or(eq(workspaceSettingsTable.teamId, "default"), isNull(workspaceSettingsTable.teamId))
      : eq(workspaceSettingsTable.teamId, team);
    const existing = await db.select({ id: workspaceSettingsTable.id }).from(workspaceSettingsTable).where(cond).limit(1);
    if (existing[0]) {
      const [row] = await db.update(workspaceSettingsTable).set({ visibility: normalized, teamId: team })
        .where(eq(workspaceSettingsTable.id, existing[0].id))
        .returning({ visibility: workspaceSettingsTable.visibility });
      return normalizeWorkspaceVisibility(row?.visibility);
    }
  } catch {
    // fall through to insert
  }
  const [row] = await db
    .insert(workspaceSettingsTable)
    .values({ teamId: team, visibility: normalized })
    .returning({ visibility: workspaceSettingsTable.visibility });
  return normalizeWorkspaceVisibility(row?.visibility);
}
