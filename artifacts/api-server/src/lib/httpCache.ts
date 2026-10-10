import type { Request, Response } from "express";
import { count, max } from "drizzle-orm";
import {
  db,
  applicantsTable,
  displaySettingsTable,
  interviewQueueTable,
} from "@workspace/db";
import { teamFilter } from "./teams";

/**
 * Conditional GET for hot polls. version() runs a cheap aggregate (counts /
 * max(updated_at)) instead of the full query; its digest becomes the ETag.
 * Browsers revalidate every poll automatically (fetch uses the HTTP cache),
 * so idle intervals cost one tiny version query and zero transfer, while
 * freshness stays identical — same intervals, same data, no client changes.
 * React Query keeps showing its cached data on 304 (see customFetch).
 */
/**
 * Returns true (after sending 304) when the request's validators match tag.
 * Non-invasive alternative to sendVersioned: call it, return early on true,
 * and leave the rest of the handler untouched.
 */
export async function notModified(req: Request, res: Response, tag: string | null): Promise<boolean> {
  if (!tag) return false;
  res.set("ETag", `"${tag.replace(/"/g, "")}"`);
  // Store but always revalidate: the browser sends If-None-Match on every
  // poll and the server answers 304 while idle — no staleness, no bytes.
  res.set("Cache-Control", "private, no-cache");
  if (req.fresh) {
    res.status(304).end();
    return true;
  }
  return false;
}

export async function sendVersioned(
  req: Request,
  res: Response,
  version: () => Promise<string | null>,
  load: () => Promise<unknown>,
): Promise<void> {
  let tag: string | null = null;
  try {
    tag = await version();
  } catch {
    tag = null;
  }
  if (await notModified(req, res, tag)) return;
  res.json(await load());
}

/** Cheap applicant-list version: row count + newest update (team-scoped). */
export async function applicantVersion(teamId: string): Promise<string> {
  const [row] = await db.select({ n: count(), m: max(applicantsTable.updatedAt) })
    .from(applicantsTable)
    .where(teamFilter(applicantsTable.teamId, teamId));
  return `a${row?.n ?? 0}:${row?.m?.getTime() ?? 0}`;
}

/** Cheap queue version: queue row update + applicant aggregate. */
export async function queueVersion(teamId: string): Promise<string> {
  const [[queue], applicants] = await Promise.all([
    db.select({ u: max(interviewQueueTable.updatedAt) })
      .from(interviewQueueTable)
      .where(teamFilter(interviewQueueTable.teamId, teamId)),
    applicantVersion(teamId),
  ]);
  return `q${queue?.u?.getTime() ?? 0}|${applicants}`;
}

/** Cheap display-settings version: settings row update. */
export async function displaySettingsVersion(teamId: string): Promise<string> {
  const [row] = await db.select({ u: max(displaySettingsTable.updatedAt) })
    .from(displaySettingsTable)
    .where(teamFilter(displaySettingsTable.teamId, teamId));
  return `d${row?.u?.getTime() ?? 0}`;
}
