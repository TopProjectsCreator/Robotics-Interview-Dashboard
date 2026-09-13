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
  const id = objectPath.slice('/objects/'.length);
  if (!/^[A-Za-z0-9-]{8,128}$/.test(id)) {
    throw new ObjectNotFoundError();
  }
  return `uploads/${id}`;
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
      .createSignedUploadUrl(storagePath, 900);
    if (error || !data?.signedUrl) {
      throw new Error(`Failed to mint upload URL: ${error?.message ?? 'unknown error'}`);
    }
    return { uploadURL: data.signedUrl, objectPath: `/objects/${id}` };
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
