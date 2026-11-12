import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import { db, pool, interviewerAccountsTable, presenceHeartbeatsTable } from "@workspace/db";
import { GetPresenceStatsResponse, GetPresenceResponse, hasPermission, KickPresenceBody, KickPresenceResponse, PostPresenceHeartbeatBody, PostPresenceHeartbeatResponse } from "@workspace/api-zod";
import { authenticatedInterviewerId, isRevokedAdminSession, isValidAdminSession, requestAdminSession, requestTeamId, requireCoordinator } from "../middlewares/adminAuth";
import { closeOpenVisits, geoLookup, getClientIp, getAccountStats, rotatePageVisit } from "../lib/presence";
import { teamFilter, teamSqlCondition } from "../lib/teams";
import { workspaceIdentityForPath, safeWorkspaceName, BUILT_IN_WORKSPACE_KEYS } from "../lib/workspaceUsage";
import { finalizeStaleWorkspaceVisits, recordWorkspaceActivity } from "../lib/workspaceUsageTracking";
import { GetWorkspaceUsageQueryParams, GetWorkspaceUsageResponse } from "@workspace/api-zod";
import { readWorkspaceVisibility, userCanSeeWorkspace } from "../lib/workspaceAccess";
import { accountById } from "../lib/interviewerAccounts";
import { permissionsForAccount } from "../lib/teamRoles";

const router: IRouter = Router();

const ONLINE_WINDOW_MS = 120 * 1000;
const PRUNE_AFTER_MS = 10 * 60 * 1000;
const BUILT_IN_WORKSPACE_NAMES = {
  interview: "Interview",
  chat: "Chat",
  parts: "Parts",
  cad: "CAD",
  code: "Code",
} as const;

export function presenceSessionHash(session: string | undefined): string {
  if (typeof session !== "string" || !session) return "";
  return createHash("sha256").update(session).digest("hex");
}

/** Look up display names for a batch of account ids (team-scoped best effort). */
export async function accountNamesById(ids: Iterable<string>, teamId: string): Promise<Map<string, string>> {
  const unique = [...new Set([...ids].filter(Boolean))];
  if (unique.length === 0) return new Map();
  try {
    const rows = await db
      .select({ id: interviewerAccountsTable.id, displayName: interviewerAccountsTable.displayName })
      .from(interviewerAccountsTable)
      .where(and(inArray(interviewerAccountsTable.id, unique), teamFilter(interviewerAccountsTable.teamId, teamId)));
    return new Map(rows.map((row) => [row.id, row.displayName]));
  } catch {
    // Names are a display nicety; presence still works without them.
    return new Map();
  }
}

const UNKNOWN_USER_LABEL = "Unknown user";

export async function deletePresenceHeartbeat(session: string | undefined): Promise<void> {
  const hash = presenceSessionHash(session);
  if (!hash) return;
  try {
    await db.delete(presenceHeartbeatsTable).where(eq(presenceHeartbeatsTable.sessionHash, hash));
  } catch {
    // Presence cleanup is best-effort; stale rows prune themselves.
  }
  await closeOpenVisits(hash);
}

async function pruneStale(): Promise<void> {
  try {
    await db
      .delete(presenceHeartbeatsTable)
      .where(lt(presenceHeartbeatsTable.updatedAt, new Date(Date.now() - PRUNE_AFTER_MS)));
  } catch {
    // Best-effort.
  }
}

async function requirePresenceSession(req: import("express").Request, res: import("express").Response): Promise<string | null> {
  const session = requestAdminSession(req);
  if (!isValidAdminSession(session)) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  if (await isRevokedAdminSession(session)) {
    res.status(401).json({ error: "Session revoked" });
    return null;
  }
  const hash = presenceSessionHash(session);
  if (!hash) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return hash;
}

router.post("/presence/heartbeat", async (req, res): Promise<void> => {
  const hash = await requirePresenceSession(req, res);
  if (!hash) return;
  const ip = getClientIp(req);
  const userAgent = String(req.get("user-agent") ?? "").slice(0, 300);
  const parsed = PostPresenceHeartbeatBody.safeParse(req.body ?? {});
  const rawPage = parsed.success && typeof parsed.data.page === "string" ? parsed.data.page : "";
  const page = /^\/[a-z-]*\/?$/.test(rawPage) ? rawPage.slice(0, 32) : "";
  const rawNotify = parsed.success ? String((parsed.data as Record<string, unknown>).notifyPermission ?? "") : "";
  const notifyPermission = ["granted", "denied", "default", "unsupported"].includes(rawNotify) ? rawNotify : "";
  try {
    await pruneStale();
    const teamId = await requestTeamId(req);
    const accountId = authenticatedInterviewerId(req) ?? "";
    const [existing] = await db
      .select()
      .from(presenceHeartbeatsTable)
      .where(eq(presenceHeartbeatsTable.sessionHash, hash));
    let city = existing?.city ?? "";
    let region = existing?.region ?? "";
    let country = existing?.country ?? "";
    if (!existing || existing.ip !== ip || (!city && !country)) {
      const geo = await geoLookup(ip);
      city = geo.city;
      region = geo.region;
      country = geo.country;
    }
    const now = new Date();
    const existingNotify = existing?.notifyPermission ?? "";
    // Only overwrite a known permission with another known one — a heartbeat
    // sent before the client reports permission must not wipe "granted".
    const nextNotify = notifyPermission || existingNotify;
    await db
      .insert(presenceHeartbeatsTable)
      .values({ sessionHash: hash, teamId, ip, accountId, userAgent, city, region, country, page, notifyPermission: nextNotify, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: presenceHeartbeatsTable.sessionHash,
        set: { teamId, ip, accountId, userAgent, city, region, country, page, notifyPermission: nextNotify, updatedAt: now },
      });
    await rotatePageVisit(hash, ip, page, existing?.page ?? "", teamId, accountId);
    try {
      let identity = parsed.success ? workspaceIdentityForPath(rawPage) : null;
      if (identity) {
        const account = accountId ? await accountById(accountId) : undefined;
        if (!account) {
          identity = null;
        } else {
          const permissions = await permissionsForAccount(account);
          if (identity.workspaceKey === "custom") {
            if (!hasPermission(permissions, "customWorkspaces.view")) {
              identity = null;
            } else {
              const access = await pool.query(
                `select "id" from "custom_workspaces"
                  where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
                    and (
                      ("status" = 'published' and (
                        "access_mode" = 'team'
                        or ("access_mode" = 'owner' and "created_by" = $3)
                        or ("access_mode" = 'selected' and "allowed_interviewer_ids" ? $3)
                      ))
                      or ("status" = 'draft' and "created_by" = $3)
                    )
                  limit 1`,
                [identity.customWorkspaceId, teamId, accountId],
              );
              if (!access.rowCount) identity = null;
            }
          } else {
            const visibility = await readWorkspaceVisibility(teamId);
            if (
              !hasPermission(permissions, `${identity.workspaceKey}.view`) ||
              !userCanSeeWorkspace(visibility, account.id, account.role, identity.workspaceKey)
            ) {
              identity = null;
            }
          }
        }
      }
      await recordWorkspaceActivity({
        sessionHash: hash,
        teamId,
        identity,
        visible: parsed.success && parsed.data.visible === true,
        now,
      });
    } catch (error) {
      req.log.warn({ err: error }, "Workspace usage tracking failed");
    }
    const online = await db
      .select({ sessionHash: presenceHeartbeatsTable.sessionHash })
      .from(presenceHeartbeatsTable)
      .where(
        and(
          teamFilter(presenceHeartbeatsTable.teamId, teamId),
          gt(presenceHeartbeatsTable.updatedAt, new Date(Date.now() - ONLINE_WINDOW_MS)),
        ),
      );
    res.json(PostPresenceHeartbeatResponse.parse({ onlineCount: online.length }));
  } catch (error) {
    req.log.error({ err: error }, "Presence heartbeat failed");
    res.status(503).json({ error: "Presence unavailable" });
  }
});

router.get("/dashboard/workspace-usage", requireCoordinator, async (req, res): Promise<void> => {
  const params = GetWorkspaceUsageQueryParams.safeParse({
    from: typeof req.query.from === "string" ? req.query.from : "",
    to: typeof req.query.to === "string" ? req.query.to : "",
  });
  if (!params.success) {
    res.status(400).json({ error: "Choose valid start and end dates." });
    return;
  }
  const { from, to } = params.data;
  const fromDate = new Date(`${from}T00:00:00.000Z`);
  const toDate = new Date(`${to}T00:00:00.000Z`);
  if (
    !Number.isFinite(fromDate.getTime()) ||
    !Number.isFinite(toDate.getTime()) ||
    fromDate.toISOString().slice(0, 10) !== from ||
    toDate.toISOString().slice(0, 10) !== to ||
    fromDate > toDate ||
    toDate.getTime() - fromDate.getTime() > 365 * 24 * 60 * 60 * 1000
  ) {
    res.status(400).json({ error: "Choose a date range of 366 days or less." });
    return;
  }

  const teamId = await requestTeamId(req);
  try {
    await finalizeStaleWorkspaceVisits(teamId);
    const endExclusive = new Date(toDate.getTime() + 24 * 60 * 60 * 1000);
    const [customRows, activityRows, visitRows, overallSessions] = await Promise.all([
      pool.query<{ id: string; title: string }>(
        `select "id", "title" from "custom_workspaces"
          where ${teamSqlCondition('"team_id"', "$1")}
          order by "created_at" asc, "id" asc`,
        [teamId],
      ),
      pool.query<{ workspaceKey: string; customWorkspaceId: string | null; activeSeconds: string }>(
        `select "workspace_key" as "workspaceKey",
                "custom_workspace_id" as "customWorkspaceId",
                coalesce(sum("active_seconds"), 0)::text as "activeSeconds"
           from "workspace_usage_activity"
          where ${teamSqlCondition('"team_id"', "$1")}
            and ("workspace_key" <> 'custom' or exists (
              select 1 from "custom_workspaces" cw
               where cw."id" = "workspace_usage_activity"."custom_workspace_id"
                 and ${teamSqlCondition('cw."team_id"', "$1")}
            ))
            and "activity_date" >= $2::date and "activity_date" <= $3::date
          group by "workspace_key", "custom_workspace_id"`,
        [teamId, from, to],
      ),
      pool.query<{ workspaceKey: string; customWorkspaceId: string | null; visits: string; distinctSessions: string }>(
        `select "workspace_key" as "workspaceKey",
                "custom_workspace_id" as "customWorkspaceId",
                count(*)::text as "visits",
                count(distinct "session_hash")::text as "distinctSessions"
           from "workspace_usage_visits"
          where ${teamSqlCondition('"team_id"', "$1")}
            and ("workspace_key" <> 'custom' or exists (
              select 1 from "custom_workspaces" cw
               where cw."id" = "workspace_usage_visits"."custom_workspace_id"
                 and ${teamSqlCondition('cw."team_id"', "$1")}
            ))
            and "entered_at" >= $2::timestamptz and "entered_at" < $3::timestamptz
          group by "workspace_key", "custom_workspace_id"`,
        [teamId, fromDate, endExclusive],
      ),
      pool.query<{ count: string }>(
        `select count(distinct "session_hash")::text as count
           from "workspace_usage_visits"
          where ${teamSqlCondition('"team_id"', "$1")}
            and ("workspace_key" <> 'custom' or exists (
              select 1 from "custom_workspaces" cw
               where cw."id" = "workspace_usage_visits"."custom_workspace_id"
                 and ${teamSqlCondition('cw."team_id"', "$1")}
            ))
            and "entered_at" >= $2::timestamptz and "entered_at" < $3::timestamptz`,
        [teamId, fromDate, endExclusive],
      ),
    ]);
    const activityByWorkspace = new Map<string, number>();
    for (const row of activityRows.rows) {
      const key = row.workspaceKey === "custom"
        ? `custom:${row.customWorkspaceId ?? ""}`
        : `builtin:${row.workspaceKey}`;
      activityByWorkspace.set(key, Number(row.activeSeconds) || 0);
    }
    const countsByWorkspace = new Map<string, { visits: number; distinctSessions: number }>();
    for (const row of visitRows.rows) {
      const key = row.workspaceKey === "custom"
        ? `custom:${row.customWorkspaceId ?? ""}`
        : `builtin:${row.workspaceKey}`;
      countsByWorkspace.set(key, {
        visits: Number(row.visits) || 0,
        distinctSessions: Number(row.distinctSessions) || 0,
      });
    }
    const workspaces = [
      ...BUILT_IN_WORKSPACE_KEYS.map((key) => {
        const id = `builtin:${key}`;
        const counts = countsByWorkspace.get(id) ?? { visits: 0, distinctSessions: 0 };
        return {
          id: key,
          type: "builtIn" as const,
          name: BUILT_IN_WORKSPACE_NAMES[key],
          activeSeconds: activityByWorkspace.get(id) ?? 0,
          ...counts,
        };
      }),
      ...customRows.rows.map((workspace) => {
        const id = `custom:${workspace.id}`;
        const counts = countsByWorkspace.get(id) ?? { visits: 0, distinctSessions: 0 };
        return {
          id: workspace.id,
          type: "custom" as const,
          name: safeWorkspaceName(workspace.title),
          activeSeconds: activityByWorkspace.get(id) ?? 0,
          ...counts,
        };
      }),
    ].sort((left, right) => right.activeSeconds - left.activeSeconds || left.name.localeCompare(right.name));
    const dailyRows = await pool.query<{ date: string; activeSeconds: string }>(
      `select "activity_date"::text as date,
              coalesce(sum("active_seconds"), 0)::text as "activeSeconds"
         from "workspace_usage_activity"
        where ${teamSqlCondition('"team_id"', "$1")}
          and ("workspace_key" <> 'custom' or exists (
            select 1 from "custom_workspaces" cw
             where cw."id" = "workspace_usage_activity"."custom_workspace_id"
               and ${teamSqlCondition('cw."team_id"', "$1")}
          ))
          and "activity_date" >= $2::date and "activity_date" <= $3::date
        group by "activity_date"
        order by "activity_date"`,
      [teamId, from, to],
    );
    const dailyActivity = new Map(dailyRows.rows.map((row) => [row.date, Number(row.activeSeconds) || 0]));
    const daily = [];
    for (let day = fromDate.getTime(); day <= toDate.getTime(); day += 24 * 60 * 60 * 1000) {
      const date = new Date(day).toISOString().slice(0, 10);
      daily.push({ date, activeSeconds: dailyActivity.get(date) ?? 0 });
    }
    const response = {
      from,
      to,
      totalActiveSeconds: workspaces.reduce((sum, workspace) => sum + workspace.activeSeconds, 0),
      totalVisits: workspaces.reduce((sum, workspace) => sum + workspace.visits, 0),
      distinctSessions: Number(overallSessions.rows[0]?.count) || 0,
      workspaces,
      daily,
    };
    res.json(GetWorkspaceUsageResponse.parse(response));
  } catch (error) {
    req.log.error({ err: error }, "Workspace usage summary failed");
    res.status(503).json({ error: "Workspace usage is temporarily unavailable." });
  }
});

router.get("/presence", async (req, res): Promise<void> => {
  const hash = await requirePresenceSession(req, res);
  if (!hash) return;
  try {
    await pruneStale();
    const teamId = await requestTeamId(req);
    const rows = await db
      .select()
      .from(presenceHeartbeatsTable)
      .where(
        and(
          teamFilter(presenceHeartbeatsTable.teamId, teamId),
          gt(presenceHeartbeatsTable.updatedAt, new Date(Date.now() - ONLINE_WINDOW_MS)),
        ),
      )
      .orderBy(desc(presenceHeartbeatsTable.updatedAt));
    const names = await accountNamesById(rows.map((row) => row.accountId), teamId);
    res.json(
      GetPresenceResponse.parse({
        onlineCount: rows.length,
        entries: rows.map((row) => ({
          userId: row.accountId,
          name: (row.accountId && names.get(row.accountId)) || UNKNOWN_USER_LABEL,
          city: row.city,
          region: row.region,
          country: row.country,
          page: row.page,
          lastSeenAt: row.updatedAt.toISOString(),
          isCurrent: row.sessionHash === hash,
          notifyPermission: row.notifyPermission ?? "",
        })),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Presence list failed");
    res.status(503).json({ error: "Presence unavailable" });
  }
});

router.get("/presence/stats", async (req, res): Promise<void> => {
  const hash = await requirePresenceSession(req, res);
  if (!hash) return;
  const userId = String(req.query.userId ?? "").trim().slice(0, 64);
  if (!userId) {
    res.status(400).json({ error: "Query parameter userId is required" });
    return;
  }
  try {
    const teamId = await requestTeamId(req);
    const names = await accountNamesById([userId], teamId);
    const name = names.get(userId) ?? UNKNOWN_USER_LABEL;
    const stats = await getAccountStats(userId, teamId);
    const online = await db
      .select({ notifyPermission: presenceHeartbeatsTable.notifyPermission })
      .from(presenceHeartbeatsTable)
      .where(
        and(
          teamFilter(presenceHeartbeatsTable.teamId, teamId),
          eq(presenceHeartbeatsTable.accountId, userId),
          gt(presenceHeartbeatsTable.updatedAt, new Date(Date.now() - ONLINE_WINDOW_MS)),
        ),
      );
    let notifyGranted = 0;
    let notifyDenied = 0;
    let notifyUnknown = 0;
    for (const session of online) {
      if (session.notifyPermission === "granted") notifyGranted += 1;
      else if (session.notifyPermission === "denied" || session.notifyPermission === "default") notifyDenied += 1;
      else notifyUnknown += 1;
    }
    res.json(GetPresenceStatsResponse.parse({ ...stats, name, notifyGranted, notifyDenied, notifyUnknown }));
  } catch (error) {
    req.log.error({ err: error }, "Presence stats failed");
    res.status(503).json({ error: "Presence unavailable" });
  }
});

router.post("/presence/kick", async (req, res): Promise<void> => {
  const hash = await requirePresenceSession(req, res);
  if (!hash) return;
  const parsed = KickPresenceBody.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = parsed.data.userId.trim().slice(0, 64);
  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }
  const ownAccountId = authenticatedInterviewerId(req);
  if (ownAccountId && ownAccountId === userId) {
    res.status(400).json({ error: "Cannot kick your own session" });
    return;
  }
  if (req.body && typeof req.body === "object" && "ip" in (req.body as Record<string, unknown>)) {
    res.status(400).json({ error: "Use { userId }, not { ip }" });
    return;
  }
  try {
    // Kick only sessions belonging to the requester's team; victims are
    // matched by account *and* team so one team cannot boot another's members.
    const teamId = await requestTeamId(req);
    const names = await accountNamesById([userId], teamId);
    const displayName = names.get(userId) ?? UNKNOWN_USER_LABEL;
    const victims = await db
      .select({ sessionHash: presenceHeartbeatsTable.sessionHash })
      .from(presenceHeartbeatsTable)
      .where(
        and(
          teamFilter(presenceHeartbeatsTable.teamId, teamId),
          eq(presenceHeartbeatsTable.accountId, userId),
        ),
      );
    const hashes = victims.map((r) => r.sessionHash).filter((h) => h && h !== hash);
    if (hashes.length === 0) {
      res.status(404).json({ error: "No online session found for that person" });
      return;
    }
    for (const victimHash of hashes) {
      await db.insert((await import("@workspace/db")).revokedSessionsTable).values({
        tokenHash: victimHash,
        expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
      }).onConflictDoNothing();
      await db.delete(presenceHeartbeatsTable).where(eq(presenceHeartbeatsTable.sessionHash, victimHash));
      const { closeOpenVisits } = await import("../lib/presence");
      await closeOpenVisits(victimHash);
    }
    res.json(KickPresenceResponse.parse({ kicked: hashes.length, userId, name: displayName }));
  } catch (error) {
    req.log.error({ err: error }, "Presence kick failed");
    res.status(503).json({ error: "Presence unavailable" });
  }
});

export default router;
