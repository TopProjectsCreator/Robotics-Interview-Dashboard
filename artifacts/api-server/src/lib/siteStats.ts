export type SiteStatsRoster = {
  teamId: string | null;
  interviewerLabels: string;
};

function rosterSize(interviewerLabels: string): number {
  try {
    const labels: unknown = JSON.parse(interviewerLabels);
    if (
      Array.isArray(labels) &&
      labels.length > 0 &&
      labels.every((label) => typeof label === "string")
    ) {
      return labels.map((label: string) => label.trim()).filter(Boolean).length;
    }
  } catch {
    // Match getInterviewSettings: malformed or empty settings use two defaults.
  }
  return 2;
}

/**
 * The displayed people count must represent the configured team roster, not
 * every account row ever created. Primary wins if a team has rows on both DBs.
 */
export function activeRosterCountsByTeam(
  primaryRosters: SiteStatsRoster[],
  secondaryRosters: SiteStatsRoster[] = [],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const roster of [...primaryRosters, ...secondaryRosters]) {
    const teamId = roster.teamId?.trim() || "default";
    if (!counts.has(teamId)) {
      counts.set(teamId, rosterSize(roster.interviewerLabels));
    }
  }
  return counts;
}
