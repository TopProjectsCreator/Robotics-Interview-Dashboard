/**
 * Pure workspace-visibility rules, deliberately free of database imports so they
 * can be unit tested directly and reasoned about on their own.
 */

export const WORKSPACE_KEYS = ["interview", "chat", "parts", "cad", "code"] as const;
export type WorkspaceKey = (typeof WORKSPACE_KEYS)[number];

export const WORKSPACE_ROLES = ["coordinator", "treasurer", "interviewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

/**
 * Per-user workspace access: each workspace holds the interviewer account IDs
 * that may open it. Legacy role names ("coordinator", "treasurer",
 * "interviewer") are still accepted inside these lists so stored settings
 * written before the per-user switch keep working until an admin re-saves.
 */
export type WorkspaceVisibility = Record<WorkspaceKey, string[]>;

/**
 * Interview stays coordinator-only and the CAD library starts admin-only, which
 * matches the role behaviour that existed before either workspace was
 * configurable. Chat and Parts have always been open to every signed-in role.
 */
export const DEFAULT_WORKSPACE_VISIBILITY: WorkspaceVisibility = {
  interview: ["coordinator"],
  chat: ["coordinator", "treasurer", "interviewer"],
  parts: ["coordinator", "treasurer", "interviewer"],
  cad: ["coordinator"],
  code: ["coordinator"],
};

export function isWorkspaceKey(value: unknown): value is WorkspaceKey {
  return typeof value === "string" && (WORKSPACE_KEYS as readonly string[]).includes(value);
}

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === "string" && (WORKSPACE_ROLES as readonly string[]).includes(value);
}

/**
 * Normalises an arbitrary stored value into a complete visibility map.
 * Unknown workspaces are dropped. Each list keeps every non-empty string
 * entry: interviewer account IDs (per-user access) plus legacy role names,
 * which keep working until an admin re-saves. Entries are de-duplicated with
 * legacy roles first in canonical order, then user IDs sorted, so responses
 * are stable regardless of save order.
 *
 * A workspace whose stored value is missing or not an array falls back to its
 * default. A workspace whose value is a list containing only invalid entries
 * ends up with no access, which is the safe direction to fail.
 */
export function normalizeWorkspaceVisibility(value: unknown): WorkspaceVisibility {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const normalized = {} as WorkspaceVisibility;
  for (const key of WORKSPACE_KEYS) {
    const raw = source[key];
    if (!Array.isArray(raw)) {
      normalized[key] = [...DEFAULT_WORKSPACE_VISIBILITY[key]];
      continue;
    }
    const roles = new Set<string>();
    const users = new Set<string>();
    for (const entry of raw) {
      if (typeof entry !== "string") continue;
      const trimmed = entry.trim();
      if (!trimmed) continue;
      if (isWorkspaceRole(trimmed)) roles.add(trimmed);
      else users.add(trimmed);
    }
    normalized[key] = [
      ...WORKSPACE_ROLES.filter((role) => roles.has(role)),
      ...[...users].sort(),
    ];
  }
  return normalized;
}

export function roleCanSeeWorkspace(
  visibility: WorkspaceVisibility,
  role: string | undefined,
  workspace: WorkspaceKey,
): boolean {
  if (!isWorkspaceRole(role)) return false;
  return visibility[workspace].includes(role);
}

/** Workspaces a role can open, in canonical order. */
export function visibleWorkspacesForRole(
  visibility: WorkspaceVisibility,
  role: string | undefined,
): WorkspaceKey[] {
  return WORKSPACE_KEYS.filter((key) => roleCanSeeWorkspace(visibility, role, key));
}

/**
 * Per-user access check. Coordinators always pass so settings can never lock
 * an admin out. Otherwise access is granted when the caller's account ID is
 * listed, or — for settings saved before the per-user switch — when the
 * caller's legacy role is listed.
 */
export function userCanSeeWorkspace(
  visibility: WorkspaceVisibility,
  userId: string | undefined | null,
  role: string | undefined | null,
  workspace: WorkspaceKey,
): boolean {
  if (role === "coordinator") return true;
  const list = visibility[workspace] ?? [];
  if (typeof userId === "string" && userId.trim() && list.includes(userId.trim())) return true;
  if (typeof role === "string" && role.trim() && list.includes(role.trim())) return true;
  return false;
}

/** Workspaces a specific user can open, in canonical order. */
export function visibleWorkspacesForUser(
  visibility: WorkspaceVisibility,
  userId: string | undefined | null,
  role: string | undefined | null,
): WorkspaceKey[] {
  return WORKSPACE_KEYS.filter((key) => userCanSeeWorkspace(visibility, userId, role, key));
}
