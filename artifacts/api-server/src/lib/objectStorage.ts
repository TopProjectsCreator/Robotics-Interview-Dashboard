import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { currentInstance } from '@workspace/db';

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export type StorageInstance = "primary" | "secondary";

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

let client: SupabaseClient | null = null;
let secondaryClient: SupabaseClient | null = null;

export function hasSecondaryStorage(): boolean {
  return Boolean(process.env.SECONDARY_SUPABASE_URL?.trim() && process.env.SECONDARY_SUPABASE_SECRET_KEY?.trim());
}

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

function supabase(): SupabaseClient {
  return supabaseFor(currentInstance());
}

const ensuredBuckets = new Map<string, Promise<void>>();
// Supabase rejects a bucket file_size_limit above the plan maximum (50 MB on
// the current plan), and the error is unrelated to bucket existence. Stay at
// or below that ceiling so the request is always accepted.
export const MAX_STORAGE_UPLOAD_BYTES = 50 * 1024 * 1024;

function ensureBucket(instance: StorageInstance = currentInstance()): Promise<void> {
  const bucketKey = `${instance}:${storageBucket(instance)}`;
  const existing = ensuredBuckets.get(bucketKey);
  if (existing) return existing;
  const pending = (async () => {
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
          throw new Error(`Could not create Supabase storage bucket "${bucket}": ${error.message}`);
        }
      }
      if (error) {
        const { data: existing, error: lookupError } = await storage.getBucket(bucket);
        if (lookupError || !existing) {
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
    })().catch((error: unknown) => {
      ensuredBuckets.delete(bucketKey);
      throw error;
    });
  ensuredBuckets.set(bucketKey, pending);
  return pending;
}

function toStoragePath(objectPath: string): string {
  if (!objectPath.startsWith('/objects/')) {
    throw new ObjectNotFoundError();
  }
  const rest = objectPath.slice('/objects/'.length).replace(/^secondary\//, '');
  const parts = rest.split('/');
  if (parts.length === 1 && /^[A-Za-z0-9-]{8,128}$/.test(parts[0])) {
    return `uploads/${parts[0]}`;
  }
  if (parts.length === 2 && parts[0] === 'generated' && /^[A-Za-z0-9-]{8,128}$/.test(parts[1])) {
    return `generated/${parts[1]}`;
  }
  throw new ObjectNotFoundError();
}

function objectStorageInstance(objectPath: string): StorageInstance {
  return objectPath.startsWith("/objects/secondary/") ? "secondary" : currentInstance();
}

function objectPathPrefix(instance: StorageInstance): string {
  return instance === "secondary" ? "/objects/secondary/" : "/objects/";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function withPrimaryStorageFallback<T>(
  operationName: string,
  operation: (instance: StorageInstance) => Promise<T>,
): Promise<T> {
  const primary = currentInstance();
  try {
    return await operation(primary);
  } catch (primaryError) {
    if (primary !== "primary" || !hasSecondaryStorage()) {
      throw new Error(`${operationName}: ${errorMessage(primaryError)}`);
    }
    try {
      return await operation("secondary");
    } catch (secondaryError) {
      throw new Error(
        `${operationName} failed on primary (${errorMessage(primaryError)}) and secondary (${errorMessage(secondaryError)})`,
      );
    }
  }
}

export class ObjectStorageService {
  constructor() {}

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
    return withPrimaryStorageFallback("Failed to mint upload URL", async (instance) => {
      await ensureBucket(instance);
      const id = randomUUID();
      const { data, error } = await supabaseFor(instance)
        .storage.from(storageBucket(instance))
        .createSignedUploadUrl(`uploads/${id}`, { upsert: false });
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "unknown error");
      }
      return {
        uploadURL: data.signedUrl,
        objectPath: `${objectPathPrefix(instance)}${id}`,
      };
    });
  }

  async listUploads(limit = 20): Promise<{ name: string; objectPath: string; createdAt: string | null }[]> {
    await ensureBucket();
    const { data, error } = await supabase().storage.from(storageBucket()).list("uploads", {
      limit,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error || !data) {
      throw new Error(`Failed to list uploads: ${error?.message ?? "unknown error"}`);
    }
    return data
      .filter((entry) => entry.id && /^[A-Za-z0-9-]{8,128}$/.test(entry.name))
      .map((entry) => ({
        name: entry.name,
        objectPath: `/objects/${entry.name}`,
        createdAt: (entry.created_at as string | null) ?? null,
      }));
  }

  async uploadGeneratedImage(data: Buffer, contentType: string): Promise<string> {
    return withPrimaryStorageFallback("Failed to store generated image", async (instance) => {
      await ensureBucket(instance);
      const id = randomUUID();
      const storagePath = `generated/${id}`;
      const { error } = await supabaseFor(instance)
        .storage.from(storageBucket(instance))
        .upload(storagePath, data, { contentType, upsert: false });
      if (error) throw new Error(error.message);
      return `${objectPathPrefix(instance)}generated/${id}`;
    });
  }

  async uploadChatImage(data: Buffer, contentType: string): Promise<string> {
    const primary = currentInstance();
    const uploadTo = async (instance: StorageInstance) => {
      await ensureBucket(instance);
      const id = randomUUID();
      const storagePath = `uploads/${id}`;
      const { error } = await supabaseFor(instance)
        .storage.from(storageBucket(instance))
        .upload(storagePath, data, { contentType, upsert: false });
      if (error) throw new Error(error.message);
      return `${objectPathPrefix(instance)}${id}`;
    };
    try {
      return await uploadTo(primary);
    } catch (primaryError) {
      if (primary !== "primary" || !hasSecondaryStorage()) {
        throw new Error(`Failed to store chat attachment: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
      }
      try {
        return await uploadTo("secondary");
      } catch (secondaryError) {
        throw new Error(`Failed to store chat attachment on primary and secondary: ${secondaryError instanceof Error ? secondaryError.message : String(secondaryError)}`);
      }
    }
  }

  async deleteObject(objectPath: string): Promise<void> {
    const instance = objectStorageInstance(objectPath);
    await ensureBucket(instance);
    const storagePath = toStoragePath(objectPath);
    const { error } = await supabaseFor(instance).storage.from(storageBucket(instance)).remove([storagePath]);
    if (error) {
      throw new Error(`Failed to delete object: ${error.message}`);
    }
  }

  async deleteStoragePaths(paths: string[], instance: StorageInstance = currentInstance()): Promise<void> {
    if (!paths.length) return;
    await ensureBucket(instance);
    const { error } = await supabaseFor(instance).storage.from(storageBucket(instance)).remove(paths);
    if (error) throw new Error(`Failed to delete storage objects: ${error.message}`);
  }

  async downloadObject(objectPath: string): Promise<{ data: Buffer; contentType: string }> {
    const instance = objectStorageInstance(objectPath);
    await ensureBucket(instance);
    const storagePath = toStoragePath(objectPath);
    const { data, error } = await supabaseFor(instance).storage.from(storageBucket(instance)).download(storagePath);
    if (error || !data) {
      throw new ObjectNotFoundError();
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    return { data: buffer, contentType: data.type || 'application/octet-stream' };
  }
}
