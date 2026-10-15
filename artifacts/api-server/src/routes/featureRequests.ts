import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, count, desc, eq } from "drizzle-orm";
import {
  db,
  primaryDb,
  secondaryDb,
  featureRequestsTable,
  interviewerAccountsTable,
  teamsTable,
  DEFAULT_TEAM_ID,
} from "@workspace/db";
import { CreateFeatureRequestBody, UpdateFeatureRequestBody } from "@workspace/api-zod";
import {
  authenticatedInterviewerId,
  isSiteOwner,
  requestTeamId,
  requireAdmin,
  requireSiteOwner,
} from "../middlewares/adminAuth";
import { accountById } from "../lib/interviewerAccounts";
import { getTeamById, teamFilter } from "../lib/teams";

const router: IRouter = Router();

function requestResponse(row: typeof featureRequestsTable.$inferSelect, teamName?: string) {
  return {
    id: row.id,
    ...(row.teamId ? { teamId: row.teamId } : {}),
    ...(teamName ? { teamName } : {}),
    authorName: row.authorName,
    message: row.message,
    status: row.status,
    createdAt: (row.createdAt ?? new Date()).toISOString(),
  };
}

async function teamNamesById(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const collect = async (handle: typeof primaryDb) => {
    try {
      const teams = await handle.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable);
      for (const team of teams) map.set(team.id, team.name);
    } catch {
      // Teams table missing pre-migration; fall through with an empty map.
    }
  };
  await collect(primaryDb);
  const secondary = secondaryDb();
  if (secondary) await collect(secondary);
  return map;
}

// Owner reads span both instances (primary teams + all new teams). Each
// half is best-effort so one unreachable instance never blanks the inbox.
async function ownerFeatureRequests() {
  const primary = await primaryDb.select().from(featureRequestsTable).orderBy(desc(featureRequestsTable.createdAt));
  const secondary = secondaryDb();
  if (!secondary) return primary;
  try {
    const more = await secondary.select().from(featureRequestsTable).orderBy(desc(featureRequestsTable.createdAt));
    return [...primary, ...more].sort((a, b) =>
      (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
  } catch {
    return primary;
  }
}

// Every signed-in account can file a request for its team. All requests land
// in the site owner's inbox regardless of team.
router.post("/feature-requests", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CreateFeatureRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Write what you would like to see (1–2000 characters)." });
    return;
  }
  const interviewerId = authenticatedInterviewerId(req);
  const account = interviewerId ? await accountById(interviewerId) : undefined;
  if (!account) {
    res.status(401).json({ error: "Interviewer session is invalid" });
    return;
  }
  const teamId = await requestTeamId(req);
  const message = parsed.data.message.trim().slice(0, 2000);
  try {
    const [row] = await db.insert(featureRequestsTable).values({
      id: randomUUID(),
      teamId,
      authorId: account.id,
      authorName: account.displayName,
      message,
      status: "open",
    }).returning();
    if (!row) {
      res.status(500).json({ error: "Could not save the request." });
      return;
    }
    res.status(201).json(requestResponse(row));
  } catch (error) {
    req.log.error({ err: error }, "Feature request save failed");
    res.status(500).json({ error: "Could not save the request." });
  }
});

// The site owner sees every team's requests; everyone else sees only the
// requests filed by their own team (so a team can see what it already asked).
router.get("/feature-requests", requireAdmin, async (req, res): Promise<void> => {
  const interviewerId = authenticatedInterviewerId(req);
  const owner = await isSiteOwner(interviewerId);
  const teamId = await requestTeamId(req);
  try {
    const rows = owner
      ? await ownerFeatureRequests()
      : await db.select().from(featureRequestsTable)
        // teamFilter matches legacy NULL rows for the default team, so
        // nothing filed before the migration disappears.
        .where(teamFilter(featureRequestsTable.teamId, teamId))
        .orderBy(desc(featureRequestsTable.createdAt));
    const visible = rows;
    const names = owner ? await teamNamesById() : new Map<string, string>();
    res.json({
      items: visible.map((row) => requestResponse(
        row,
        row.teamId ? (names.get(row.teamId) ?? (row.teamId === DEFAULT_TEAM_ID ? "Wolverines" : row.teamId)) : undefined,
      )),
    });
  } catch (error) {
    req.log.error({ err: error }, "Feature request list failed");
    res.status(500).json({ error: "Could not load feature requests." });
  }
});

// Only the site owner resolves requests.
router.patch("/feature-requests/:requestId", requireSiteOwner, async (req, res): Promise<void> => {
  const parsed = UpdateFeatureRequestBody.safeParse(req.body);
  const requestId = typeof req.params.requestId === "string" ? req.params.requestId : "";
  if (!parsed.success || !requestId) {
    res.status(400).json({ error: "Request id and a valid status are required." });
    return;
  }
  try {
    const resolveOn = async (handle: typeof primaryDb) => (await handle.update(featureRequestsTable)
      .set({ status: parsed.data.status, updatedAt: new Date() })
      .where(eq(featureRequestsTable.id, requestId))
      .returning())[0];
    let updated = await resolveOn(primaryDb);
    if (!updated) {
      const secondary = secondaryDb();
      if (secondary) {
        try {
          updated = await resolveOn(secondary);
        } catch {
          // fall through to the 404 below
        }
      }
    }
    if (!updated) {
      res.status(404).json({ error: "Feature request not found." });
      return;
    }
    res.json(requestResponse(updated));
  } catch (error) {
    req.log.error({ err: error }, "Feature request update failed");
    res.status(500).json({ error: "Could not update the request." });
  }
});

// Site-wide stats for the owner: how many teams, people, and requests.
router.get("/site/stats", requireSiteOwner, async (_req, res): Promise<void> => {
  try {
    const readStats = async (handle: typeof primaryDb) => Promise.all([
      handle.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable),
      handle.select({
        id: interviewerAccountsTable.id,
        teamId: interviewerAccountsTable.teamId,
      }).from(interviewerAccountsTable),
      handle.select({
        teamId: featureRequestsTable.teamId,
        status: featureRequestsTable.status,
      }).from(featureRequestsTable),
    ]);
    const [primaryStats, secondaryStats] = await Promise.all([
      readStats(primaryDb),
      (async () => {
        const secondary = secondaryDb();
        if (!secondary) return [[], [], []] as unknown as Awaited<ReturnType<typeof readStats>>;
        try {
          return await readStats(secondary);
        } catch {
          return [[], [], []] as unknown as Awaited<ReturnType<typeof readStats>>;
        }
      })(),
    ]);
    const teams = [...primaryStats[0], ...secondaryStats[0]];
    const accounts = [...primaryStats[1], ...secondaryStats[1]];
    const requests = [...primaryStats[2], ...secondaryStats[2]];
    const teamNameOf = (id: string) =>
      teams.find((team) => team.id === id)?.name ?? (id === DEFAULT_TEAM_ID ? "Wolverines" : id);
    const teamIds = new Set<string>([DEFAULT_TEAM_ID]);
    for (const team of teams) teamIds.add(team.id);
    for (const account of accounts) teamIds.add(account.teamId?.trim() || DEFAULT_TEAM_ID);
    for (const request of requests) teamIds.add(request.teamId?.trim() || DEFAULT_TEAM_ID);
    const teamsById = [...teamIds].sort().map((id) => {
      const people = accounts.filter((a) => (a.teamId?.trim() || DEFAULT_TEAM_ID) === id).length;
      const mine = requests.filter((r) => (r.teamId?.trim() || DEFAULT_TEAM_ID) === id);
      return {
        teamId: id,
        teamName: teamNameOf(id),
        people,
        requests: mine.length,
        openRequests: mine.filter((r) => r.status !== "done").length,
      };
    });
    res.json({
      teams: teamIds.size,
      people: accounts.length,
      requests: requests.length,
      openRequests: requests.filter((r) => r.status !== "done").length,
      teamsById,
    });
  } catch (error) {
    (_req as { log?: { error: (o: unknown, m: string) => void } }).log?.error({ err: error }, "Site stats failed");
    res.status(500).json({ error: "Could not load site stats." });
  }
});

export default router;
