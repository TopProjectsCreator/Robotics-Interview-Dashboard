import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { currentInstance, runWithInstance, type DbInstance } from '@workspace/db';

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
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

// Remember a restricted instance for a few minutes so a dead primary is not
// re-probed on every request. The window is short enough that recovery after
// the quota resets is noticed quickly.
const RESTRICTED_MEMORY_MS = 5 * 60 * 1000;
const restrictedUntil = new Map<DbInstance, number>();

function markRestricted(instance: DbInstance): void {
  restrictedUntil.set(instance, Date.now() + RESTRICTED_MEMORY_MS);
}

function isRestricted(instance: DbInstance): boolean {
  const until = restrictedUntil.get(instance);
  if (until === undefined) return false;
  if (until <= Date.now()) {
    restrictedUntil.delete(instance);
    return false;
  }
  return true;
}

/** True when a second storage instance is configured and could take over. */
export function secondaryStorageConfigured(): boolean {
  return Boolean(process.env.SECONDARY_SUPABASE_URL?.trim());
}

function otherInstance(): DbInstance | null {
  if (!secondaryStorageConfigured()) return null;
  return currentInstance() === 'secondary' ? 'primary' : 'secondary';
}

/** Read order: current instance first, unless it is known-restricted. */
function readOrder(): DbInstance[] {
  const current = currentInstance();
  const other = otherInstance();
  if (!other) return [current];
  return isRestricted(current) ? [other, current] : [current, other];
}

/** Write order: never pick an instance currently known to be restricted. */
function writeOrder(): DbInstance[] {
  const current = currentInstance();
  const other = otherInstance();
  if (!other) return [current];
  return isRestricted(current) ? [other, current] : [current, other];
}

async function within<T>(instance: DbInstance, fn: () => Promise<T>): Promise<T> {
  return runWithInstance(instance, fn);
}

function secondaryConfigured(): boolean {
  return secondaryStorageConfigured();
}

function supabaseUrl(): string {
  const url = currentInstance() === "secondary"
    ? (process.env.SECONDARY_SUPABASE_URL?.trim() || process.env.SUPABASE_URL)
    : process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      'SUPABASE_URL must be set. File storage lives in Supabase Storage.',
    );
  }
  return url.replace(/\/+$/, '');
}

function serviceRoleKey(): string {
  const key = currentInstance() === "secondary"
    ? (process.env.SECONDARY_SUPABASE_SECRET_KEY?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY)
    : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must be set. File storage lives in Supabase Storage.',
    );
  }
  return key;
}

export function storageBucket(): string {
  if (currentInstance() === "secondary") {
    return process.env.SECONDARY_SUPABASE_STORAGE_BUCKET?.trim() || process.env.SUPABASE_STORAGE_BUCKET || 'app-uploads';
  }
  return process.env.SUPABASE_STORAGE_BUCKET || 'app-uploads';
}

let client: SupabaseClient | null = null;
let secondaryClient: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (currentInstance() === "secondary" && secondaryConfigured()) {
    if (!secondaryClient) {
      secondaryClient = createClient(supabaseUrl(), serviceRoleKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return secondaryClient;
  }
  if (!client) {
    client = createClient(supabaseUrl(), serviceRoleKey(), {
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

// Ensure the bucket on ONE instance, translating quota failures into
// StorageRestrictedError so callers can fall back rather than crash.
async function ensureBucketOn(instance: DbInstance): Promise<void> {
  await within(instance, async () => {
    const bucket = storageBucket();
    const storage = supabase().storage;
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
  });
}

// Backwards-compatible export used elsewhere: ensure the current instance.
async function ensureBucket(): Promise<void> {
  const bucketKey = `${currentInstance()}:${storageBucket()}`;
  const existing = ensuredBuckets.get(bucketKey);
  if (existing) return existing;
  const pending = ensureBucketOn(currentInstance()).catch((error: unknown) => {
    ensuredBuckets.delete(bucketKey);
    throw error;
  });
  ensuredBuckets.set(bucketKey, pending);
  return pending;
}

/** Ensure the bucket exists on the instance we are about to write to. */
async function ensureBucketForWrite(instance: DbInstance): Promise<void> {
  const bucketKey = `${instance}:${await within(instance, async () => storageBucket())}`;
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
  const rest = objectPath.slice('/objects/'.length);
  const parts = rest.split('/');
  if (parts.length === 1 && /^[A-Za-z0-9-]{8,128}$/.test(parts[0])) {
    return `uploads/${parts[0]}`;
  }
  if (parts.length === 2 && parts[0] === 'generated' && /^[A-Za-z0-9-]{8,128}$/.test(parts[1])) {
    return `generated/${parts[1]}`;
  }
  throw new ObjectNotFoundError();
}

export class ObjectStorageService {
  constructor() {}

  async mintChunkUpload(storagePath: string): Promise<string> {
    const attempt = async (instance: DbInstance): Promise<string> => within(instance, async () => {
      const { data, error } = await supabase()
        .storage.from(storageBucket())
        .createSignedUploadUrl(storagePath, { upsert: false });
      if (error || !data?.signedUrl) {
        if (isStorageRestrictedError(error)) {
          throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error?.message ?? 'unknown'}`);
        }
        throw new Error(`Failed to mint upload URL: ${error?.message ?? 'unknown error'}`);
      }
      return data.signedUrl;
    });
    const order = writeOrder();
    for (const instance of order) {
      try {
        await ensureBucketForWrite(instance);
        return await attempt(instance);
      } catch (error) {
        if (!isStorageRestrictedError(error)) throw error;
        markRestricted(instance);
      }
    }
    throw new Error('Failed to mint upload URL: storage is restricted on every configured instance');
  }

  async signDownloadUrl(storagePath: string, expiresInSeconds = 900): Promise<string> {
    const attempt = async (instance: DbInstance): Promise<string> => within(instance, async () => {
      const { data, error } = await supabase()
        .storage.from(storageBucket())
        .createSignedUrl(storagePath, expiresInSeconds);
      if (error || !data?.signedUrl) {
        if (isStorageRestrictedError(error)) {
          throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error?.message ?? 'unknown'}`);
        }
        throw new Error(`Failed to sign download URL: ${error?.message ?? 'unknown error'}`);
      }
      return data.signedUrl;
    });
    const order = readOrder();
    for (const instance of order) {
      try {
        await ensureBucketForWrite(instance);
        return await attempt(instance);
      } catch (error) {
        if (isStorageRestrictedError(error)) {
          markRestricted(instance);
          continue;
        }
        // A part may live on the other instance (quota fallback during
        // upload), so a not-found here is not fatal — try the next one.
        if (/not found|does not exist|404/i.test(String(error instanceof Error ? error.message : error))) {
          continue;
        }
        throw error;
      }
    }
    throw new Error(`Failed to sign download URL: object not found on any configured instance`);
  }

  async mintUpload(): Promise<{ uploadURL: string; objectPath: string }> {
    const id = randomUUID();
    const attempt = async (instance: DbInstance): Promise<string> => within(instance, async () => {
      const bucket = storageBucket();
      const { data, error } = await supabase()
        .storage.from(bucket)
        .createSignedUploadUrl(`uploads/${id}`, { upsert: false });
      if (error || !data?.signedUrl) {
        if (isStorageRestrictedError(error)) {
          throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error?.message ?? 'unknown'}`);
        }
        throw new Error(`Failed to mint upload URL: ${error?.message ?? 'unknown error'}`);
      }
      return data.signedUrl;
    });
    const order = writeOrder();
    for (const instance of order) {
      try {
        await ensureBucketForWrite(instance);
        const uploadURL = await attempt(instance);
        return { uploadURL, objectPath: `/objects/${id}` };
      } catch (error) {
        if (!isStorageRestrictedError(error)) throw error;
        markRestricted(instance);
      }
    }
    throw new Error('Failed to mint upload URL: storage is restricted on every configured instance');
  }

  async listUploads(limit = 20): Promise<{ name: string; objectPath: string; createdAt: string | null }[]> {
    const attempt = async (instance: DbInstance) => within(instance, async () => {
      const { data, error } = await supabase().storage.from(storageBucket()).list("uploads", {
        limit,
        sortBy: { column: "created_at", order: "desc" },
      });
      if (error || !data) {
        if (isStorageRestrictedError(error)) {
          throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error?.message ?? 'unknown'}`);
        }
        return null;
      }
      return data
        .filter((entry) => entry.id && /^[A-Za-z0-9-]{8,128}$/.test(entry.name))
        .map((entry) => ({
          name: entry.name,
          objectPath: `/objects/${entry.name}`,
          createdAt: (entry.created_at as string | null) ?? null,
        }));
    });
    const order = readOrder();
    let listed: Awaited<ReturnType<typeof attempt>> = null;
    for (const instance of order) {
      try {
        await ensureBucketForWrite(instance);
        listed = await attempt(instance);
      } catch (error) {
        if (isStorageRestrictedError(error)) {
          markRestricted(instance);
          continue;
        }
        throw error;
      }
      if (listed && listed.length > 0) return listed;
    }
    return listed ?? [];
  }

  async uploadGeneratedImage(data: Buffer, contentType: string): Promise<string> {
    const attempt = async (instance: DbInstance): Promise<string> => within(instance, async () => {
      const id = randomUUID();
      const storagePath = `generated/${id}`;
      const { error } = await supabase()
        .storage.from(storageBucket())
        .upload(storagePath, data, { contentType, upsert: false });
      if (error) {
        if (isStorageRestrictedError(error)) {
          throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error.message}`);
        }
        throw new Error(`Failed to store generated image: ${error.message}`);
      }
      return `/objects/generated/${id}`;
    });
    const order = writeOrder();
    for (const instance of order) {
      try {
        await ensureBucketForWrite(instance);
        return await attempt(instance);
      } catch (error) {
        if (!isStorageRestrictedError(error)) throw error;
        markRestricted(instance);
      }
    }
    throw new Error('Failed to store generated image: storage is restricted on every configured instance');
  }

  async uploadChatImage(data: Buffer, contentType: string): Promise<string> {
    const attempt = async (instance: DbInstance): Promise<string> => within(instance, async () => {
      const id = randomUUID();
      const storagePath = `uploads/${id}`;
      const { error } = await supabase()
        .storage.from(storageBucket())
        .upload(storagePath, data, { contentType, upsert: false });
      if (error) {
        if (isStorageRestrictedError(error)) {
          throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error.message}`);
        }
        throw new Error(`Failed to store chat attachment: ${error.message}`);
      }
      return `/objects/${id}`;
    });
    const order = writeOrder();
    for (const instance of order) {
      try {
        await ensureBucketForWrite(instance);
        return await attempt(instance);
      } catch (error) {
        if (!isStorageRestrictedError(error)) throw error;
        markRestricted(instance);
      }
    }
    throw new Error('Failed to store chat attachment: storage is restricted on every configured instance');
  }

  async deleteObject(objectPath: string): Promise<void> {
    const storagePath = toStoragePath(objectPath);
    const order = readOrder();
    let lastError: unknown = null;
    for (const instance of order) {
      try {
        await ensureBucketForWrite(instance);
        const { error } = await within(instance, async () => supabase()
          .storage.from(storageBucket())
          .remove([storagePath]));
        if (error) throw new Error(error.message);
        return;
      } catch (error) {
        lastError = error;
        if (isStorageRestrictedError(error)) {
          markRestricted(instance);
          continue;
        }
        // Object may live on the other instance — keep looking.
        if (/not found|does not exist|404/i.test(String(error instanceof Error ? error.message : error))) {
          continue;
        }
        throw error;
      }
    }
    if (lastError) throw lastError;
  }

  async downloadObject(objectPath: string): Promise<{ data: Buffer; contentType: string }> {
    const storagePath = toStoragePath(objectPath);
    const order = readOrder();
    for (const instance of order) {
      try {
        await ensureBucketForWrite(instance);
        const result = await within(instance, async () => {
          const { data, error } = await supabase().storage.from(storageBucket()).download(storagePath);
          if (error || !data) {
            if (isStorageRestrictedError(error)) {
              throw new StorageRestrictedError(`Storage on ${instance} is restricted: ${error?.message ?? 'unknown'}`);
            }
            return null;
          }
          const buffer = Buffer.from(await data.arrayBuffer());
          return { data: buffer, contentType: data.type || 'application/octet-stream' };
        });
        if (result) return result;
        // Not on this instance: object IDs are unique, so the other instance
        // may hold it (files written during a quota fallback).
        continue;
      } catch (error) {
        if (isStorageRestrictedError(error)) {
          markRestricted(instance);
          continue;
        }
        throw error;
      }
    }
    throw new ObjectNotFoundError();
  }
}
