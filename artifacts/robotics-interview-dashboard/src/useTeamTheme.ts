import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";

import { getStoredAuthToken } from "./authSession";

export type TeamTheme = "light" | "dark";
export type TeamThemePolicy = "recommended" | "locked";
export interface TeamThemeSettings {
  defaultTheme: TeamTheme | null;
  themePolicy: TeamThemePolicy;
}

export const TEAM_THEME_QUERY_KEY = ["/api/auth/team-theme"] as const;

export function teamThemeQueryKey(teamId?: string) {
  return [...TEAM_THEME_QUERY_KEY, teamId ?? "unknown"] as const;
}

// next-themes persists the device's theme choice here (its default storageKey).
const NEXT_THEMES_STORAGE_KEY = "theme";
// Marker written while this device is following the team's default theme, so
// admin changes reach members who were having the default applied for them
// without touching members who picked their own theme.
const FOLLOW_TEAM_THEME_KEY = "robotics-team-theme-follow";

function appRelativeUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || !path.startsWith("/")) return path;
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
  return `${base}${path}`;
}

function teamThemeApi(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getStoredAuthToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(appRelativeUrl(path), { ...init, headers, credentials: "include" });
}

async function readTeamTheme(response: Response): Promise<TeamThemeSettings> {
  if (!response.ok) throw new Error((await response.text()) || "Could not load the team theme.");
  const raw = (await response.json()) as Partial<TeamThemeSettings> | null;
  const theme = raw?.defaultTheme;
  return {
    defaultTheme: theme === "light" || theme === "dark" ? theme : null,
    themePolicy: raw?.themePolicy === "locked" ? "locked" : "recommended",
  };
}

export function useTeamTheme(teamId?: string, enabled = false) {
  const queryClient = useQueryClient();
  const queryKey = teamThemeQueryKey(teamId);
  const query = useQuery({
    queryKey,
    enabled: enabled && Boolean(teamId),
    queryFn: async () => readTeamTheme(await teamThemeApi("/api/auth/team-theme")),
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
  const update = useMutation({
    mutationFn: async (patch: Partial<TeamThemeSettings>) =>
      readTeamTheme(
        await teamThemeApi("/api/auth/team-theme", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        }),
      ),
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  });
  return { ...query, update };
}

export function hasStoredThemeChoice(): boolean {
  try {
    return window.localStorage.getItem(NEXT_THEMES_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function readTeamThemeFollow(): boolean {
  try {
    return window.localStorage.getItem(FOLLOW_TEAM_THEME_KEY) !== null;
  } catch {
    return false;
  }
}

export function writeTeamThemeFollow(theme: TeamTheme | null): void {
  try {
    if (theme) window.localStorage.setItem(FOLLOW_TEAM_THEME_KEY, theme);
    else window.localStorage.removeItem(FOLLOW_TEAM_THEME_KEY);
  } catch {
    // Private browsing etc.
  }
}

/**
 * Records an explicit member choice made through any theme control. Choosing
 * the team default re-subscribes this device to future team default changes;
 * choosing anything else opts this device out until the default is applied again.
 */
export function applyExplicitTeamThemeChoice(choice: TeamTheme, teamDefault: TeamTheme | null): void {
  writeTeamThemeFollow(teamDefault !== null && choice === teamDefault ? choice : null);
}

export interface TeamThemeDecision {
  /** Theme the device should switch to right now, or null to leave it alone. */
  apply: TeamTheme | null;
  /** Marker to persist after this pass; null clears the follow marker. */
  follow: TeamTheme | null;
}

/**
 * Pure decision behind the auto-follow effect, kept separate so the policy is
 * testable without rendering React.
 *
 * Semantics:
 * - No team default: stop tracking; the device keeps whatever theme it has.
 * - Locked: always apply the team default and keep tracking.
 * - Recommended: apply the team default only to devices that never made a
 *   choice or that are already following it; devices with their own choice
 *   are left alone.
 */
export function decideTeamTheme(input: {
  theme: string | undefined;
  hasStoredChoice: boolean;
  following: boolean;
  desired: TeamTheme | null;
  locked: boolean;
}): TeamThemeDecision {
  const { theme, hasStoredChoice, following, desired, locked } = input;
  if (!desired) return { apply: null, follow: null };
  const current = theme === "light" || theme === "dark" ? theme : undefined;
  if (locked || !hasStoredChoice || following) {
    return { apply: current === desired ? null : desired, follow: desired };
  }
  return { apply: null, follow: null };
}

/**
 * Applies the team default theme to this device according to the team policy.
 * Call once near the signed-in shell; members on the public pages or in demo
 * mode are unaffected.
 */
export function useEnforceTeamTheme(teamTheme: TeamThemeSettings | undefined, enabled: boolean): void {
  const { theme, setTheme } = useTheme();
  const defaultTheme = teamTheme?.defaultTheme ?? null;
  const themePolicy = teamTheme?.themePolicy ?? "recommended";
  useEffect(() => {
    if (!enabled) return;
    if (theme === undefined) return; // next-themes has not mounted yet
    const decision = decideTeamTheme({
      theme,
      hasStoredChoice: hasStoredThemeChoice(),
      following: readTeamThemeFollow(),
      desired: defaultTheme,
      locked: defaultTheme !== null && themePolicy === "locked",
    });
    if (decision.apply && decision.apply !== theme) setTheme(decision.apply);
    writeTeamThemeFollow(decision.follow);
  }, [enabled, defaultTheme, themePolicy, theme, setTheme]);
}
