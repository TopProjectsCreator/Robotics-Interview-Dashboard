import type { Request, Response } from "express";
import { pool } from "@workspace/db";

/**
 * Per-team sign-in IP blocklist. Team admins block an IP address from
 * signing in to their team: the address cannot use the team access code,
 * passwords, passkeys, or create accounts while blocked.
 *
 * Blocks are exact addresses only (no CIDR ranges). `req.ip` with the app's
 * `trust proxy = 1` setting is the same value the login rate limiter keys
 * on, so the two agree on what "the caller's IP" means. An attacker can
 * rotate addresses on some networks, so this is a targeted control (stop
 * this one address from getting in), not a brute-force defense.
 */
export const MAX_BLOCKED_IPS_PER_TEAM = 200;
export const MAX_BLOCKED_IP_REASON_LENGTH = 120;

const IPV4_GROUP = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_GROUP = /^[0-9a-f]{1,4}$/;

/**
 * Canonicalize an IPv6 address: expand any `::` elision, then re-compress
 * the longest run of zero groups so every spelling of the same address
 * produces one stored form ("::1", "0:0:0:0:0:0:0:1" → "::1").
 */
function canonicalizeIpv6(input: string): string | null {
  const halves = input.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] === "" ? [] : halves[0].split(":");
  const tail = halves.length === 2 ? (halves[1] === "" ? [] : halves[1].split(":")) : [];
  if (!head.every((group) => IPV6_GROUP.test(group))) return null;
  if (!tail.every((group) => IPV6_GROUP.test(group))) return null;
  let groups: number[];
  if (halves.length === 2) {
    const elided = 8 - head.length - tail.length;
    if (elided < 1) return null;
    groups = [...head, ...new Array<string>(elided).fill("0"), ...tail].map((group: string) => parseInt(group, 16));
  } else {
    if (head.length !== 8) return null;
    groups = head.map((group: string) => parseInt(group, 16));
  }
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < 8;) {
    if (groups[index] !== 0) {
      index += 1;
      continue;
    }
    let end = index;
    while (end < 8 && groups[end] === 0) end += 1;
    if (end - index > bestLength) {
      bestStart = index;
      bestLength = end - index;
    }
    index = end;
  }
  const hex = (value: number) => value.toString(16);
  if (bestLength >= 2) {
    const left = groups.slice(0, bestStart).map(hex).join(":");
    const right = groups.slice(bestStart + bestLength).map(hex).join(":");
    return `${left}::${right}`;
  }
  return groups.map(hex).join(":");
}

/**
 * Normalize an IP address to the single form stored in the blocklist.
 * Returns null for anything that is not a valid IPv4 or IPv6 address.
 * IPv4 is canonicalized numerically ("010.0.0.1" → "10.0.0.1") and IPv6 is
 * canonicalized by group expansion; `::ffff:` IPv4 mappings collapse to
 * plain IPv4.
 */
export function normalizeIp(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let ip = raw.trim().toLowerCase();
  if (!ip) return null;
  // Accept the bracketed spelling admins copy from URLs ("[::1]").
  if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
  const v4 = IPV4_GROUP.exec(ip);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    if (octets.some((octet) => octet > 255)) return null;
    return octets.join(".");
  }
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(ip);
  if (mapped) return normalizeIp(mapped[1]);
  if (ip.includes(".")) return null; // dotted forms other than IPv4 are not supported
  return canonicalizeIpv6(ip);
}

export type BlockedIpRow = {
  ip: string;
  reason: string;
  createdBy: string | null;
  createdAt: Date;
};

export async function isLoginIpBlocked(teamId: string, ip: string): Promise<boolean> {
  const result = await pool.query(
    `select 1 from "team_blocked_ips" where "team_id" = $1 and "ip" = $2 limit 1`,
    [teamId, ip],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listBlockedIps(teamId: string): Promise<BlockedIpRow[]> {
  const result = await pool.query<{ ip: string; reason: string; created_by: string | null; created_at: Date }>(
    `select "ip", "reason", "created_by", "created_at"
       from "team_blocked_ips"
      where "team_id" = $1
      order by "created_at" desc, "ip" asc`,
    [teamId],
  );
  return result.rows.map((row) => ({
    ip: row.ip,
    reason: row.reason ?? "",
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export class BlockedIpsFullError extends Error {
  constructor() {
    super("The team's sign-in blocklist is full.");
    this.name = "BlockedIpsFullError";
  }
}

/**
 * Block an IP for a team. Re-blocking an address already on the list updates
 * the note (when a new one is given) and re-stamps the creator instead of
 * failing, so "block this again" is always safe.
 */
export async function addBlockedIp(
  teamId: string,
  ip: string,
  reason: string,
  createdBy: string | null,
): Promise<BlockedIpRow> {
  const existing = await pool.query(
    `select 1 from "team_blocked_ips" where "team_id" = $1 and "ip" = $2 limit 1`,
    [teamId, ip],
  );
  if ((existing.rowCount ?? 0) === 0) {
    const count = await pool.query<{ n: number }>(
      `select count(*)::int as n from "team_blocked_ips" where "team_id" = $1`,
      [teamId],
    );
    if ((count.rows[0]?.n ?? 0) >= MAX_BLOCKED_IPS_PER_TEAM) {
      throw new BlockedIpsFullError();
    }
  }
  const result = await pool.query<{ ip: string; reason: string; created_by: string | null; created_at: Date }>(
    `insert into "team_blocked_ips" ("team_id", "ip", "reason", "created_by")
     values ($1, $2, $3, $4)
     on conflict ("team_id", "ip") do update
       set "reason" = case when excluded."reason" <> '' then excluded."reason" else "team_blocked_ips"."reason" end,
           "created_by" = excluded."created_by"
     returning "ip", "reason", "created_by", "created_at"`,
    [teamId, ip, reason, createdBy],
  );
  const row = result.rows[0];
  return { ip: row.ip, reason: row.reason ?? "", createdBy: row.created_by, createdAt: row.created_at };
}

export async function removeBlockedIp(teamId: string, ip: string): Promise<boolean> {
  const result = await pool.query(
    `delete from "team_blocked_ips" where "team_id" = $1 and "ip" = $2`,
    [teamId, ip],
  );
  return (result.rowCount ?? 0) > 0;
}

/**
 * Gate an unauthenticated, team-scoped sign-in path. Returns true when the
 * request was refused and the response was already sent (403 blocked, 503
 * check unavailable); returns false to let the sign-in flow continue.
 *
 * Must be called AFTER the team is resolved from the event passcode. A
 * blocked address is refused for every team-scoped sign-in path of the
 * team that blocked it — but an address the request layer cannot determine
 * is never blocked, so a misconfigured proxy cannot lock every member out.
 */
export async function rejectBlockedLoginIp(
  req: Request,
  res: Response,
  teamId: string,
): Promise<boolean> {
  const ip = normalizeIp(req.ip);
  if (!ip) return false;
  let blocked: boolean;
  try {
    blocked = await isLoginIpBlocked(teamId, ip);
  } catch (error) {
    req.log.error({ err: error }, "Sign-in IP blocklist check failed");
    res.status(503).json({ error: "Sign-in is temporarily unavailable. Try again shortly." });
    return true;
  }
  if (!blocked) return false;
  res.status(403).json({
    error: "Sign-in from this network address is blocked for this team.",
    code: "IP_BLOCKED",
  });
  return true;
}
