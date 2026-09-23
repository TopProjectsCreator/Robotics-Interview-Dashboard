import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from '@workspace/api-zod';
import express, { Router, type IRouter, type Request, type Response } from 'express';

import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';
import { requireAdmin } from "../middlewares/adminAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function hasAuthenticatedSession(
  req: Request,
): req is Request & { isAuthenticated: () => boolean } {
  if (
    !('isAuthenticated' in req) ||
    typeof req.isAuthenticated !== 'function'
  ) {
    return false;
  }

  return req.isAuthenticated();
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a signed URL for file upload. Files live in Supabase Storage
 * (private bucket); the client sends JSON metadata (name, size,
 * contentType) — NOT the file — then uploads the file directly to the
 * returned signed URL. Requires auth so public callers cannot mint
 * write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    if (!hasAuthenticatedSession(req)) {
      res.status(401).json({ error: 'Unauthorized' });

      return;
    }

    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Missing or invalid required fields' });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const { uploadURL, objectPath } = await objectStorageService.mintUpload();

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * POST /storage/uploads
 *
 * Upload a chat attachment through the API server (same-origin), which stores
 * it in Supabase Storage with the service key and returns the object path.
 * Used by chat attachments so browsers never PUT directly to Supabase —
 * some networks/firewalls block those cross-origin uploads. Requires auth.
 * Body is raw media/document bytes (max 100 MB).
 */
const CHAT_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const CHAT_UPLOAD_CONTENT_TYPES = [
  'image/*',
  'video/*',
  'audio/*',
  'application/pdf',
  'application/msword',
  'application/rtf',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/csv',
  'text/plain',
  'text/tab-separated-values',
];
function isAllowedChatUploadType(contentType: string): boolean {
  return CHAT_UPLOAD_CONTENT_TYPES.some((allowed) =>
    allowed.endsWith('/*') ? contentType.startsWith(allowed.slice(0, -1)) : contentType === allowed,
  );
}
router.post(
  '/storage/uploads',
  express.raw({ type: CHAT_UPLOAD_CONTENT_TYPES, limit: '100mb' }),
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const data = req.body as Buffer | undefined;
      const contentType = req.get('content-type')?.split(';')[0]?.trim() ?? '';
      if (!data || !Buffer.isBuffer(data) || data.length === 0) {
        res.status(400).json({ error: 'No image data received' });
        return;
      }
      if (!isAllowedChatUploadType(contentType)) {
        res.status(400).json({ error: 'This file type is not supported' });
        return;
      }
      if (data.length > CHAT_UPLOAD_MAX_BYTES) {
        res.status(413).json({ error: 'File too big (max 100 MB)' });
        return;
      }
      const objectPath = await objectStorageService.uploadChatImage(data, contentType);
      res.status(201).json({ objectPath });
    } catch (error) {
      req.log.error({ err: error }, 'Error storing uploaded image');
      res.status(500).json({ error: 'Upload failed on the server' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve files from Supabase Storage. Admin-only; browsers send the session
 * cookie automatically (including <img> loads), so private roster files and
 * profile photos stay inside the coordinator workspace.
 */
router.get('/storage/objects/*path', requireAdmin, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const { data, contentType } = await objectStorageService.downloadObject(objectPath);

    res.status(200);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(data.byteLength));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(data);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

/**
 * DELETE /storage/objects/*
 *
 * Remove a file from Supabase Storage. Admin-only. Used to clean up
 * orphaned uploads (e.g. images removed from a chat message before send).
 */
router.delete('/storage/objects/*path', requireAdmin, async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath = `/objects/${wildcardPath}`;
    try {
      await objectStorageService.downloadObject(objectPath);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        res.status(404).json({ error: 'Object not found' });
        return;
      }
      throw error;
    }
    await objectStorageService.deleteObject(objectPath);
    res.status(200).json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, 'Error deleting object');
    res.status(500).json({ error: 'Failed to delete object' });
  }
});

export default router;
