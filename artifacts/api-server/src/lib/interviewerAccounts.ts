import { randomUUID } from "node:crypto";
import { and, eq, isNull, or } from "drizzle-orm";
import { db, interviewerAccountsTable, interviewQueueTable, DEFAULT_TEAM_ID, type InterviewerAccount } from "@workspace/db";

export function normalizeInterviewerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function teamIdOrDefault(teamId?: string | null): string {
  return teamId?.trim() ? teamId : DEFAULT_TEAM_ID;
}

/** Rows belonging to `teamId`, including legacy NULL rows for the default team. */
function teamAccountFilter(teamId: string) {
  const tid = teamIdOrDefault(teamId);
  if (tid === DEFAULT_TEAM_ID) {
    return or(eq(interviewerAccountsTable.teamId, DEFAULT_TEAM_ID), isNull(interviewerAccountsTable.teamId));
  }
  return eq(interviewerAccountsTable.teamId, tid);
}

export async function syncInterviewerAccounts(labels: string[], teamId: string = DEFAULT_TEAM_ID): Promise<InterviewerAccount[]> {
  const tid = teamIdOrDefault(teamId);
  const clean = [...new Set(labels.map((label) => label.trim().replace(/\s+/g, " ")).filter(Boolean))];
  const existing = await db.select().from(interviewerAccountsTable).where(teamAccountFilter(tid));
  const byName = new Map(existing.map((account) => [account.normalizedName, account]));
  for (const displayName of clean) {
    const normalizedName = normalizeInterviewerName(displayName);
    if (!byName.has(normalizedName)) {
      const [created] = await db.insert(interviewerAccountsTable).values({
        id: randomUUID(),
        teamId: tid,
        displayName,
        normalizedName,
        passwordHash: null,
        role: "interviewer",
      }).returning();
      if (created) byName.set(normalizedName, created);
    }
  }
  return clean.map((label) => byName.get(normalizeInterviewerName(label))).filter((account): account is InterviewerAccount => Boolean(account));
}

async function getOrCreateQueueRow(teamId: string) {
  const tid = teamIdOrDefault(teamId);
  const rows = await db.select().from(interviewQueueTable).where(
    tid === DEFAULT_TEAM_ID
      ? or(eq(interviewQueueTable.teamId, DEFAULT_TEAM_ID), isNull(interviewQueueTable.teamId))
      : eq(interviewQueueTable.teamId, tid),
  ).limit(1);
  if (rows[0]) return rows[0];
  // New teams get their own queue row; id auto-increments past the legacy id=1.
  const [created] = await db.insert(interviewQueueTable).values({
    teamId: tid,
    interviewerLabels: '["Interviewer 1","Interviewer 2"]',
  }).returning();
  return created;
}

export async function updateQueueLabels(labels: string[], teamId: string = DEFAULT_TEAM_ID): Promise<InterviewerAccount[]> {
  const tid = teamIdOrDefault(teamId);
  const accounts = await syncInterviewerAccounts(labels, tid);
  const row = await getOrCreateQueueRow(tid);
  if (!row) return accounts;
  await db.update(interviewQueueTable).set({
    interviewerLabels: JSON.stringify(accounts.map((account) => account.displayName)),
    updatedAt: new Date(),
  }).where(eq(interviewQueueTable.id, row.id));
  return accounts;
}

export async function accountById(id: string): Promise<InterviewerAccount | undefined> {
  const [account] = await db.select().from(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, id)).limit(1);
  return account;
}

export async function accountByName(name: string, teamId?: string | null): Promise<InterviewerAccount | undefined> {
  const normalized = normalizeInterviewerName(name);
  if (teamId === undefined || teamId === null) {
    // Legacy global lookup (pre-migration callers); prefer default-team match.
    const [account] = await db.select().from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.normalizedName, normalized)).limit(1);
    return account;
  }
  const tid = teamIdOrDefault(teamId);
  const [account] = await db.select().from(interviewerAccountsTable)
    .where(and(eq(interviewerAccountsTable.normalizedName, normalized), teamAccountFilter(tid))).limit(1);
  // Fallback: legacy NULL row for default team when the team_id column is still migrating.
  if (!account && tid === DEFAULT_TEAM_ID) {
    const [legacy] = await db.select().from(interviewerAccountsTable)
      .where(and(eq(interviewerAccountsTable.normalizedName, normalized), isNull(interviewerAccountsTable.teamId))).limit(1);
    return legacy;
  }
  return account;
}

export async function accountIsConfigured(id: string): Promise<boolean> {
  const account = await accountById(id);
  return Boolean(account?.passwordHash);
}