// Primary → backup redirect (egress relief).
//
// The production app runs on both the primary domains and the backup
// domain (https://roboticsdashboardbackup.onrender.com). When the primary
// is nearly out of egress, browsers hitting the primary should land on
// the backup instead of loading the full app from the primary.
// This is a temporary (302) redirect so it can be switched back later.
//
// The redirect is host-based so the same code can run everywhere:
//   - Host in REDIRECT_FROM_HOSTS (default: primary domains) → 302 to
//     REDIRECT_TARGET_URL (default: backup domain), preserving path+query.
//   - Any other host (backup, localhost, Codespaces preview) → no redirect.
//   - /api/healthz is exempt so Render health checks always pass.
//
// Overrides (set on the primary service in Render Dashboard if desired):
//   REDIRECT_TARGET_URL   Backup base URL. Empty string disables redirect.
//   REDIRECT_FROM_HOSTS   Comma-separated hosts to redirect (lowercase,
//                         with or without port). Empty/missing-value with
//                         an explicitly empty string disables redirect.
//
// Defaults (when env vars are unset) redirect the two known primaries to
// the backup, so no env config is required for the egress-relief fallback.

export const DEFAULT_REDIRECT_TARGET_URL =
  "https://roboticsdashboardbackup.onrender.com";

export const DEFAULT_REDIRECT_FROM_HOSTS = [
  "roboticsdashboard.onrender.com",
  "robotics-interview-dashboard.onrender.com",
] as const;

export type RedirectConfig = {
  enabled: boolean;
  targetUrl: string | null;
  fromHosts: ReadonlySet<string>;
};

function parseHosts(raw: string): ReadonlySet<string> {
  const hosts = new Set<string>();
  for (const part of raw.split(",")) {
    const host = part.trim().toLowerCase();
    if (!host) continue;
    // Accept "host" or "host:port"; the comparison is against the bare
    // hostname, so strip an optional port. IPv6 literals are out of
    // scope (primary hosts are DNS names).
    hosts.add(host.split(":")[0]!);
  }
  return hosts;
}

function parseTargetUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return null;
  }
  // Return the bare origin (scheme + host + optional port). Any path on
  // the configured target is ignored: the request path is appended.
  return parsed.origin;
}

export function getRedirectConfig(
  env: NodeJS.ProcessEnv = process.env,
): RedirectConfig {
  // Unset → defaults; explicitly set (even to "") → honoured, so an
  // empty value cleanly disables the redirect without a code change.
  const targetRaw =
    env["REDIRECT_TARGET_URL"] !== undefined
      ? env["REDIRECT_TARGET_URL"]
      : DEFAULT_REDIRECT_TARGET_URL;
  const targetUrl = targetRaw === undefined ? null : parseTargetUrl(targetRaw);

  const hostsRaw =
    env["REDIRECT_FROM_HOSTS"] !== undefined
      ? env["REDIRECT_FROM_HOSTS"]
      : DEFAULT_REDIRECT_FROM_HOSTS.join(",");
  const fromHosts = new Set(parseHosts(hostsRaw ?? ""));

  if (!targetUrl || fromHosts.size === 0) {
    return { enabled: false, targetUrl: null, fromHosts };
  }

  // Never redirect the backup host to itself (loop prevention), even if
  // it was accidentally listed in REDIRECT_FROM_HOSTS.
  try {
    fromHosts.delete(new URL(targetUrl).hostname.toLowerCase());
  } catch {
    return { enabled: false, targetUrl: null, fromHosts };
  }

  if (fromHosts.size === 0) {
    return { enabled: false, targetUrl: null, fromHosts };
  }

  return { enabled: true, targetUrl, fromHosts };
}

/**
 * Returns the redirect Location for a request, or null when no redirect
 * should happen. `host` may include a port. `originalUrl` is the path +
 * query as received (e.g. "/attendance?x=1").
 */
export function getRedirectLocation(args: {
  host: string | undefined;
  originalUrl: string;
  config: RedirectConfig;
}): string | null {
  const { host, originalUrl, config } = args;
  if (!config.enabled || !config.targetUrl || !host) return null;

  const hostname = host.split(":")[0]!.trim().toLowerCase();
  if (!hostname || !config.fromHosts.has(hostname)) return null;

  const path = originalUrl.startsWith("/") ? originalUrl : `/${originalUrl}`;
  return `${config.targetUrl}${path}`;
}
