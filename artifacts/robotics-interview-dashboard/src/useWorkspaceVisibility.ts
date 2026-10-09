import { useMemo } from "react";

import {
  getGetWorkspaceVisibilityQueryKey,
  useGetWorkspaceVisibility,
  useUpdateWorkspaceVisibility,
  type WorkspaceRole,
  type WorkspaceVisibility,
} from "@workspace/api-client-react";

export const WORKSPACE_LABELS: Record<keyof WorkspaceVisibility, string> = {
  interview: "Interview",
  chat: "Chat",
  parts: "Parts",
  cad: "CAD",
  code: "Code",
};

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  coordinator: "Admins",
  treasurer: "Treasurers",
  interviewer: "Team members",
};

export const WORKSPACE_ROLE_ORDER: WorkspaceRole[] = [
  "coordinator",
  "treasurer",
  "interviewer",
];

export const WORKSPACE_KEYS = Object.keys(WORKSPACE_LABELS) as (keyof WorkspaceVisibility)[];

/**
 * The caller's role is always permitted to see its own workspaces, even while
 * the visibility query is still loading, so the sidebar never flashes empty.
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
  return FALLBACK_BY_ROLE[known];
}

/**
 * Applies the same normalisation the server does: unknown workspaces and roles
 * are dropped, and a workspace with a missing or malformed list falls back to
 * its default. Without this, a partial response would crash the shell instead of
 * degrading to the shipped defaults.
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
    const seen = new Set<WorkspaceRole>();
    for (const entry of raw) {
      if (typeof entry === "string" && WORKSPACE_ROLE_ORDER.includes(entry as WorkspaceRole)) {
        seen.add(entry as WorkspaceRole);
      }
    }
    normalized[key] = WORKSPACE_ROLE_ORDER.filter((role_) => seen.has(role_));
  }
  return normalized;
}

/**
 * Workspace visibility, which decides which links the sidebar shows and which
 * routes are reachable. Admins edit it from Settings; everybody reads it.
 *
 * The fetch is opt-in so an unauthenticated visitor never triggers it: the app
 * must not issue private requests before sign-in.
 */
export function useWorkspaceVisibility(enabled = true, role?: string) {
  const query = useGetWorkspaceVisibility({
    query: { queryKey: getGetWorkspaceVisibilityQueryKey(), enabled },
  });
  const save = useUpdateWorkspaceVisibility();

  const visibility = useMemo(
    () => normalizeVisibility(query.data, role),
    [query.data, role],
  );

  const visible = useMemo(() => {
    const set = new Set<keyof WorkspaceVisibility>();
    for (const key of WORKSPACE_KEYS) {
      if (visibility[key].includes("coordinator")) set.add(key);
    }
    return set;
  }, [visibility]);

  /** Workspaces a specific role can open, used by the settings editor. */
  const canRoleSee = (role: WorkspaceRole, key: keyof WorkspaceVisibility): boolean =>
    visibility[key].includes(role);

  return {
    visibility,
    visible,
    canRoleSee,
    isLoading: query.isLoading,
    save: (next: WorkspaceVisibility) => save.mutateAsync({ data: next }),
    isSaving: save.isPending,
    fallbackVisibility,
  };
}
