import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;
const primaryDatabaseUrl =
  process.env.PRIMARY_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!primaryDatabaseUrl) {
  throw new Error(
    "PRIMARY_DATABASE_URL or DATABASE_URL must be set.",
  );
}

export type DbInstance = "primary" | "secondary";

/**
 * Dual-Supabase routing. Team data has been moved to the secondary instance,
 * which is now the active default whenever it is configured. The primary
 * handles remain available for explicit compatibility and schema operations.
 * Request handling runs inside `runWithInstance(tag)` (the tag comes from the
 * session token), and the `db`/`pool` singletons resolve through a Proxy.
 */
/**
 * The instance a request is pinned to, plus a scope object that owns it.
 *
 * The scope object is what makes isolation safe. `AsyncLocalStorage.run`
 * short-circuits (and creates no new async resource) when the store it is
 * given is identical to the one already active, so a plain string store
 * would let a nested pin leak into the caller's context. A fresh object per
 * scope guarantees a fresh async resource every time, and `enterInstance`
 * mutates only its own request's scope.
 */
type InstanceScope = { instance: DbInstance };

const instanceStore = new AsyncLocalStorage<InstanceScope>();

export function currentInstance(): DbInstance {
  return instanceStore.getStore()?.instance ?? "primary";
}

export function runWithInstance<T>(instance: DbInstance | undefined | null, fn: () => T): T {
  return instanceStore.run({ instance: instance === "secondary" ? "secondary" : "primary" }, fn);
}

/**
 * Pin the remainder of the current request to an instance (e.g. right after an
 * unauthenticated handler resolves which team's database it needs). Unlike
 * runWithInstance, no restructuring is needed: every later await in this
 * handler resolves through the proxy to the pinned instance.
 *
 * The pin is written to the request's own scope object rather than to the
 * ambient async context, so it can never escape into another request that
 * happens to reuse the same keep-alive connection.
 */
export function enterInstance(instance: DbInstance | undefined | null): void {
  const scope = instanceStore.getStore();
  if (!scope) {
    // No request scope (boot, tests, cron): own the pin outright.
    instanceStore.enterWith({ instance: instance === "secondary" ? "secondary" : "primary" });
    return;
  }
  scope.instance = instance === "secondary" ? "secondary" : "primary";
}

function secondaryUrl(): string | null {
  const configuredUrl = process.env.SECONDARY_DATABASE_URL?.trim();
  if (!configuredUrl) return null;

  const url = new URL(configuredUrl);
  const directSupabaseHost = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
  const poolerHost = process.env.SECONDARY_DATABASE_POOLER_HOST?.trim();
  if (!poolerHost || !directSupabaseHost || url.username !== "postgres") {
    return configuredUrl;
  }

  // Preserve the existing password when a runtime opts into Supavisor.
  url.hostname = poolerHost;
  url.username = `postgres.${directSupabaseHost[1]}`;
  url.port = "5432";
  return url.toString();
}

export function hasSecondary(): boolean {
  return secondaryUrl() !== null;
}

// Keep database sessions bounded: API instances should not reserve the
// node-postgres default of 10 connections for each Supabase project.
const DATABASE_POOL_MAX = 4;

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const DATABASE_POOL_OPTIONS = {
  max: DATABASE_POOL_MAX,
  idleTimeoutMillis: 30_000,
  // Acquiring a connection, not running a query. A backend at 100% disk I/O
  // answers TCP immediately and then takes far longer than 10s to finish
  // authentication, so the old 10s cap reported a slow database as an
  // unreachable one. Override with DB_CONNECTION_TIMEOUT_MS.
  connectionTimeoutMillis: positiveIntFromEnv("DB_CONNECTION_TIMEOUT_MS", 120_000),
};

export const primaryPool = new Pool({
  connectionString: primaryDatabaseUrl,
  ...DATABASE_POOL_OPTIONS,
});
export const primaryDb = drizzle(primaryPool, { schema });

let secondaryPoolValue: InstanceType<typeof Pool> | null = null;
let secondaryDbValue: typeof primaryDb | null = null;

export function secondaryPool(): InstanceType<typeof Pool> | null {
  const url = secondaryUrl();
  if (!url) return null;
  if (!secondaryPoolValue) {
    secondaryPoolValue = new Pool({
      connectionString: url,
      ...DATABASE_POOL_OPTIONS,
    });
  }
  return secondaryPoolValue;
}

export function secondaryDb(): typeof primaryDb | null {
  if (!secondaryPool()) return null;
  if (!secondaryDbValue) {
    secondaryDbValue = drizzle(secondaryPool() as InstanceType<typeof Pool>, { schema });
  }
  return secondaryDbValue;
}

function resolvePool(): InstanceType<typeof Pool> {
  if (currentInstance() === "secondary") {
    const secondary = secondaryPool();
    if (secondary) return secondary;
  }
  return primaryPool;
}

function resolveDb(): typeof primaryDb {
  if (currentInstance() === "secondary") {
    const secondary = secondaryDb();
    if (secondary) return secondary;
  }
  return primaryDb;
}

function forwardingProxy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, property, _receiver) {
      const real = resolve() as Record<string | symbol, unknown>;
      const value = real[property];
      return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(real) : value;
    },
    has(_target, property) {
      return property in (resolve() as object);
    },
  });
}

/** Instance-aware database handle. Resolves per request; primary outside one. */
export const pool = forwardingProxy<InstanceType<typeof Pool>>(resolvePool);
/** Instance-aware drizzle handle. Resolves per request; primary outside one. */
export const db = forwardingProxy<typeof primaryDb>(resolveDb);

/**
 * Run a read against every configured instance and merge the rows by id.
 *
 * Team data lives on the primary, but older rows can still exist on the
 * secondary (and vice versa during a failover). A single "active instance"
 * flag silently hides messages written to the other one. This checks both in
 * parallel so whichever instance holds a row contributes it. Each instance is
 * bounded so a saturated backend can never stall the whole response.
 */
export async function readAcrossInstances<T extends { id: string }>(
  query: () => Promise<T[]>,
  timeoutMs = 2_000,
): Promise<T[]> {
  const merged = new Map<string, T>();
  const bounded = (instance: DbInstance) =>
    new Promise<T[]>((resolve) => {
      const timer = setTimeout(() => resolve([]), timeoutMs);
      runWithInstance(instance, query).then(
        (rows) => { clearTimeout(timer); resolve(Array.isArray(rows) ? rows : []); },
        () => { clearTimeout(timer); resolve([]); },
      );
    });

  const reads = [bounded("primary")];
  if (hasSecondary()) reads.push(bounded("secondary"));
  const batches = await Promise.all(reads);
  for (const rows of batches) for (const row of rows) if (!merged.has(row.id)) merged.set(row.id, row);
  return [...merged.values()];
}

export * from "./schema";
