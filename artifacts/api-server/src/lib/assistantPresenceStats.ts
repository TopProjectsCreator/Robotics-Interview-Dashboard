import { and, eq } from "drizzle-orm";
import { db, interviewerAccountsTable } from "@workspace/db";
import { normalizeInterviewerName } from "./interviewerAccounts";
import { teamFilter } from "./teams";
import type { AccountStats } from "./presence";

export type PresencePerson = { id: string; displayName: string };

/**
 * Resolve the assistant's person argument only against accounts in the active
 * team. An account id from another team must never fall through to a name match.
 */
export async function resolvePresenceUser(
  input: string,
  teamId: string,
): Promise<{ account: PresencePerson } | { error: string }> {
  const query = input.trim().slice(0, 120);
  if (!query) return { error: "No user given — pass the person's name or account id from list_presence." };

  const byId = await db
    .select({ id: interviewerAccountsTable.id, displayName: interviewerAccountsTable.displayName })
    .from(interviewerAccountsTable)
    .where(and(eq(interviewerAccountsTable.id, query), teamFilter(interviewerAccountsTable.teamId, teamId)))
    .limit(1);
  if (byId[0]) return { account: byId[0] };

  const normalized = normalizeInterviewerName(query);
  const matches = await db
    .select({ id: interviewerAccountsTable.id, displayName: interviewerAccountsTable.displayName })
    .from(interviewerAccountsTable)
    .where(and(eq(interviewerAccountsTable.normalizedName, normalized), teamFilter(interviewerAccountsTable.teamId, teamId)))
    .limit(5);
  if (matches.length === 1) return { account: matches[0] };
  if (matches.length > 1) {
    return { error: `More than one person matches "${query}". Pass their account id from list_presence instead.` };
  }
  return { error: `Nobody on this team matches "${query}". Call list_presence to see who is online.` };
}

export function formatPresenceStats(displayName: string, stats: AccountStats): { detail: string; content: string } {
  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const detail = `${displayName}: ${formatDuration(stats.totalSeconds)} total`;
  if (stats.visitCount === 0) return { detail, content: `No recorded visits for ${displayName}.` };

  return {
    detail,
    content: `Usage for ${displayName}: ${formatDuration(stats.totalSeconds)} total on site across ${stats.sessionCount} session(s) and ${stats.visitCount} page visit(s), first seen ${stats.firstSeenAt ?? "unknown"}, last seen ${stats.lastSeenAt ?? "unknown"}. Pages by time:\n${stats.pages.map((page) => `- ${page.page || "(unknown)"}: ${page.visits} visit(s), ${formatDuration(page.seconds)}`).join("\n")}`,
  };
}
