import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { currentInstance, type DbInstance } from '@workspace/db';
import { open } from 'node:fs/promises';

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

/**
 * Storage instance a call targets. Objects written to the secondary carry a
 * `/objects/secondary/` prefix, so a stored path always says which instance
 * holds the bytes and reads never have to guess.
 */
export type StorageInstance = DbInstance;

export type CadStorageStatus = {
  usingBackupStorage: boolean;
  lastFailoverAt: string | null;
  lastRecoveryAt: string | null;
};

let cadStorageStatus: CadStorageStatus = {
  usingBackupStorage: false,
  lastFailoverAt: null,
  lastRecoveryAt: null,
};
let cadStorageStatusRevision = 0;
let lastPrimaryProbeAt = 0;
let lastPrimaryProbeHealthy = false;
let primaryProbeInFlight: Promise<boolean> | null = null;
const PRIMARY_PROBE_INTERVAL_MS = 30_000;

export function getCadStorageStatus(): CadStorageStatus {
  return { ...cadStorageStatus };
}

export function recordCadStorageFailover(): boolean {
  if (cadStorageStatus.usingBackupStorage) return false;
  cadStorageStatus = {
    usingBackupStorage: true,
    lastFailoverAt: new Date().toISOString(),
    lastRecoveryAt: null,
  };
  cadStorageStatusRevision += 1;
  lastPrimaryProbeAt = 0;
  return true;
}

export function recordCadStorageRecovery(expectedFailoverAt?: string | null): boolean {
  if (
    !cadStorageStatus.usingBackupStorage ||
    (expectedFailoverAt !== undefined && cadStorageStatus.lastFailoverAt !== expectedFailoverAt)
  ) {
    return false;
  }
  cadStorageStatus = {
    ...cadStorageStatus,
    usingBackupStorage: false,
    lastRecoveryAt: new Date().toISOString(),
  };
  cadStorageStatusRevision += 1;
  lastPrimaryProbeAt = 0;
  return true;
}

/** The storage service is refusing writes because the project is over quota. */
export class StorageRestrictedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageRestrictedError';
    Object.setPrototypeOf(this, StorageRestrictedError.prototype);
  }
}

/**
 * Storage calls take one of two shapes when a Supabase project is out of
 * egress/storage quota: an explicit "restricted ... exceed_egress_quota"
 * message, or the bucket-create/inspect path failing with the same text.
 * Both mean "this instance cannot be used right now", so storage ops fall
 * back to the other instance instead of surfacing a 500 to the browser.
 */
export function isStorageRestrictedError(error: unknown): boolean {
  // Supabase errors arrive as plain { message } objects, not Error
  // instances — match both shapes or the fallback never triggers live.
  const message = error instanceof Error
    ? error.message
    : (typeof error === "object" && error !== null && typeof (error as Record<string, unknown>).message === "string"
      ? String((error as Record<string, unknown>).message)
      : String(error ?? ""));
  return /exceed_egress_quota|exceed_storage_quota|spend ?caps?|restricted|quota exceeded|upgrade.*plan|payment method|storage bucket ".*exceed/i.test(message);
}

function supabaseUrl(instance: StorageInstance = currentInstance()): string {
  const url = instance === "secondary"
    ? (process.env.SECONDARY_SUPABASE_URL?.trim() || process.env.SUPABASE_URL)
    : process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      'SUPABASE_URL must be set. File storage lives in Supabase Storage.',
    );
  }
  return url.replace(/\/+$/, '');
}

function serviceRoleKey(instance: StorageInstance = currentInstance()): string {
  const key = instance === "secondary"
    ? (process.env.SECONDARY_SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY)
    : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must be set. File storage lives in Supabase Storage.',
    );
  }
  return key;
}

export function storageBucket(instance: StorageInstance = currentInstance()): string {
  if (instance === "secondary") {
    return process.env.SECONDARY_SUPABASE_STORAGE_BUCKET?.trim() || process.env.SUPABASE_STORAGE_BUCKET || 'app-uploads';
  }
  return process.env.SUPABASE_STORAGE_BUCKET || 'app-uploads';
}

/**
 * True when a second storage instance is configured and could take over. Both
 * the URL and the service key are required: with only a URL, calls would go to
 * the secondary project authenticated as the primary, which never works.
 */
export function hasSecondaryStorage(): boolean {
  return Boolean(
    process.env.SECONDARY_SUPABASE_URL?.trim() && process.env.SECONDARY_SUPABASE_SECRET_KEY?.trim(),
  );
}

// Remember a restricted instance for a few minutes so a dead primary is not
// re-probed on every request. The window is short enough that recovery after
// the quota resets is noticed quickly.
const RESTRICTED_MEMORY_MS = 5 * 60 * 1000;
const restrictedUntil = new Map<StorageInstance, number>();

function markRestricted(instance: StorageInstance): void {
  restrictedUntil.set(instance, Date.now() + RESTRICTED_MEMORY_MS);
}

/**
 * True when that instance is known to be refusing storage work (e.g. the
 * project is over its egress quota). Callers use it to route writes and
 * reads to the other instance instead of failing.
 */
export function storageInstanceRestricted(instance: StorageInstance): boolean {
  return isRestricted(instance);
}

function isRestricted(instance: StorageInstance): boolean {
  const until = restrictedUntil.get(instance);
  if (until === undefined) return false;
  if (until <= Date.now()) {
    restrictedUntil.delete(instance);
    return false;
  }
  return true;
}

function otherInstance(): StorageInstance | null {
  if (!hasSecondaryStorage()) return null;
  return currentInstance() === 'secondary' ? 'primary' : 'secondary';
}

/** Read order: current instance first, unless it is known-restricted. */
function readOrder(): StorageInstance[] {
  const current = currentInstance();
  const other = otherInstance();
  if (!other) return [current];
  return isRestricted(current) ? [other, current] : [current, other];
}

/** Write order: never pick an instance currently known to be restricted. */
function writeOrder(): StorageInstance[] {
  const current = currentInstance();
  const other = otherInstance();
  if (!other) return [current];
  return isRestricted(current) ? [other, current] : [current, other];
}

let client: SupabaseClient | null = null;
let secondaryClient: SupabaseClient | null = null;

function supabaseFor(instance: StorageInstance): SupabaseClient {
  if (instance === "secondary" && process.env.SECONDARY_SUPABASE_URL?.trim()) {
    if (!secondaryClient) {
      secondaryClient = createClient(supabaseUrl("secondary"), serviceRoleKey("secondary"), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return secondaryClient;
  }
  if (!client) {
    client = createClient(supabaseUrl("primary"), serviceRoleKey("primary"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

const ensuredBuckets = new Map<string, Promise<void>>();
// Supabase rejects a bucket file_size_limit above the plan maximum (50 MB on
// the current plan), and the error is unrelated to bucket existence. Stay at
// or below that ceiling so the request is always accepted.
export const MAX_STORAGE_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * Ensure the bucket exists on ONE instance, translating quota failures into
 * StorageRestrictedError so callers can fall back rather than crash.
 */
async function ensureBucketOn(instance: StorageInstance): Promise<void> {
  const bucket = storageBucket(instance);
  const storage = supabaseFor(instance).storage;
  const { error } = await storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: MAX_STORAGE_UPLOAD_BYTES,
  });
  if (error && !/already exists|duplicate/i.test(error.message)) {
    // Creation can be refused for reasons that do not mean the bucket is
    // missing (for example a size limit the plan rejects). Fall back to
    // inspecting the bucket and keep going if it is actually there.
    const { data: existing, error: lookupError } = await storage.getBucket(bucket);
    if (lookupError || !existing) {
      if (isStorageRestrictedError(error) || isStorageRestrictedError(lookupError)) {
        throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error.message}`);
      }
      throw new Error(`Could not create Supabase storage bucket "${bucket}": ${error.message}`);
    }
  }
  if (error) {
    const { data: existing, error: lookupError } = await storage.getBucket(bucket);
    if (lookupError || !existing) {
      if (isStorageRestrictedError(error) || isStorageRestrictedError(lookupError)) {
        throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error.message}`);
      }
      throw new Error(`Could not inspect Supabase storage bucket "${bucket}": ${lookupError?.message ?? 'unknown error'}`);
    }
    const currentLimit = typeof existing.file_size_limit === 'number' ? existing.file_size_limit : null;
    if (currentLimit !== null && currentLimit < MAX_STORAGE_UPLOAD_BYTES) {
      const { error: updateError } = await storage.updateBucket(bucket, {
        public: false,
        fileSizeLimit: MAX_STORAGE_UPLOAD_BYTES,
      });
      if (updateError) {
        // Not fatal: uploads above the current limit are rejected by
        // Supabase with a clear message instead of failing the request.
        console.warn(`Could not raise storage limit for "${bucket}": ${updateError.message}`);
      }
    }
  }
}

/** Ensure the bucket exists on `instance`, caching the attempt per instance. */
async function ensureBucket(instance: StorageInstance = currentInstance()): Promise<void> {
  const bucketKey = `${instance}:${storageBucket(instance)}`;
  const existing = ensuredBuckets.get(bucketKey);
  if (existing) return existing;
  const pending = ensureBucketOn(instance).catch((error: unknown) => {
    ensuredBuckets.delete(bucketKey);
    throw error;
  });
  ensuredBuckets.set(bucketKey, pending);
  return pending;
}

/**
 * Best-effort bucket setup for a write: a bucket that already exists but
 * cannot be inspected must not block the upload itself. Failures are not
 * cached, so the next call retries.
 */
async function ensureBucketForWrite(instance: StorageInstance): Promise<void> {
  const bucketKey = `${instance}:${storageBucket(instance)}`;
  if (ensuredBuckets.has(bucketKey)) return;
  try {
    await ensureBucketOn(instance);
    ensuredBuckets.set(bucketKey, Promise.resolve());
  } catch {
    // ensureBucketOn leaves nothing cached, so the next call retries.
  }
}

function toStoragePath(objectPath: string): string {
  if (!objectPath.startsWith('/objects/')) {
    throw new ObjectNotFoundError();
  }
  const rest = objectPath.slice('/objects/'.length).replace(/^secondary\//, '');
  const parts = rest.split('/');
  if (
    parts.length === 3 &&
    parts[0] === 'team-branding' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(parts[1]) &&
    /^[A-Za-z0-9-]{8,128}$/.test(parts[2])
  ) {
    return `team-branding/${parts[1]}/${parts[2]}`;
  }
  if (parts.length === 1 && /^[A-Za-z0-9-]{8,128}$/.test(parts[0])) {
    return `uploads/${parts[0]}`;
  }
  if (parts.length === 2 && parts[0] === 'generated' && /^[A-Za-z0-9-]{8,128}$/.test(parts[1])) {
    return `generated/${parts[1]}`;
  }
  throw new ObjectNotFoundError();
}

/** The instance a stored path was written to, when the path says so. */
function objectStorageInstance(objectPath: string): StorageInstance | null {
  return objectPath.startsWith("/objects/secondary/") ? "secondary" : null;
}

function objectPathPrefix(instance: StorageInstance): string {
  return instance === "secondary" ? "/objects/secondary/" : "/objects/";
}

/**
 * Instances to try for a stored path. A `/objects/secondary/` prefix pins the
 * exact instance; a bare path predates instance tracking, so it is probed
 * across instances (object IDs are unique, so only one can hold it).
 */
function resolveOrder(objectPath: string, order: StorageInstance[]): StorageInstance[] {
  const pinned = objectStorageInstance(objectPath);
  return pinned ? [pinned] : order;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isNotFound(error: unknown): boolean {
  return /not found|does not exist|404/i.test(errorMessage(error));
}

/**
 * Write with failover: try each instance in order until one accepts the bytes.
 *
 * A restricted instance is remembered so the next few minutes skip it, and any
 * other failure only costs one extra attempt — a broken primary must not take
 * uploads down while a secondary is configured. When every instance fails, the
 * reasons are reported together and stay recognisable to the route's quota
 * check, which answers 503 instead of a generic 500.
 */
async function writeWithFailover<T>(
  operationName: string,
  attempt: (instance: StorageInstance) => Promise<T>,
): Promise<{ value: T; instance: StorageInstance }> {
  const order = writeOrder();
  const failures: string[] = [];
  for (const instance of order) {
    try {
      await ensureBucketForWrite(instance);
      return { value: await attempt(instance), instance };
    } catch (error) {
      if (isStorageRestrictedError(error)) markRestricted(instance);
      failures.push(`${instance}: ${errorMessage(error)}`);
    }
  }
  const details = failures.join('; ');
  throw new Error(`${operationName} failed on every configured instance (${details})`);
}

/**
 * Read with failover: keep looking on the next instance when this one is
 * restricted or simply does not hold the object. Any other error is a real
 * failure and stops the search.
 */
async function readWithFailover<T>(
  order: StorageInstance[],
  attempt: (instance: StorageInstance) => Promise<T | null>,
): Promise<T | null> {
  for (const instance of order) {
    try {
      await ensureBucketForWrite(instance);
      const result = await attempt(instance);
      if (result !== null) return result;
    } catch (error) {
      if (isStorageRestrictedError(error)) {
        markRestricted(instance);
        continue;
      }
      throw error;
    }
  }
  return null;
}

export class ObjectStorageService {
  constructor() {}

  /**
   * Probe the primary with a real write so admins can be told when storage is
   * healthy again. This deliberately never fails over: it measures the primary,
   * not "the best instance available".
   */
  async probePrimaryStorageWrite(): Promise<boolean> {
    if (primaryProbeInFlight) return primaryProbeInFlight;
    const now = Date.now();
    if (now - lastPrimaryProbeAt < PRIMARY_PROBE_INTERVAL_MS) {
      return lastPrimaryProbeHealthy;
    }

    const revision = cadStorageStatusRevision;
    const probe = (async () => {
      const bucket = storageBucket("primary");
      const path = `health-checks/cad-${randomUUID()}`;
      try {
        await ensureBucket("primary");
        const storage = supabaseFor("primary").storage.from(bucket);
        const { error } = await storage.upload(path, Buffer.from("ok"), {
          contentType: "text/plain",
          upsert: false,
        });
        if (error) return false;
        // A failed cleanup should not make a successful write probe look
        // unhealthy, but this unique path keeps any orphan harmless.
        await storage.remove([path]).catch(() => undefined);
        if (revision !== cadStorageStatusRevision) return false;
        return true;
      } catch {
        return false;
      }
    })();
    primaryProbeInFlight = probe;
    try {
      const healthy = await probe;
      lastPrimaryProbeAt = Date.now();
      lastPrimaryProbeHealthy = healthy;
      return healthy;
    } finally {
      primaryProbeInFlight = null;
    }
  }

  /**
   * Mint a signed chunk upload URL on one instance. The caller retries on
   * `secondary` itself, because it records which instance each part landed on
   * in the chunk manifest — this must never fail over behind its back.
   */
  async mintChunkUpload(storagePath: string, instance: StorageInstance = currentInstance()): Promise<string> {
    await ensureBucket(instance);
    const { data, error } = await supabaseFor(instance)
      .storage.from(storageBucket(instance))
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to mint upload URL: ${error?.message ?? 'unknown error'}`);
    }
    return data.signedUrl;
  }

  /** Sign a download URL on one instance, for the same reason as above. */
  async signDownloadUrl(storagePath: string, expiresInSeconds = 900, instance: StorageInstance = currentInstance()): Promise<string> {
    await ensureBucket(instance);
    const { data, error } = await supabaseFor(instance)
      .storage.from(storageBucket(instance))
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to sign download URL: ${error?.message ?? 'unknown error'}`);
    }
    return data.signedUrl;
  }

  async mintUpload(): Promise<{ uploadURL: string; objectPath: string }> {
    const id = randomUUID();
    const { value, instance } = await writeWithFailover("Failed to mint upload URL", async (target) => {
      const { data, error } = await supabaseFor(target)
        .storage.from(storageBucket(target))
        .createSignedUploadUrl(`uploads/${id}`, { upsert: false });
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "unknown error");
      }
      return data.signedUrl;
    });
    return { uploadURL: value, objectPath: `${objectPathPrefix(instance)}${id}` };
  }

  async listUploads(limit = 20): Promise<{ name: string; objectPath: string; createdAt: string | null }[]> {
    const found = new Map<string, { name: string; objectPath: string; createdAt: string | null }>();
    let lastError: unknown = null;
    for (const instance of readOrder()) {
      try {
        await ensureBucketForWrite(instance);
        const { data, error } = await supabaseFor(instance)
          .storage.from(storageBucket(instance))
          .list("uploads", {
            limit,
            sortBy: { column: "created_at", order: "desc" },
          });
        if (error || !data) {
          if (isStorageRestrictedError(error)) {
            markRestricted(instance);
            continue;
          }
          throw new Error(`Failed to list uploads: ${error?.message ?? "unknown error"}`);
        }
        for (const entry of data) {
          // The preferred instance is visited first, so it owns the entry.
          if (!entry.id || found.has(entry.name) || !/^[A-Za-z0-9-]{8,128}$/.test(entry.name)) continue;
          found.set(entry.name, {
            name: entry.name,
            objectPath: `${objectPathPrefix(instance)}${entry.name}`,
            createdAt: (entry.created_at as string | null) ?? null,
          });
        }
      } catch (error) {
        if (isStorageRestrictedError(error)) {
          markRestricted(instance);
          continue;
        }
        lastError = error;
      }
    }
    if (found.size === 0 && lastError) throw lastError;
    return [...found.values()]
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
      .slice(0, limit);
  }

  /**
   * Uploads bytes to an explicit storage path. Used to persist a finished
   * CAD preview so it survives an instance restart (the preview used to live
   * only in the process's temp directory).
   */
  async uploadToPath(
    storagePath: string,
    data: Buffer,
    contentType: string,
    instance: StorageInstance = currentInstance(),
  ): Promise<void> {
    const { error } = await supabaseFor(instance)
      .storage.from(storageBucket(instance))
      .upload(storagePath, data, { contentType, upsert: true });
    if (error) {
      throw new Error(`Failed to store ${storagePath}: ${error.message}`);
    }
  }

  /** Reads a stored path back as bytes (or null when it is not there). */
  async readFromPath(
    storagePath: string,
    instance: StorageInstance = currentInstance(),
  ): Promise<{ data: Buffer; contentType: string } | null> {
    const { data, error } = await supabaseFor(instance)
      .storage.from(storageBucket(instance))
      .download(storagePath);
    if (error || !data) return null;
    return { data: Buffer.from(await data.arrayBuffer()), contentType: data.type || 'application/octet-stream' };
  }

  async uploadGeneratedImage(data: Buffer, contentType: string): Promise<string> {
    const id = randomUUID();
    const { instance } = await writeWithFailover("Failed to store generated image", async (target) => {
      const { error } = await supabaseFor(target)
        .storage.from(storageBucket(target))
        .upload(`generated/${id}`, data, { contentType, upsert: false });
      if (error) throw new Error(error.message);
    });
    return `${objectPathPrefix(instance)}generated/${id}`;
  }

  async uploadChatImage(data: Buffer, contentType: string): Promise<string> {
    const id = randomUUID();
    const { instance } = await writeWithFailover("Failed to store chat attachment", async (target) => {
      const { error } = await supabaseFor(target)
        .storage.from(storageBucket(target))
        .upload(`uploads/${id}`, data, { contentType, upsert: false });
      if (error) throw new Error(error.message);
    });
    return `${objectPathPrefix(instance)}${id}`;
  }

  async uploadTeamLogo(data: Buffer, contentType: string, teamId: string): Promise<string> {
    const id = randomUUID();
    const path = `team-branding/${teamId}/${id}`;
    const { instance } = await writeWithFailover("Failed to store team logo", async (target) => {
      const { error } = await supabaseFor(target)
        .storage.from(storageBucket(target))
        .upload(path, data, { contentType, upsert: false });
      if (error) throw new Error(error.message);
    });
    return `${objectPathPrefix(instance)}${path}`;
  }

  async deleteObject(objectPath: string): Promise<void> {
    const storagePath = toStoragePath(objectPath);
    let lastError: unknown = null;
    for (const instance of resolveOrder(objectPath, readOrder())) {
      try {
        await ensureBucketForWrite(instance);
        const { error } = await supabaseFor(instance)
          .storage.from(storageBucket(instance))
          .remove([storagePath]);
        if (error) throw new Error(error.message);
        return;
      } catch (error) {
        lastError = error;
        if (isStorageRestrictedError(error)) {
          markRestricted(instance);
          continue;
        }
        // Object may live on the other instance — keep looking.
        if (isNotFound(error)) continue;
        throw error;
      }
    }
    throw lastError ?? new ObjectNotFoundError();
  }

  async deleteStoragePaths(paths: string[], instance: StorageInstance = currentInstance()): Promise<void> {
    if (!paths.length) return;
    await ensureBucket(instance);
    const { error } = await supabaseFor(instance).storage.from(storageBucket(instance)).remove(paths);
    if (error) throw new Error(`Failed to delete storage objects: ${error.message}`);
  }

  /**
   * Streams a stored object to a local file. Used by the CAD preview path so
   * a multi-gigabyte model is fetched server-side (storage -> disk) instead of
   * being downloaded by the browser and uploaded back.
   */
  async downloadObjectToFile(objectPath: string, targetPath: string): Promise<{ contentType: string; sizeBytes: number }> {
    const storagePath = toStoragePath(objectPath);
    const instance = objectStorageInstance(objectPath) ?? currentInstance();
    const { data, error } = await supabaseFor(instance)
      .storage.from(storageBucket(instance))
      .download(storagePath);
    if (error || !data) {
      throw new ObjectNotFoundError();
    }
    // STREAM to disk. Buffering a 166 MB (or larger) model in memory and
    // then running the converter would need ~500 MB in one process, which
    // OOMs a 512 MB instance. Piping the body keeps memory flat.
    const signedUrl = await this.signDownloadUrl(objectPath, 900, instance);
    const upstream = await fetch(signedUrl);
    if (!upstream.ok || !upstream.body) {
      throw new ObjectNotFoundError();
    }
    const handle = await open(targetPath, 'w');
    let sizeBytes = 0;
    try {
      const reader = upstream.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          sizeBytes += value.byteLength;
          await handle.write(value);
        }
      }
    } finally {
      await handle.close();
    }
    return { contentType: data.type || 'application/octet-stream', sizeBytes };
  }

  async downloadObject(objectPath: string): Promise<{ data: Buffer; contentType: string }> {
    const storagePath = toStoragePath(objectPath);
    const downloaded = await readWithFailover<{ data: Buffer; contentType: string }>(
      resolveOrder(objectPath, readOrder()),
      async (instance) => {
        const { data, error } = await supabaseFor(instance)
          .storage.from(storageBucket(instance))
          .download(storagePath);
        if (error || !data) {
          if (isStorageRestrictedError(error)) {
            throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error?.message ?? 'unknown'}`);
          }
          // Not on this instance: object IDs are unique, so the other
          // instance may still hold it.
          return null;
        }
        const buffer = Buffer.from(await data.arrayBuffer());
        return { data: buffer, contentType: data.type || 'application/octet-stream' };
      },
    );
    if (downloaded) return downloaded;
    throw new ObjectNotFoundError();
  }
}