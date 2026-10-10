import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, gt, lt } from "drizzle-orm";
import { db, presenceHeartbeatsTable } from "@workspace/db";
import { GetPresenceStatsResponse, GetPresenceResponse, KickPresenceBody, KickPresenceResponse, PostPresenceHeartbeatBody, PostPresenceHeartbeatResponse } from "@workspace/api-zod";
import { isRevokedAdminSession, isValidAdminSession, requestAdminSession, requestTeamId } from "../middlewares/adminAuth";
import { closeOpenVisits, geoLookup, getClientIp, getIpStats, rotatePageVisit } from "../lib/presence";
import { teamFilter } from "../lib/teams";

const router: IRouter = Router();

const ONLINE_WINDOW_MS = 120 * 1000;
const PRUNE_AFTER_MS = 10 * 60 * 1000;

export function presenceSessionHash(session: string | undefined): string {
  if (typeof session !== "string" || !session) return "";
  return createHash("sha256").update(session).digest("hex");
}

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
      .values({ sessionHash: hash, teamId, ip, userAgent, city, region, country, page, notifyPermission: nextNotify, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: presenceHeartbeatsTable.sessionHash,
        set: { teamId, ip, userAgent, city, region, country, page, notifyPermission: nextNotify, updatedAt: now },
      });
    await rotatePageVisit(hash, ip, page, existing?.page ?? "", teamId);
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
    res.json(
      GetPresenceResponse.parse({
        onlineCount: rows.length,
        entries: rows.map((row) => ({
          ip: row.ip,
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
  const ip = String(req.query.ip ?? "").trim().slice(0, 45);
  if (!ip) {
    res.status(400).json({ error: "Query parameter ip is required" });
    return;
  }
  try {
    const teamId = await requestTeamId(req);
    const stats = await getIpStats(ip, teamId);
    const online = await db
      .select({ notifyPermission: presenceHeartbeatsTable.notifyPermission })
      .from(presenceHeartbeatsTable)
      .where(
        and(
          teamFilter(presenceHeartbeatsTable.teamId, teamId),
          eq(presenceHeartbeatsTable.ip, ip),
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
    res.json(GetPresenceStatsResponse.parse({ ...stats, notifyGranted, notifyDenied, notifyUnknown }));
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
  const ip = parsed.data.ip.trim().slice(0, 45);
  if (!ip) {
    res.status(400).json({ error: "ip is required" });
    return;
  }
  if (req.body && typeof req.body === "object" && "targetIp" in (req.body as Record<string, unknown>)) {
    res.status(400).json({ error: "Use { ip }, not { targetIp }" });
    return;
  }
  try {
    // Kick only sessions belonging to the requester's team; victims are
    // matched by IP *and* team so one team cannot boot another's devices.
    const teamId = await requestTeamId(req);
    const victims = await db
      .select({ sessionHash: presenceHeartbeatsTable.sessionHash })
      .from(presenceHeartbeatsTable)
      .where(
        and(
          teamFilter(presenceHeartbeatsTable.teamId, teamId),
          eq(presenceHeartbeatsTable.ip, ip),
        ),
      );
    const hashes = victims.map((r) => r.sessionHash).filter((h) => h && h !== hash);
    if (hashes.length === 0) {
      const selfOnly = victims.some((r) => r.sessionHash === hash);
      res.status(selfOnly ? 400 : 404).json({ error: selfOnly ? "Cannot kick your own session" : "No online session found for that IP" });
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
    res.json(KickPresenceResponse.parse({ kicked: hashes.length, ip }));
  } catch (error) {
    req.log.error({ err: error }, "Presence kick failed");
    res.status(503).json({ error: "Presence unavailable" });
  }
});

export default router;
