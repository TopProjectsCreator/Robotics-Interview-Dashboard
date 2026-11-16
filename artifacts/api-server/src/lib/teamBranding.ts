import { TEAM_BACKGROUNDS_MAX, TEAM_BACKGROUND_ROTATION_MAX_SECONDS } from "@workspace/db";

/**
 * Effective app backgrounds for a team, in rotation order. The legacy
 * single-background column is folded in when the array is empty so a team
 * keeps its image even if the boot migration has not run yet.
 */
export function normalizedBackgrounds(row: { backgroundPath?: string | null; backgroundPaths?: unknown } | undefined): string[] {
  const raw = row?.backgroundPaths;
  const paths = Array.isArray(raw) ? raw.filter((path): path is string => typeof path === "string" && path.trim().length > 0) : [];
  if (paths.length === 0 && typeof row?.backgroundPath === "string" && row.backgroundPath.trim().length > 0) {
    paths.push(row.backgroundPath);
  }
  return [...new Set(paths)].slice(0, TEAM_BACKGROUNDS_MAX);
}

/** Whole seconds between background switches; anything unusable becomes "no rotation". */
export function clampRotationSeconds(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(TEAM_BACKGROUND_ROTATION_MAX_SECONDS, Math.max(0, Math.round(value)))
    : 0;
}

/** Shape stored team-branding columns into the API response, filling safe defaults. */
export function normalizedBrandingRow(row: { logoPath?: string | null; primaryColor?: string | null; backgroundPath?: string | null; backgroundPaths?: unknown; backgroundMode?: string | null; backgroundOverlay?: number | null; backgroundRotationSeconds?: number | null; backgroundAudience?: string | null; backgroundMemberIds?: unknown } | undefined): { logoPath: string | null; primaryColor: string | null; backgroundPath: string | null; backgrounds: string[]; backgroundMode: "cover" | "tile" | null; backgroundOverlay: number; backgroundRotationSeconds: number; backgroundAudience: "everyone" | "selected"; backgroundMemberIds: string[] } {
  const mode = row?.backgroundMode;
  const backgrounds = normalizedBackgrounds(row);
  return {
    logoPath: row?.logoPath ?? null,
    primaryColor: row?.primaryColor ?? null,
    backgroundPath: backgrounds[0] ?? null,
    backgrounds,
    backgroundMode: mode === "cover" || mode === "tile" ? mode : null,
    backgroundOverlay: typeof row?.backgroundOverlay === "number" && Number.isFinite(row.backgroundOverlay)
      ? Math.min(80, Math.max(0, Math.round(row.backgroundOverlay)))
      : 35,
    backgroundRotationSeconds: clampRotationSeconds(row?.backgroundRotationSeconds),
    backgroundAudience: row?.backgroundAudience === "selected" ? "selected" : "everyone",
    backgroundMemberIds: Array.isArray(row?.backgroundMemberIds)
      ? [...new Set(row.backgroundMemberIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
      : [],
  };
}
