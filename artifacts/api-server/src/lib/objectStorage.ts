import { randomUUID } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export class ObjectNotFoundError extends Error {
  constructor() {
    super('Object not found');
    this.name = 'ObjectNotFoundError';
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

function supabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      'SUPABASE_URL must be set. File storage lives in Supabase Storage.',
    );
  }
  return url.replace(/\/+$/, '');
}

function serviceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY must be set. File storage lives in Supabase Storage.',
    );
  }
  return key;
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'app-uploads';
}

let client: SupabaseClient | null = null;

function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(supabaseUrl(), serviceRoleKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

let ensuredBucket: Promise<void> | null = null;

function ensureBucket(): Promise<void> {
  if (!ensuredBucket) {
    ensuredBucket = (async () => {
      const bucket = storageBucket();
      const { error } = await supabase().storage.createBucket(bucket, { public: false });
      // "already exists" is the happy path on warm starts.
      if (error && !/already exists|duplicate/i.test(error.message)) {
        throw new Error(`Could not create Supabase storage bucket "${bucket}": ${error.message}`);
      }
    })().catch((error: unknown) => {
      ensuredBucket = null;
      throw error;
    });
  }
  return ensuredBucket;
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
