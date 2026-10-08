/**
 * Pure workspace-visibility rules, deliberately free of database imports so they
 * can be unit tested directly and reasoned about on their own.
 */

export const WORKSPACE_KEYS = ["interview", "chat", "parts", "cad", "code"] as const;
export type WorkspaceKey = (typeof WORKSPACE_KEYS)[number];

export const WORKSPACE_ROLES = ["coordinator", "treasurer", "interviewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export type WorkspaceVisibility = Record<WorkspaceKey, WorkspaceRole[]>;

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
 * Normalises an arbitrary stored value into a complete, in-range visibility map.
 * Unknown workspaces are dropped and unknown roles are discarded, so a hand-edited
 * row can never hand a role access it should not have.
 *
 * A workspace whose stored value is missing or not an array falls back to its
 * default. A workspace whose value is a list containing only invalid roles ends
 * up with no access, which is the safe direction to fail.
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
    const seen = new Set<WorkspaceRole>();
    for (const entry of raw) {
      if (isWorkspaceRole(entry)) seen.add(entry);
    }
    normalized[key] = WORKSPACE_ROLES.filter((role) => seen.has(role));
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
