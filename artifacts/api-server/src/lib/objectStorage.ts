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
  if (currentInstance() === "secondary" && process.env.SECONDARY_SUPABASE_URL?.trim()) {
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

function ensureBucket(): Promise<void> {
  const bucketKey = `${currentInstance()}:${storageBucket()}`;
  const existing = ensuredBuckets.get(bucketKey);
  if (existing) return existing;
  const pending = (async () => {
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
    await ensureBucket();
    const { data, error } = await supabase()
      .storage.from(storageBucket())
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to mint upload URL: ${error?.message ?? 'unknown error'}`);
    }
    return data.signedUrl;
  }

  async signDownloadUrl(storagePath: string, expiresInSeconds = 900): Promise<string> {
    await ensureBucket();
    const { data, error } = await supabase()
      .storage.from(storageBucket())
      .createSignedUrl(storagePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to sign download URL: ${error?.message ?? 'unknown error'}`);
    }
    return data.signedUrl;
  }

  async mintUpload(): Promise<{ uploadURL: string; objectPath: string }> {
    await ensureBucket();
    const bucket = storageBucket();
    const id = randomUUID();
    const storagePath = `uploads/${id}`;
    const { data, error } = await supabase()
      .storage.from(bucket)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to mint upload URL: ${error?.message ?? 'unknown error'}`);
    }
    return { uploadURL: data.signedUrl, objectPath: `/objects/${id}` };
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

  async uploadGeneratedImage(data: Buffer, contentType: string): Promise<string> {    await ensureBucket();
    const id = randomUUID();
    const storagePath = `generated/${id}`;
    const { error } = await supabase()
      .storage.from(storageBucket())
      .upload(storagePath, data, { contentType, upsert: false });
    if (error) {
      throw new Error(`Failed to store generated image: ${error.message}`);
    }
    return `/objects/generated/${id}`;
  }

  async uploadChatImage(data: Buffer, contentType: string): Promise<string> {
    await ensureBucket();
    const id = randomUUID();
    const storagePath = `uploads/${id}`;
    const { error } = await supabase()
      .storage.from(storageBucket())
      .upload(storagePath, data, { contentType, upsert: false });
    if (error) {
      throw new Error(`Failed to store chat attachment: ${error.message}`);
    }
    return `/objects/${id}`;
  }

  async deleteObject(objectPath: string): Promise<void> {
    await ensureBucket();
    const storagePath = toStoragePath(objectPath);
    const { error } = await supabase().storage.from(storageBucket()).remove([storagePath]);
    if (error) {
      throw new Error(`Failed to delete object: ${error.message}`);
    }
  }

  async downloadObject(objectPath: string): Promise<{ data: Buffer; contentType: string }> {
    await ensureBucket();
    const storagePath = toStoragePath(objectPath);
    const { data, error } = await supabase().storage.from(storageBucket()).download(storagePath);
    if (error || !data) {
      throw new ObjectNotFoundError();
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    return { data: buffer, contentType: data.type || 'application/octet-stream' };
  }
}
