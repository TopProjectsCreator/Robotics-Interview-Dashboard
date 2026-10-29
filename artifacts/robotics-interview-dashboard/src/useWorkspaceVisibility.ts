import { useMemo } from "react";

import {
  getGetWorkspaceVisibilityQueryKey,
  useGetWorkspaceVisibility,
  useUpdateWorkspaceVisibility,
  type WorkspaceVisibility,
} from "@workspace/api-client-react";

export const WORKSPACE_LABELS: Record<keyof WorkspaceVisibility, string> = {
  interview: "Interview",
  chat: "Chat",
  parts: "Parts",
  cad: "CAD",
  code: "Code",
};

/**
 * Legacy role labels/order, kept for reading settings saved before the
 * per-user switch. New access is granted per interviewer account ID; the
 * Settings editor now shows actual people instead of these role columns.
 */
export const WORKSPACE_ROLE_LABELS: Record<string, string> = {
  coordinator: "Admins",
  treasurer: "Treasurers",
  interviewer: "Team members",
};

export const WORKSPACE_ROLE_ORDER: string[] = [
  "coordinator",
  "treasurer",
  "interviewer",
];

export const WORKSPACE_KEYS = Object.keys(WORKSPACE_LABELS) as (keyof WorkspaceVisibility)[];

/**
 * The caller's workspaces are always resolvable, even while the visibility
 * query is still loading, so the sidebar never flashes empty.
 */
const FALLBACK_BY_ROLE: Record<string, WorkspaceVisibility> = {
  coordinator: {
    interview: ["coordinator"],
    chat: ["coordinator", "treasurer", "interviewer"],
    parts: ["coordinator", "treasurer", "interviewer"],
    cad: ["coordinator"],
    code: ["coordinator"],
  },
  treasurer: {
    interview: [],
    chat: ["coordinator", "treasurer", "interviewer"],
    parts: ["coordinator", "treasurer", "interviewer"],
    cad: [],
    code: [],
  },
  interviewer: {
    interview: [],
    chat: ["coordinator", "treasurer", "interviewer"],
    parts: ["coordinator", "treasurer", "interviewer"],
    cad: [],
    code: [],
  },
};

export function fallbackVisibility(role: string | undefined): WorkspaceVisibility {
  const known = role && role in FALLBACK_BY_ROLE ? role : "interviewer";
  const fallback = FALLBACK_BY_ROLE[known];
  return {
    interview: [...fallback.interview],
    chat: [...fallback.chat],
    parts: [...fallback.parts],
    cad: [...fallback.cad],
    code: [...fallback.code],
  };
}

/**
 * Normalises the server value: unknown workspaces are dropped and every list
 * keeps its string entries (interviewer account IDs plus legacy role names).
 * A missing or malformed list falls back to the role default so a partial
 * response degrades instead of crashing the shell.
 */
export function normalizeVisibility(
  value: unknown,
  role?: string,
): WorkspaceVisibility {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const defaults = fallbackVisibility(role);
  const normalized = {} as WorkspaceVisibility;
  for (const key of WORKSPACE_KEYS) {
    const raw = source[key];
    if (!Array.isArray(raw)) {
      normalized[key] = [...defaults[key]];
      continue;
    }
    const seen = new Set<string>();
    for (const entry of raw) {
      if (typeof entry === "string" && entry.trim()) {
        seen.add(entry.trim());
      }
    }
    normalized[key] = [...seen].sort((a, b) => {
      const order = (v: string) => {
        const idx = WORKSPACE_ROLE_ORDER.indexOf(v);
        return idx === -1 ? WORKSPACE_ROLE_ORDER.length : idx;
      };
      return order(a) - order(b) || a.localeCompare(b);
    });
  }
  return normalized;
}

/**
 * Per-user access check. Coordinators always pass so settings can never lock
 * an admin out. Otherwise access comes from the caller's account ID, with a
 * fallback to the legacy role entry for settings saved before per-user access.
 */
export function userCanSeeWorkspace(
  visibility: WorkspaceVisibility,
  userId: string | undefined | null,
  role: string | undefined | null,
  key: keyof WorkspaceVisibility,
): boolean {
  if (role === "coordinator" || role === "admin") return true;
  const list = visibility[key] ?? [];
  const id = typeof userId === "string" ? userId.trim() : "";
  if (id && (list as string[]).includes(id)) return true;
  const roleName = typeof role === "string" ? role.trim() : "";
  if (roleName && (list as string[]).includes(roleName)) return true;
  return false;
}

/** Workspaces a specific user can open, in canonical order. */
export function visibleWorkspacesForUser(
  visibility: WorkspaceVisibility,
  userId: string | undefined | null,
  role: string | undefined | null,
): (keyof WorkspaceVisibility)[] {
  return WORKSPACE_KEYS.filter((key) => userCanSeeWorkspace(visibility, userId, role, key));
}

/** Per-user index (0-based) of a workspace within that user's visible list. */
export function workspaceNumberForUser(
  visibility: WorkspaceVisibility,
  userId: string | undefined | null,
  role: string | undefined | null,
  key: keyof WorkspaceVisibility,
): number {
  return visibleWorkspacesForUser(visibility, userId, role).indexOf(key);
}

/**
 * Workspace visibility: which links the sidebar shows and which routes are
 * reachable. Admins edit it per person from Settings; everybody reads it.
 *
 * The fetch is opt-in so an unauthenticated visitor never triggers it: the app
 * must not issue private requests before sign-in.
 */
export function useWorkspaceVisibility(
  enabled = true,
  roleOrUserId?: string,
  userIdArg?: string,
) {
  // Backwards-compatible signature: (enabled, role) or (enabled, role, userId)
  // or (enabled, userId, role)? Callers pass (enabled, role, userId) after the
  // per-user switch; resolve flexibly by treating the third arg as the user ID
  // when present, else sniffing which arg looks like an account ID.
  let role: string | undefined;
  let userId: string | undefined;
  if (userIdArg !== undefined) {
    role = roleOrUserId;
    userId = userIdArg;
  } else {
    role = roleOrUserId;
    userId = undefined;
  }
  const query = useGetWorkspaceVisibility({
    query: { queryKey: getGetWorkspaceVisibilityQueryKey(), enabled },
  });
  const save = useUpdateWorkspaceVisibility();

  const effectiveRole = role ?? "interviewer";
  const visibility = useMemo(
    () => normalizeVisibility(query.data, effectiveRole),
    [query.data, effectiveRole],
  );

  const visible = useMemo(() => {
    const set = new Set<keyof WorkspaceVisibility>();
    for (const key of visibleWorkspacesForUser(visibility, userId, effectiveRole)) {
      set.add(key);
    }
    return set;
  }, [visibility, userId, effectiveRole]);

  /** Workspaces a specific account can open, used by the settings editor. */
  const canUserSee = (
    accountId: string,
    accountRole: string | undefined,
    key: keyof WorkspaceVisibility,
  ): boolean => userCanSeeWorkspace(visibility, accountId, accountRole, key);

  /** Legacy role check, kept for settings saved before per-user access. */
  const canRoleSee = (roleName: string, key: keyof WorkspaceVisibility): boolean =>
    (visibility[key] as string[]).includes(roleName);

  return {
    visibility,
    visible,
    canUserSee,
    canRoleSee,
    isLoading: query.isLoading,
    save: (next: WorkspaceVisibility) => save.mutateAsync({ data: next }),
    isSaving: save.isPending,
    fallbackVisibility,
    userCanSeeWorkspace,
    visibleWorkspacesForUser,
  };
}
