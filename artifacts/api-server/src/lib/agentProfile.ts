import { pool } from "@workspace/db";
import { logger } from "./logger";
import {
  agentProfileUrlFromOrigin,
  publicOriginFromHeaders,
} from "./publicOrigin.ts";

/**
 * The WestCoast Products sync answers its UCP catalog API using a platform
 * agent profile. The profile is served by this very API at
 * /ucp-agent-profile.json, and this module remembers how the outside world
 * reaches it (learned from live request headers — no configuration needed)
 * so scheduled syncs can build the same URL any HTTP request would.
 */

/** Reads the last origin this deployment learned about, or null before any request has been seen. */
export async function readPersistedPublicOrigin(): Promise<string | null> {
  const result = await pool.query(
    `select "public_origin" from "parts_catalog_sync_state" where "id" = 'global'`,
  );
  const value = (result.rows[0] as { public_origin?: string | null } | undefined)?.public_origin;
  return typeof value === "string" && value.length <= 200 && /^https?:\/\//i.test(value)
    ? value
    : null;
}

export async function persistPublicOrigin(origin: string): Promise<void> {
  if (origin.length > 200 || !/^https?:\/\//i.test(origin)) return;
  await pool.query(
    `update "parts_catalog_sync_state" set "public_origin" = $1 where "id" = 'global'`,
    [origin],
  );
}

// Instance-local memory of the last origin we persisted, so a fleet of
// requests does not turn into a fleet of writes. Discovery is cheap; use it often.
let lastPersisted: string | null = null;

/** Fire-and-forget: records this instance's public origin when it changes. Never throws. */
export function rememberPublicOriginFromHeaders(headers: Record<string, unknown>): void {
  const origin = publicOriginFromHeaders(headers);
  if (!origin || origin === lastPersisted) return;
  lastPersisted = origin;
  void persistPublicOrigin(origin).catch((error) => {
    logger.warn({ err: error }, "Could not persist the deployment's public origin");
    if (lastPersisted === origin) lastPersisted = null;
  });
}

/** Resolves the agent profile URL for this deployment: the request hint, else the last persisted origin, else null. */
export async function resolveAgentProfileUrl(requestHint?: string | null): Promise<string | null> {
  const hint = requestHint?.trim();
  if (hint && /^https:\/\//i.test(hint) && hint.length <= 250) return hint;
  const persisted = await readPersistedPublicOrigin().catch(() => null);
  return persisted ? agentProfileUrlFromOrigin(persisted) : null;
}
