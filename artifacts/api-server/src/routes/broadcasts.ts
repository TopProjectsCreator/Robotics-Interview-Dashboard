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
import { requestAdminSession, requestTeamId } from "../middlewares/adminAuth";
import { presenceSessionHash } from "./presence";
import { getClientIp } from "../lib/presence";
import { pushRealtimeHint } from "../lib/realtime";
import { teamFilter } from "../lib/teams";

const router: IRouter = Router();

const DEFAULT_TTL_MINUTES = 24 * 60;
const MAX_TTL_MINUTES = 7 * 24 * 60;

const COMMAND_KINDS = ["audio-test", "audio-engine", "audio-reset", "audio-say"] as const;

function broadcastResponse(row: typeof broadcastsTable.$inferSelect) {
  return {
    id: row.id,
    message: row.message,
    kind: row.kind,
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
  const requestedKind = String((parsed.data as Record<string, unknown>).kind ?? "message").trim();
  const kind = (COMMAND_KINDS as readonly string[]).includes(requestedKind) ? requestedKind : "message";
  const targetIp = String(parsed.data.targetIp ?? "").trim().slice(0, 45);
  const ttl = typeof parsed.data.ttlMinutes === "number"
    ? Math.min(MAX_TTL_MINUTES, Math.max(5, Math.floor(parsed.data.ttlMinutes)))
    : DEFAULT_TTL_MINUTES;
  try {
    const teamId = await requestTeamId(req);
    const [created] = await db
      .insert(broadcastsTable)
      .values({
        id: randomUUID(),
        teamId,
        message,
        kind,
        targetIp,
        createdBy: presenceSessionHash(requestAdminSession(req)).slice(0, 12),
        expiresAt: new Date(Date.now() + ttl * 60 * 1000),
      })
      .returning();
    pushRealtimeHint("broadcasts", "INSERT");
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
    const teamId = await requestTeamId(req);
    const rows = await db
      .select({
        id: broadcastsTable.id,
        message: broadcastsTable.message,
        kind: broadcastsTable.kind,
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
          teamFilter(broadcastsTable.teamId, teamId),
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

// Public command feed for the big screen, which cannot log in. Only silent
// display commands are listed here (never coordinator popups). The display
// tracks executed ids locally, so no session or ack is needed.
router.get("/broadcasts/commands", async (req, res): Promise<void> => {
  try {
    const now = new Date();
    // ?eventPassword scopes the public display to that team; otherwise the
    // signed-in user's team, otherwise default (current team safe).
    let teamId = await requestTeamId(req);
    const commandsCode = typeof req.query.eventPassword === "string" ? req.query.eventPassword : "";
    if (commandsCode.trim()) {
      try {
        const { findTeamByCode } = await import("../lib/teams");
        const team = await findTeamByCode(commandsCode);
        if (team) teamId = team.id;
      } catch {
        // fall back
      }
    }
    const rows = await db
      .select({
        id: broadcastsTable.id,
        message: broadcastsTable.message,
        kind: broadcastsTable.kind,
        targetIp: broadcastsTable.targetIp,
        createdAt: broadcastsTable.createdAt,
        expiresAt: broadcastsTable.expiresAt,
      })
      .from(broadcastsTable)
      .where(
        and(
          teamFilter(broadcastsTable.teamId, teamId),
          gt(broadcastsTable.expiresAt, now),
          or(
            eq(broadcastsTable.kind, "audio-test"),
            eq(broadcastsTable.kind, "audio-engine"),
            eq(broadcastsTable.kind, "audio-reset"),
            eq(broadcastsTable.kind, "audio-say"),
          ),
        ),
      )
      .orderBy(desc(broadcastsTable.createdAt))
      .limit(20);
    res.json(GetMyBroadcastsResponse.parse({ items: rows.map(broadcastResponse) }));
  } catch (error) {
    req.log.error({ err: error }, "Broadcast commands failed");
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
    // Acks are per-session, but only ack broadcasts from the requester's own
    // team so one team cannot consume another team's popups.
    const teamId = await requestTeamId(req);
    const [broadcast] = await db
      .select({ id: broadcastsTable.id })
      .from(broadcastsTable)
      .where(and(eq(broadcastsTable.id, broadcastId), teamFilter(broadcastsTable.teamId, teamId)))
      .limit(1);
    if (!broadcast) {
      res.status(404).json({ error: "Broadcast not found" });
      return;
    }
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
