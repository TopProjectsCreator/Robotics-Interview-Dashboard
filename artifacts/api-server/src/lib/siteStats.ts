export type SiteStatsAccount = {
  id: string;
  teamId: string | null;
  normalizedName: string;
};

function accountKey(account: SiteStatsAccount): string {
  const teamId = account.teamId?.trim() || "default";
  const normalizedName = account.normalizedName.trim().replace(/\s+/g, " ").toLocaleLowerCase();
  return `${teamId}\u0000${normalizedName}`;
}

/**
 * Site-wide stats read accounts from both database instances. A team member
 * present in both should only contribute once to the people count.
 */
export function deduplicateSiteStatsAccounts<T extends SiteStatsAccount>(
  primaryAccounts: T[],
  secondaryAccounts: T[] = [],
): T[] {
  const unique = new Map<string, T>();
  // The default team is stored on primary. A legacy NULL team_id on the
  // secondary database must not be misattributed to Wolverines.
  const accounts = [
    ...primaryAccounts,
    ...secondaryAccounts.filter((account) => Boolean(account.teamId?.trim())),
  ];
  for (const account of accounts) {
    const key = accountKey(account);
    if (!unique.has(key)) unique.set(key, account);
  }
  return [...unique.values()];
}
