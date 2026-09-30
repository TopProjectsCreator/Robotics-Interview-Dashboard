import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, interviewerAccountsTable, interviewQueueTable, type InterviewerAccount } from "@workspace/db";

export function normalizeInterviewerName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function syncInterviewerAccounts(labels: string[]): Promise<InterviewerAccount[]> {
  const clean = [...new Set(labels.map((label) => label.trim().replace(/\s+/g, " ")).filter(Boolean))];
  const existing = await db.select().from(interviewerAccountsTable);
  const byName = new Map(existing.map((account) => [account.normalizedName, account]));
  for (const displayName of clean) {
    const normalizedName = normalizeInterviewerName(displayName);
    if (!byName.has(normalizedName)) {
      const [created] = await db.insert(interviewerAccountsTable).values({
        id: randomUUID(),
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

export async function updateQueueLabels(labels: string[]): Promise<InterviewerAccount[]> {
  const accounts = await syncInterviewerAccounts(labels);
  await db.insert(interviewQueueTable).values({
    id: 1,
    interviewerLabels: JSON.stringify(accounts.map((account) => account.displayName)),
  }).onConflictDoUpdate({
    target: interviewQueueTable.id,
    set: { interviewerLabels: JSON.stringify(accounts.map((account) => account.displayName)), updatedAt: new Date() },
  });
  return accounts;
}

export async function accountById(id: string): Promise<InterviewerAccount | undefined> {
  const [account] = await db.select().from(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, id)).limit(1);
  return account;
}

export async function accountByName(name: string): Promise<InterviewerAccount | undefined> {
  const [account] = await db.select().from(interviewerAccountsTable)
    .where(eq(interviewerAccountsTable.normalizedName, normalizeInterviewerName(name))).limit(1);
  return account;
}

export async function accountIsConfigured(id: string): Promise<boolean> {
  const account = await accountById(id);
  return Boolean(account?.passwordHash);
}