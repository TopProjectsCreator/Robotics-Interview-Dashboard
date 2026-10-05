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
export async function readWorkspaceVisibility(): Promise<WorkspaceVisibility> {
  const defaults = normalizeWorkspaceVisibility(DEFAULT_WORKSPACE_VISIBILITY);
  try {
    const { db, workspaceSettingsTable } = await import("@workspace/db");
    const [row] = await db
      .select({ visibility: workspaceSettingsTable.visibility })
      .from(workspaceSettingsTable)
      .limit(1);
    if (!row) return defaults;
    return normalizeWorkspaceVisibility(row.visibility);
  } catch {
    return defaults;
  }
}

export async function writeWorkspaceVisibility(value: unknown): Promise<WorkspaceVisibility> {
  // Accepts the loose input shape from the API and normalises it, so unknown
  // workspaces and roles are discarded rather than trusted.
  const normalized = normalizeWorkspaceVisibility(value);
  const { db, workspaceSettingsTable } = await import("@workspace/db");
  const [row] = await db
    .insert(workspaceSettingsTable)
    .values({ id: 1, visibility: normalized })
    .onConflictDoUpdate({
      target: workspaceSettingsTable.id,
      set: { visibility: normalized },
    })
    .returning({ visibility: workspaceSettingsTable.visibility });
  return normalizeWorkspaceVisibility(row?.visibility);
}
