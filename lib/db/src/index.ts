import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export type DbInstance = "primary" | "secondary";

/**
 * Dual-Supabase routing. The primary instance keeps all current teams; every
 * team created after the second instance was added lives on the secondary
 * instance. Request handling runs inside `runWithInstance(tag)` (the tag
 * comes from the session token, so routing costs zero extra queries), and
 * the `db`/`pool` singletons below resolve to the current instance through a
 * Proxy. All 300+ existing call sites keep working untouched; outside a
 * request (boot, tests, cron) everything resolves to primary.
 */
const instanceStore = new AsyncLocalStorage<DbInstance>();

export function currentInstance(): DbInstance {
  return instanceStore.getStore() ?? "primary";
}

export function runWithInstance<T>(instance: DbInstance | undefined | null, fn: () => T): T {
  return instanceStore.run(instance === "secondary" ? "secondary" : "primary", fn);
}

/**
 * Pin the remainder of the current execution to an instance (e.g. right
 * after an unauthenticated handler resolves which team's database it needs).
 * Unlike runWithInstance, no restructuring is needed: every later await in
 * this handler resolves through the proxy to the pinned instance.
 */
export function enterInstance(instance: DbInstance | undefined | null): void {
  instanceStore.enterWith(instance === "secondary" ? "secondary" : "primary");
}

function secondaryUrl(): string | null {
  const url = process.env.SECONDARY_DATABASE_URL?.trim();
  return url ? url : null;
}

export function hasSecondary(): boolean {
  return secondaryUrl() !== null;
}

export const primaryPool = new Pool({ connectionString: process.env.DATABASE_URL });
export const primaryDb = drizzle(primaryPool, { schema });

let secondaryPoolValue: InstanceType<typeof Pool> | null = null;
let secondaryDbValue: typeof primaryDb | null = null;

export function secondaryPool(): InstanceType<typeof Pool> | null {
  const url = secondaryUrl();
  if (!url) return null;
  if (!secondaryPoolValue) {
    secondaryPoolValue = new Pool({ connectionString: url });
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

export * from "./schema";
