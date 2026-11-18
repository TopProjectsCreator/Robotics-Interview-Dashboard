import type { Request } from "express";
import { eq } from "drizzle-orm";
import { currentInstance, db, interviewerAccountsTable, type InterviewerAccount } from "@workspace/db";

// A WeakMap avoids serializing password hashes or retaining requests after
// completion. Cache promises (including absence/failure) to coalesce consumers.
const accounts = new WeakMap<Request, Map<string, Promise<InterviewerAccount | undefined>>>();

export function requestAccount(req: Request, id: string): Promise<InterviewerAccount | undefined> {
  let entries = accounts.get(req);
  if (!entries) {
    entries = new Map();
    accounts.set(req, entries);
  }
  const key = `${currentInstance()}\0${id}`;
  let pending = entries.get(key);
  if (!pending) {
    pending = db.select().from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.id, id)).limit(1)
      .then(([account]) => account);
    entries.set(key, pending);
  }
  return pending;
}
