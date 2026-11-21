import { primaryPool, secondaryPool, hasSecondary, type DbInstance } from "@workspace/db";
import { isDatabaseConnectionError } from "./databaseErrors";

/**
 * Runtime health for the two Supabase instances.
 *
 * Routing used to be decided purely by ACTIVE_TEAM_DATABASE, so if the chosen
 * instance went down the app kept hammering it and every page failed. This
 * module tracks real probe results and lets activeTeamDatabaseInstance() pick
 * whichever configured instance is actually answering.
 */
type Health = { healthy: boolean; failures: number; lastCheck: number };
const health: Record<DbInstance, Health> = {
  primary: { healthy: true, failures: 0, lastCheck: 0 },
  secondary: { healthy: true, failures: 0, lastCheck: 0 },
};

const PROBE_INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;
const FAILURES_TO_MARK_DOWN = 2;

let probeTimer: ReturnType<typeof setInterval> | null = null;

export function isInstanceHealthy(instance: DbInstance): boolean {
  return health[instance].healthy;
}

/** Called from schema loops and request error paths when an instance fails. */
export function markInstanceFailure(instance: DbInstance, error: unknown): void {
  if (!isDatabaseConnectionError(error)) return;
  const state = health[instance];
  state.failures += 1;
  if (state.failures >= FAILURES_TO_MARK_DOWN) state.healthy = false;
}

export function markInstanceSuccess(instance: DbInstance): void {
  const state = health[instance];
  state.failures = 0;
  state.healthy = true;
  state.lastCheck = Date.now();
}

function poolFor(instance: DbInstance) {
  return instance === "secondary" ? secondaryPool() : primaryPool;
}

/** One bounded `select 1`. Never lets a stalled pooler hang the probe. */
export async function probeInstance(instance: DbInstance): Promise<boolean> {
  const pool = poolFor(instance);
  if (!pool) return false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      pool.query("select 1"),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("health probe timeout")), PROBE_TIMEOUT_MS);
      }),
    ]);
    markInstanceSuccess(instance);
    return true;
  } catch (error) {
    const state = health[instance];
    state.failures += 1;
    if (state.failures >= FAILURES_TO_MARK_DOWN) state.healthy = false;
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The instance team traffic should use: the caller's preferred one when it is
 * healthy, otherwise the other configured instance. This is what makes the
 * secondary take over automatically when the primary is down.
 */
export function preferredInstance(configured: DbInstance): DbInstance {
  if (isInstanceHealthy(configured)) return configured;
  if (configured === "primary" && hasSecondary() && isInstanceHealthy("secondary")) return "secondary";
  if (configured === "secondary" && isInstanceHealthy("primary")) return "primary";
  return configured;
}

/** Start the periodic prober. Idempotent; timer is unref'd so it never holds the process open. */
export function startInstanceHealthProbes(): void {
  if (probeTimer) return;
  void probeInstance("primary");
  if (hasSecondary()) void probeInstance("secondary");
  probeTimer = setInterval(() => {
    void probeInstance("primary");
    if (hasSecondary()) void probeInstance("secondary");
  }, PROBE_INTERVAL_MS);
  probeTimer.unref();
}
