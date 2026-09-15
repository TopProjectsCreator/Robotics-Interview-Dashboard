import type { Request } from "express";

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
