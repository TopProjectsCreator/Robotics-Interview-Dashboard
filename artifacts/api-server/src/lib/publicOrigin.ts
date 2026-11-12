/**
 * Discovers this deployment's own public origin from the incoming request.
 *
 * Team deployments are served behind proxies (Replit, Render, self-hosted)
 * that terminate TLS and forward the caller's original protocol and host in
 * the standard X-Forwarded-* headers, so any request tells us how the outside
 * world reaches us. That value feeds the UCP agent profile the WestCoast
 * Products sync advertises to the store's UCP catalog API, letting the sync
 * work on any domain with no per-deployment configuration.
 */

const HEADER_PORTS = new Set(["80", "443"]);

/** Strips path/port noise into a canonical `scheme://host[:port]` origin, or returns null when the headers lie. */
export function publicOriginFromHeaders(headers: Record<string, unknown>): string | null {
  const read = (name: string): string | null => {
    const value = headers[name];
    if (Array.isArray(value)) return value[0] ?? null;
    return typeof value === "string" ? value.split(",")[0].trim() : null;
  };
  const forwardedProto = read("x-forwarded-proto");
  const forwardedHost = read("x-forwarded-host");
  const host = (forwardedHost ?? read("host"))?.toLowerCase() ?? null;
  if (!host) return null;
  // Host may carry a port (localhost:8080, internal:3123); drop it when
  // standard or malformed, keep a non-standard one.
  const hostPart = host.match(/^(\[[0-9a-f:%.]+\]|[a-z0-9._-]+)(:(\d{1,5}))?$/i);
  if (!hostPart) return null;
  const hostname = hostPart[1];
  const port = hostPart[3];
  const keepPort = port && !HEADER_PORTS.has(port);
  const protoHeader = forwardedProto?.toLowerCase();
  const proto = protoHeader === "http" || protoHeader === "https"
    ? protoHeader
    // TLS-terminating proxies forward the original proto; without one, assume TLS —
    // every public deployment here sits behind it.
    : "https";
  return `${proto}://${hostname}${keepPort ? `:${port}` : ""}`;
}

/** Path of the agent profile served by this API for UCP discovery. */
export const UCP_AGENT_PROFILE_PATH = "/ucp-agent-profile.json";

/** Builds the externally reachable agent profile URL for an origin. */
export function agentProfileUrlFromOrigin(origin: string): string {
  return `${origin}${UCP_AGENT_PROFILE_PATH}`;
}
