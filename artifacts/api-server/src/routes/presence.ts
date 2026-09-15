import { createHash } from "node:crypto";
import { Router, type IRouter } from "express";
import { desc, eq, gt, lt } from "drizzle-orm";
import { db, presenceHeartbeatsTable } from "@workspace/db";
import { GetPresenceResponse, PostPresenceHeartbeatBody, PostPresenceHeartbeatResponse } from "@workspace/api-zod";
import { requestAdminSession } from "../middlewares/adminAuth";
import { geoLookup, getClientIp } from "../lib/presence";

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

router.post("/presence/heartbeat", async (req, res): Promise<void> => {
  const session = requestAdminSession(req);
  const hash = presenceSessionHash(session);
  if (!hash) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const ip = getClientIp(req);
  const userAgent = String(req.get("user-agent") ?? "").slice(0, 300);
  const parsed = PostPresenceHeartbeatBody.safeParse(req.body ?? {});
  const rawPage = parsed.success && typeof parsed.data.page === "string" ? parsed.data.page : "";
  const page = /^\/[a-z-]*\/?$/.test(rawPage) ? rawPage.slice(0, 32) : "";
  try {
    await pruneStale();
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
    await db
      .insert(presenceHeartbeatsTable)
      .values({ sessionHash: hash, ip, userAgent, city, region, country, page, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: presenceHeartbeatsTable.sessionHash,
        set: { ip, userAgent, city, region, country, page, updatedAt: now },
      });
    const online = await db
      .select({ sessionHash: presenceHeartbeatsTable.sessionHash })
      .from(presenceHeartbeatsTable)
      .where(gt(presenceHeartbeatsTable.updatedAt, new Date(Date.now() - ONLINE_WINDOW_MS)));
    res.json(PostPresenceHeartbeatResponse.parse({ onlineCount: online.length }));
  } catch (error) {
    req.log.error({ err: error }, "Presence heartbeat failed");
    res.status(503).json({ error: "Presence unavailable" });
  }
});

router.get("/presence", async (req, res): Promise<void> => {
  const session = requestAdminSession(req);
  const hash = presenceSessionHash(session);
  if (!hash) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    await pruneStale();
    const rows = await db
      .select()
      .from(presenceHeartbeatsTable)
      .where(gt(presenceHeartbeatsTable.updatedAt, new Date(Date.now() - ONLINE_WINDOW_MS)))
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
        })),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Presence list failed");
    res.status(503).json({ error: "Presence unavailable" });
  }
});

export default router;
