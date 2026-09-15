import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { broadcastAcksTable, broadcastsTable, db } from "@workspace/db";
import {
  AckBroadcastResponse,
  GetMyBroadcastsResponse,
  PostBroadcastBody,
  PostBroadcastResponse,
} from "@workspace/api-zod";
import { requestAdminSession } from "../middlewares/adminAuth";
import { presenceSessionHash } from "./presence";
import { getClientIp } from "../lib/presence";

const router: IRouter = Router();

const DEFAULT_TTL_MINUTES = 24 * 60;
const MAX_TTL_MINUTES = 7 * 24 * 60;

function broadcastResponse(row: typeof broadcastsTable.$inferSelect) {
  return {
    id: row.id,
    message: row.message,
    targetIp: row.targetIp,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

router.post("/broadcasts", async (req, res): Promise<void> => {
  const parsed = PostBroadcastBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const message = parsed.data.message.trim().slice(0, 500);
  if (!message) {
    res.status(400).json({ error: "Message is required" });
    return;
  }
  const targetIp = String(parsed.data.targetIp ?? "").trim().slice(0, 45);
  const ttl = typeof parsed.data.ttlMinutes === "number"
    ? Math.min(MAX_TTL_MINUTES, Math.max(5, Math.floor(parsed.data.ttlMinutes)))
    : DEFAULT_TTL_MINUTES;
  try {
    const [created] = await db
      .insert(broadcastsTable)
      .values({
        id: randomUUID(),
        message,
        targetIp,
        createdBy: presenceSessionHash(requestAdminSession(req)).slice(0, 12),
        expiresAt: new Date(Date.now() + ttl * 60 * 1000),
      })
      .returning();
    res.status(201).json(PostBroadcastResponse.parse(broadcastResponse(created)));
  } catch (error) {
    req.log.error({ err: error }, "Broadcast create failed");
    res.status(503).json({ error: "Broadcast unavailable" });
  }
});

router.get("/broadcasts/mine", async (req, res): Promise<void> => {
  const hash = presenceSessionHash(requestAdminSession(req));
  if (!hash) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const now = new Date();
    const ip = getClientIp(req);
    const rows = await db
      .select({
        id: broadcastsTable.id,
        message: broadcastsTable.message,
        targetIp: broadcastsTable.targetIp,
        createdAt: broadcastsTable.createdAt,
        expiresAt: broadcastsTable.expiresAt,
      })
      .from(broadcastsTable)
      .leftJoin(
        broadcastAcksTable,
        and(
          eq(broadcastAcksTable.broadcastId, broadcastsTable.id),
          eq(broadcastAcksTable.sessionHash, hash),
        ),
      )
      .where(
        and(
          gt(broadcastsTable.expiresAt, now),
          or(eq(broadcastsTable.targetIp, ""), eq(broadcastsTable.targetIp, ip)),
          isNull(broadcastAcksTable.sessionHash),
        ),
      )
      .orderBy(desc(broadcastsTable.createdAt));
    res.json(GetMyBroadcastsResponse.parse({ items: rows.map(broadcastResponse) }));
  } catch (error) {
    req.log.error({ err: error }, "Broadcast list failed");
    res.status(503).json({ error: "Broadcast unavailable" });
  }
});

router.post("/broadcasts/:broadcastId/ack", async (req, res): Promise<void> => {
  const hash = presenceSessionHash(requestAdminSession(req));
  if (!hash) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const broadcastId = String(req.params.broadcastId ?? "");
  if (!broadcastId) {
    res.status(400).json({ error: "Broadcast id is required" });
    return;
  }
  try {
    await db
      .insert(broadcastAcksTable)
      .values({ broadcastId, sessionHash: hash })
      .onConflictDoNothing();
    res.json(AckBroadcastResponse.parse({ acked: true }));
  } catch (error) {
    req.log.error({ err: error }, "Broadcast ack failed");
    res.status(503).json({ error: "Broadcast unavailable" });
  }
});

export default router;
