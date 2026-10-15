import { randomUUID } from "node:crypto";
import type { Request } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, pageVisitsTable } from "@workspace/db";

export type GeoInfo = { city: string; region: string; country: string };

const geoCache = new Map<string, { at: number; geo: GeoInfo }>();
const GEO_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isPrivateIp(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const octets = v4.slice(1, 5).map(Number);
    if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
    const [a, b] = octets;
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::ffff:127.0.0.1") return true;
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  if (lower.startsWith("fe80:")) return true;
  // Non-standard numeric spellings: don't trust, treat as private.
  if (/^[\dxabcdef.:]+$/i.test(ip)) return true;
  return false;
}

export function getClientIp(req: Request): string {
  const forwarded = req.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const raw = req.ip ?? req.socket?.remoteAddress ?? "unknown";
  const cleaned = raw.replace(/^::ffff:/, "");
  return cleaned.slice(0, 45) || "unknown";
}

export type IpPageStat = { page: string; visits: number; seconds: number };

export type IpStats = {
  ip: string;
  totalSeconds: number;
  sessionCount: number;
  visitCount: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  pages: IpPageStat[];
};

export async function rotatePageVisit(
  sessionHash: string,
  ip: string,
  page: string,
  storedPage: string,
  teamId?: string | null,
): Promise<void> {
  try {
    if (storedPage !== page) {
      await db
        .update(pageVisitsTable)
        .set({ exitedAt: new Date() })
        .where(and(eq(pageVisitsTable.sessionHash, sessionHash), isNull(pageVisitsTable.exitedAt)));
      if (page) {
        const trimmedTeam = teamId?.trim();
        await db.insert(pageVisitsTable).values({
          id: randomUUID(),
          ...(trimmedTeam ? { teamId: trimmedTeam } : {}),
          sessionHash,
          ip,
          page,
        });
      }
    }
  } catch {
    // Visit tracking is best-effort; heartbeat must not fail.
  }
}

export async function closeOpenVisits(sessionHash: string): Promise<void> {
  try {
    await db
      .update(pageVisitsTable)
      .set({ exitedAt: new Date() })
      .where(and(eq(pageVisitsTable.sessionHash, sessionHash), isNull(pageVisitsTable.exitedAt)));
  } catch {
    // Best-effort.
  }
}

export async function getIpStats(ip: string, teamId?: string | null): Promise<IpStats> {
  const now = Date.now();
  const conditions = [eq(pageVisitsTable.ip, ip)];
  const trimmedTeam = teamId?.trim();
  if (trimmedTeam) {
    const { teamFilter } = await import("./teams");
    const teamCondition = teamFilter(pageVisitsTable.teamId, trimmedTeam);
    if (teamCondition) conditions.push(teamCondition);
  }
  const rows = await db
    .select()
    .from(pageVisitsTable)
    .where(and(...conditions))
    .orderBy(desc(pageVisitsTable.enteredAt))
    .limit(5000);
  const sessions = new Set<string>();
  const byPage = new Map<string, { visits: number; seconds: number }>();
  let totalSeconds = 0;
  let firstSeen: number | null = null;
  let lastSeen: number | null = null;
  for (const row of rows) {
    sessions.add(row.sessionHash);
    const entered = row.enteredAt.getTime();
    const exited = row.exitedAt ? row.exitedAt.getTime() : now;
    const seconds = Math.max(0, Math.round((exited - entered) / 1000));
    totalSeconds += seconds;
    if (firstSeen === null || entered < firstSeen) firstSeen = entered;
    if (lastSeen === null || exited > lastSeen) lastSeen = exited;
    const key = row.page || "(unknown)";
    const entry = byPage.get(key) ?? { visits: 0, seconds: 0 };
    entry.visits += 1;
    entry.seconds += seconds;
    byPage.set(key, entry);
  }
  return {
    ip,
    totalSeconds,
    sessionCount: sessions.size,
    visitCount: rows.length,
    firstSeenAt: firstSeen !== null ? new Date(firstSeen).toISOString() : null,
    lastSeenAt: lastSeen !== null ? new Date(lastSeen).toISOString() : null,
    pages: [...byPage.entries()]
      .map(([page, v]) => ({ page, visits: v.visits, seconds: v.seconds }))
      .sort((a, b) => b.seconds - a.seconds),
  };
}

export function localGeo(ip: string): GeoInfo | null {
  if (ip === "unknown" || ip === "") return { city: "", region: "", country: "" };
  if (isPrivateIp(ip)) return { city: "Local network", region: "", country: "" };
  return null;
}

/** Best-effort IP geolocation via ip-api.com (free, no key). Never throws. */
export async function geoLookup(ip: string): Promise<GeoInfo> {
  const local = localGeo(ip);
  if (local) return local;
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.at < GEO_CACHE_TTL_MS) return cached.geo;
  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city,query`,
      { signal: AbortSignal.timeout(3500) },
    );
    if (!response.ok) return { city: "", region: "", country: "" };
    const data = (await response.json()) as {
      status?: string;
      country?: string;
      regionName?: string;
      city?: string;
    };
    if (data.status !== "success") return { city: "", region: "", country: "" };
    const geo = {
      city: String(data.city ?? "").slice(0, 80),
      region: String(data.regionName ?? "").slice(0, 80),
      country: String(data.country ?? "").slice(0, 80),
    };
    geoCache.set(ip, { at: Date.now(), geo });
    return geo;
  } catch {
    return { city: "", region: "", country: "" };
  }
}
