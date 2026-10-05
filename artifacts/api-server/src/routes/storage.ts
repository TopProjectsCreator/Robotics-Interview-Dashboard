import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
  UploadPartsRobotPreviewFileResponse,
  UploadCadModelFileResponse,
  CreateChunkUploadUrlBody,
  CreateChunkUploadUrlResponse,
  CompleteChunkUploadBody,
  CompleteChunkUploadResponse,
} from '@workspace/api-zod';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { createReadStream } from 'node:fs';
import express, { Router, type IRouter, type Request, type Response } from 'express';
import { db, chunkedUploadsTable } from '@workspace/db';
import { eq } from 'drizzle-orm';
import { mkdtemp, open, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';

import { requireCompleteCadconvertFaceSummary } from '../lib/cadconvertPreview';
import {
  MAX_STORAGE_UPLOAD_BYTES,
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage';
import {
  authenticatedInterviewerId,
  requireAdmin,
  requireCoordinator,
  requireWorkspaceAccess,
  requireWorkspaceAccessOrCoordinator,
} from "../middlewares/adminAuth";
import { accountById } from "../lib/interviewerAccounts";
import { validatePartsPreviewFile } from "../lib/partsRobotPreview";
import {
  cadFileMatchesKind,
  cadModelMaxBytes,
  resolveCadUploadKind,
} from "../lib/cadModels";
import {
  CHUNKED_UPLOAD_THRESHOLD_BYTES,
  chunkStoragePath,
  deleteChunkParts,
  getChunkUpload,
  isChunkUploadId,
  streamChunkedUpload,
} from "../lib/chunkedUploads";
import { isPrivateObjectReferenced } from "../lib/privateObjectReferences";

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
const SIGNED_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;

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
    if (parsed.data.size > SIGNED_UPLOAD_MAX_BYTES) {
      res.status(413).json({ error: 'File too big (max 200 MB)' });
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
 * Used for ordinary chat files so browsers avoid cross-origin uploads.
 * Large Parasolid files use the authenticated signed-URL route above.
 * Requires auth. Body is raw media/document bytes (max 100 MB).
 */
const CHAT_UPLOAD_MAX_BYTES = 100 * 1024 * 1024;
const PARASOLID_PYTHON_PREVIEW_MAX_BYTES = 50 * 1024 * 1024;
const PARASOLID_XT_PREVIEW_MAX_BYTES = 200 * 1024 * 1024;
const PARASOLID_PREVIEW_MAX_OUTPUT_BYTES = 256 * 1024 * 1024;
const PARASOLID_PREVIEW_TIMEOUT_MS = 6 * 60_000;
const PARASOLID_PROGRESSIVE_PREVIEW_TIMEOUT_MS = 10 * 60_000;
const PARASOLID_PREVIEW_MAX_CONCURRENT = 1;
let activeParasolidPreviews = 0;
const PARASOLID_PREVIEW_WORKER_PATH = fileURLToPath(
  new URL('./parasolidPreviewWorker.py', import.meta.url),
);
const PARASOLID_PREVIEW_CADPROGRESSIVE_PATH = fileURLToPath(
  new URL('./native/cadprogressive', import.meta.url),
);
const PARASOLID_PROGRESSIVE_MAX_OUTPUT_BYTES = 384 * 1024 * 1024;
const PARASOLID_PROGRESSIVE_TTL_MS = 30 * 60_000;
const PARASOLID_PROGRESSIVE_MAX_CACHED_PREVIEWS = 2;
type ProgressiveTile = {
  id: string;
  bytes: number;
  triangles: number;
  center: [number, number, number];
  radius: number;
};
type ProgressivePreviewFiles = {
  root: string;
  expiresAt: number;
  tileIds: Set<string>;
};
const progressivePreviewFiles = new Map<string, ProgressivePreviewFiles>();

function removeProgressivePreview(previewId: string): void {
  const cached = progressivePreviewFiles.get(previewId);
  if (!cached) return;
  progressivePreviewFiles.delete(previewId);
  void rm(cached.root, { recursive: true, force: true }).catch(() => undefined);
}

function pruneProgressivePreviews(): void {
  const now = Date.now();
  for (const [previewId, cached] of progressivePreviewFiles) {
    if (cached.expiresAt <= now) removeProgressivePreview(previewId);
  }
}

const progressivePreviewSweep = setInterval(pruneProgressivePreviews, 60_000);
progressivePreviewSweep.unref();

function parseProgressiveManifest(value: unknown): {
  overviewBytes: number;
  detailBytes: number;
  triangles: number;
  tiles: ProgressiveTile[];
} {
  if (!value || typeof value !== 'object') {
    throw new Error('Progressive converter returned an invalid manifest');
  }
  const manifest = value as Record<string, unknown>;
  const integer = (candidate: unknown) =>
    typeof candidate === 'number' && Number.isSafeInteger(candidate) && candidate >= 0;
  if (
    manifest.version !== 1 ||
    !integer(manifest.overviewBytes) ||
    manifest.overviewBytes === 0 ||
    !integer(manifest.detailBytes) ||
    !integer(manifest.triangles) ||
    !Array.isArray(manifest.tiles) ||
    manifest.tiles.length === 0 ||
    manifest.tiles.length > 4096
  ) {
    throw new Error('Progressive converter returned an incomplete manifest');
  }
  const tiles = manifest.tiles.map((candidate): ProgressiveTile => {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error('Progressive converter returned an invalid tile');
    }
    const tile = candidate as Record<string, unknown>;
    if (
      typeof tile.id !== 'string' ||
      !/^g\d+$/.test(tile.id) ||
      !integer(tile.bytes) ||
      tile.bytes === 0 ||
      !integer(tile.triangles) ||
      !Array.isArray(tile.center) ||
      tile.center.length !== 3 ||
      !tile.center.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)) ||
      typeof tile.radius !== 'number' ||
      !Number.isFinite(tile.radius) ||
      tile.radius < 0
    ) {
      throw new Error('Progressive converter returned an invalid tile');
    }
    return {
      id: tile.id,
      bytes: tile.bytes as number,
      triangles: tile.triangles as number,
      center: tile.center as [number, number, number],
      radius: tile.radius,
    };
  });
  if (new Set(tiles.map((tile) => tile.id)).size !== tiles.length) {
    throw new Error('Progressive converter returned duplicate tile IDs');
  }
  const detailBytes = tiles.reduce((total, tile) => total + tile.bytes, 0);
  if (detailBytes !== manifest.detailBytes) {
    throw new Error('Progressive converter returned inconsistent detail sizes');
  }
  const triangles = tiles.reduce((total, tile) => total + tile.triangles, 0);
  if (!Number.isSafeInteger(triangles) || triangles !== manifest.triangles) {
    throw new Error('Progressive converter returned inconsistent triangle counts');
  }
  return {
    overviewBytes: manifest.overviewBytes as number,
    detailBytes,
    triangles: manifest.triangles as number,
    tiles,
  };
}
export const CHAT_UPLOAD_CONTENT_TYPES = [
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
  'model/gltf-binary',
  'model/stl',
  'model/obj',
  'model/ply',
  'application/ply',
  'model/3mf',
  'application/3mf',
  'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  'model/x-parasolid',
  'model/step',
  'application/step',
  'application/x-step',
];
export function isAllowedChatUploadType(contentType: string): boolean {
  return CHAT_UPLOAD_CONTENT_TYPES.some((allowed) =>
    allowed.endsWith('/*') ? contentType.startsWith(allowed.slice(0, -1)) : contentType === allowed,
  );
}
function isValidGlb(data: Buffer): boolean {
  return data.length >= 20 &&
    data.toString('ascii', 0, 4) === 'glTF' &&
    data.readUInt32LE(4) === 2 &&
    data.readUInt32LE(8) === data.length;
}
async function isValidGlbFile(filePath: string, fileSize: number): Promise<boolean> {
  if (fileSize < 20) return false;
  const file = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await file.read(header, 0, header.length, 0);
    return bytesRead === header.length &&
      header.toString('ascii', 0, 4) === 'glTF' &&
      header.readUInt32LE(4) === 2 &&
      header.readUInt32LE(8) === fileSize;
  } finally {
    await file.close();
  }
}
export function isPlainMeshUpload(contentType: string): boolean {
  return isObjUpload(contentType) || isPlyUpload(contentType);
}
export function isObjUpload(contentType: string): boolean {
  return contentType === 'model/obj' || contentType === 'text/model/obj';
}
export function isPlyUpload(contentType: string): boolean {
  return contentType === 'model/ply' || contentType === 'application/ply';
}
export function meshKindFor(contentType: string): 'obj' | 'ply' {
  return isObjUpload(contentType) ? 'obj' : 'ply';
}
export function isThreeMfUpload(contentType: string): boolean {
  return (
    contentType === 'model/3mf' ||
    contentType === 'application/3mf' ||
    contentType === 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml'
  );
}
function isValidStl(data: Buffer): boolean {
  if (data.length >= 84) {
    const triangleCount = data.readUInt32LE(80);
    if (triangleCount > 0 && 84 + triangleCount * 50 === data.length) return true;
  }

  if (data.length < 20) return false;
  const header = data.subarray(0, Math.min(512, data.length)).toString('ascii');
  const ending = data.subarray(Math.max(0, data.length - 128)).toString('ascii');
  return /^\s*solid(?:\s|$)/i.test(header) &&
    /\bendsolid(?:\s|$)[\s\S]*$/i.test(ending.trim()) &&
    data.includes('facet') &&
    data.includes('vertex');
}
/**
 * POST /storage/uploads/chunk-url
 *
 * Signed URL for one part of a chunked upload. The browser PUTs each part
 * straight to Supabase, so large files never pass through this process.
 */
router.post('/storage/uploads/chunk-url', requireAdmin, async (req: Request, res: Response) => {
  const parsed = CreateChunkUploadUrlBody.safeParse(req.body);
  if (!parsed.success || !isChunkUploadId(parsed.data.uploadId)) {
    res.status(400).json({ error: 'A valid uploadId and partIndex are required' });
    return;
  }
  try {
    const signedUrl = await objectStorageService.mintChunkUpload(
      chunkStoragePath(parsed.data.uploadId, parsed.data.partIndex),
    );
    res.json(CreateChunkUploadUrlResponse.parse({
      uploadId: parsed.data.uploadId,
      partIndex: parsed.data.partIndex,
      signedUrl,
    }));
  } catch (error) {
    req.log.error({ err: error }, 'Error minting chunk upload URL');
    res.status(500).json({ error: 'Failed to prepare this upload part' });
  }
});

/**
 * POST /storage/uploads/chunk-complete
 *
 * Record the manifest once every part is in storage. Returns the object
 * path to reference from chat messages or robot previews.
 */
router.post('/storage/uploads/chunk-complete', requireAdmin, async (req: Request, res: Response) => {
  const accountId = authenticatedInterviewerId(req);
  const account = accountId ? await accountById(accountId) : undefined;
  if (!account) { res.status(401).json({ error: 'Authentication required' }); return; }
  const parsed = CompleteChunkUploadBody.safeParse(req.body);
  if (!parsed.success || !isChunkUploadId(parsed.data.uploadId)) {
    res.status(400).json({ error: 'Upload manifest is incomplete' });
    return;
  }
  const { uploadId, fileName, contentType, sizeBytes, totalParts, partSizeBytes } = parsed.data;
  if (!fileName?.trim() || !Number.isFinite(totalParts) || totalParts < 1) {
    res.status(400).json({ error: 'Upload manifest is incomplete' });
    return;
  }
  const manifest = {
    fileName: fileName.trim().slice(0, 255),
    contentType: contentType.trim().slice(0, 100) || 'application/octet-stream',
    sizeBytes: Number(sizeBytes) || 0,
    totalParts: Number(totalParts),
    partSizeBytes: Number(partSizeBytes) || 0,
  };
  try {
    await db.insert(chunkedUploadsTable).values({ uploadId, ...manifest, createdBy: account.displayName })
      .onConflictDoUpdate({ target: chunkedUploadsTable.uploadId, set: manifest });
    res.status(201).json(CompleteChunkUploadResponse.parse({ objectPath: `/objects/chunk/${uploadId}` }));
  } catch (error) {
    req.log.error({ err: error }, 'Error finalising chunked upload');
    res.status(500).json({ error: 'Upload could not be finalised' });
  }
});

router.post(
  '/storage/uploads',
  express.raw({ type: CHAT_UPLOAD_CONTENT_TYPES, limit: '100mb' }),
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const data = req.body as Buffer | undefined;
      const contentType = req.get('content-type')?.split(';')[0]?.trim() ?? '';
      if (!data || !Buffer.isBuffer(data) || data.length === 0) {
        res.status(400).json({ error: 'No attachment data received' });
        return;
      }
      if (!isAllowedChatUploadType(contentType)) {
        res.status(400).json({ error: 'This file type is not supported' });
        return;
      }
      if (contentType === 'model/gltf-binary' && !isValidGlb(data)) {
        res.status(400).json({ error: 'This is not a valid GLB 2.0 model' });
        return;
      }
      if (contentType === 'model/stl' && !isValidStl(data)) {
        res.status(400).json({ error: 'This is not a valid STL model' });
        return;
      }
      // A 3MF is a ZIP archive holding an XML model part. Checking it here means
      // a renamed file is rejected at upload instead of failing in the viewer.
      if (isThreeMfUpload(contentType) && !cadFileMatchesKind('three-mf', data)) {
        res.status(400).json({ error: 'This is not a valid 3MF model' });
        return;
      }
      if (isPlainMeshUpload(contentType) && !cadFileMatchesKind(meshKindFor(contentType), data)) {
        res.status(400).json({ error: `This is not a valid ${contentType.includes('obj') ? 'OBJ' : 'PLY'} model` });
        return;
      }
      if (data.length > CHUNKED_UPLOAD_THRESHOLD_BYTES) {
        const maxMb = Math.floor(CHUNKED_UPLOAD_THRESHOLD_BYTES / (1024 * 1024));
        res.status(413).json({
          error: `File too big for a single upload (max ${maxMb} MB). Send it as a chunked upload instead.`,
        });
        return;
      }
      const objectPath = await objectStorageService.uploadChatImage(data, contentType);
      res.status(201).json({ objectPath });
    } catch (error) {
      req.log.error({ err: error }, 'Error storing uploaded attachment');
      res.status(500).json({ error: 'Upload failed on the server' });
    }
  },
);

/**
 * POST /storage/parts-robot-previews
 *
 * Store a validated image or supported CAD file for the authenticated Parts
 * workspace. The returned object path remains private and is served only by
 * the admin-gated /storage/objects route.
 */
router.post(
  '/storage/parts-robot-previews',
  requireAdmin,
  express.raw({ type: 'application/octet-stream', limit: '200mb' }),
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body as Buffer | undefined;
    if (!data || !Buffer.isBuffer(data)) {
      res.status(400).json({ error: 'No preview file data received' });
      return;
    }
    const fileName = typeof req.query.fileName === 'string' ? req.query.fileName.trim() : '';
    const contentType = typeof req.query.contentType === 'string'
      ? req.query.contentType.trim().toLowerCase()
      : '';
    const validationError = validatePartsPreviewFile(fileName, contentType, data);
    if (validationError) {
      res.status(
        validationError.includes('upload limit') ? 413 : 400,
      ).json({ error: validationError });
      return;
    }
    try {
      const objectPath = await objectStorageService.uploadChatImage(data, contentType);
      res.status(201).json(UploadPartsRobotPreviewFileResponse.parse({ objectPath }));
    } catch (error) {
      req.log.error({ err: error }, 'Robot preview upload failed');
      res.status(500).json({ error: 'Unable to store this robot preview.' });
    }
  },
);

/**
 * POST /storage/cad-models
 *
 * Store a CAD file for the CAD workspace. The extension picks the renderer, so
 * both the extension and the bytes are validated before anything is written.
 * Larger CAD files should use the chunked upload endpoints instead so they never
 * pass through this process.
 */
const CAD_UPLOAD_MAX_BYTES = 200 * 1024 * 1024;

router.post(
  '/storage/cad-models',
  requireWorkspaceAccess('cad'),
  express.raw({ type: 'application/octet-stream', limit: '200mb' }),
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body as Buffer | undefined;
    if (!data || !Buffer.isBuffer(data)) {
      res.status(400).json({ error: 'No CAD file data received' });
      return;
    }
    const fileName = typeof req.query.fileName === 'string' ? req.query.fileName.trim() : '';
    const contentType = typeof req.query.contentType === 'string'
      ? req.query.contentType.trim().toLowerCase()
      : '';
    const resolved = resolveCadUploadKind(fileName, contentType);
    if ('error' in resolved) {
      res.status(400).json({ error: resolved.error });
      return;
    }
    const { kind } = resolved;
    if (data.length === 0) {
      res.status(400).json({ error: 'The CAD file is empty' });
      return;
    }
    if (data.length > CAD_UPLOAD_MAX_BYTES) {
      res.status(413).json({ error: 'File too big (max 200 MB)' });
      return;
    }
    const maxBytes = cadModelMaxBytes(kind);
    if (maxBytes !== null && data.length > maxBytes) {
      res.status(413).json({
        error: `This file exceeds the ${Math.floor(maxBytes / (1024 * 1024))} MB limit for its type.`,
      });
      return;
    }
    if (!cadFileMatchesKind(kind, data)) {
      res.status(400).json({ error: `This is not a valid ${kind.toUpperCase()} model` });
      return;
    }
    try {
      const objectPath = await objectStorageService.uploadChatImage(data, resolved.contentType);
      res.status(201).json(UploadCadModelFileResponse.parse({
        objectPath,
        contentType: resolved.contentType,
        sizeBytes: data.length,
      }));
    } catch (error) {
      req.log.error({ err: error }, 'CAD model upload failed');
      res.status(500).json({ error: 'Unable to store this CAD file' });
    }
  },
);

/**
 * POST /storage/parasolid-preview
 *
 * Convert a private Parasolid attachment locally. Large X_T files use the
 * bundled strict-tolerance CAD converter; smaller files and X_B retain the
 * existing local worker. The temporary GLB is returned only to the requester.
 *
 * Gated on CAD workspace access, plus coordinators, because the CAD library can
 * be opened up to other roles in settings and they still need Parasolid
 * previews to work. Coordinators keep access even if CAD is later locked.
 */
router.post(
  '/storage/parasolid-preview',
  requireWorkspaceAccessOrCoordinator('cad'),
  express.raw({ type: 'model/x-parasolid', limit: PARASOLID_XT_PREVIEW_MAX_BYTES }),
  async (req: Request, res: Response) => {
    let data = req.body as Buffer | undefined;
    let retainTempRoot = false;
    const formatHeader = req.get('x-parasolid-format')?.toLowerCase();
    const sourceFormat = formatHeader === 'x-t' || formatHeader === 'x-b' ? formatHeader : null;

    if (!sourceFormat) {
      res.status(400).json({ error: 'Parasolid format must be x_t or x_b' });
      return;
    }
    if (!data || !Buffer.isBuffer(data) || data.length === 0) {
      res.status(400).json({ error: 'No Parasolid model data received' });
      return;
    }
    const inputBytes = data.length;
    const formatLimit = sourceFormat === 'x-t'
      ? PARASOLID_XT_PREVIEW_MAX_BYTES
      : PARASOLID_PYTHON_PREVIEW_MAX_BYTES;
    if (inputBytes > formatLimit) {
      const limitLabel = sourceFormat === 'x-t' ? '200 MB' : '50 MB';
      res.status(413).json({
        error: `Inline ${sourceFormat === 'x-t' ? 'X_T' : 'X_B'} previews are limited to ${limitLabel}; download the CAD file instead`,
      });
      return;
    }
    if (activeParasolidPreviews >= PARASOLID_PREVIEW_MAX_CONCURRENT) {
      res.status(429).json({ error: 'The local CAD preview converter is busy; try again shortly' });
      return;
    }

    activeParasolidPreviews += 1;
    let tempRoot: string | null = null;
    try {
      tempRoot = await mkdtemp(join(tmpdir(), 'robotics-parasolid-preview-'));
      const inputPath = join(tempRoot, sourceFormat === 'x-t' ? 'source.x_t' : 'source.x_b');
      const outputPath = join(tempRoot, 'preview');
      await writeFile(inputPath, data, { mode: 0o600 });
      data = undefined;
      req.body = undefined;

      const useCadconvert = sourceFormat === 'x-t' &&
        inputBytes > PARASOLID_PYTHON_PREVIEW_MAX_BYTES;
      let glbPath: string;
      let partial = false;
      if (useCadconvert) {
        pruneProgressivePreviews();
        const progressiveDir = join(tempRoot, 'progressive');
        const output = await new Promise<string>((resolve, reject) => {
          execFile(
            PARASOLID_PREVIEW_CADPROGRESSIVE_PATH,
            [
              inputPath,
              progressiveDir,
              '--sag',
              '0.01',
              '--angle',
              '8',
              '--overview-sag',
              '0.8',
              '--overview-angle',
              '20',
            ],
            {
              timeout: PARASOLID_PROGRESSIVE_PREVIEW_TIMEOUT_MS,
              maxBuffer: 4 * 1024 * 1024,
              windowsHide: true,
              env: {
                ...process.env,
                RAYON_NUM_THREADS: '2',
                XT_NO_COONS: '1',
              },
            },
            (error, stdout, stderr) => {
              if (error) reject(error);
              else resolve(`${stdout}\n${stderr}`);
            },
          );
        });
        requireCompleteCadconvertFaceSummary(output);
        const rawManifest = JSON.parse(
          await readFile(join(progressiveDir, 'manifest.json'), 'utf8'),
        ) as unknown;
        const manifest = parseProgressiveManifest(rawManifest);
        const totalBytes = manifest.overviewBytes + manifest.detailBytes;
        if (totalBytes > PARASOLID_PROGRESSIVE_MAX_OUTPUT_BYTES) {
          throw new Error('The progressive converter returned an oversized preview');
        }
        const overviewPath = join(progressiveDir, 'overview.glb');
        const overviewStat = await stat(overviewPath);
        if (
          overviewStat.size !== manifest.overviewBytes ||
          !(await isValidGlbFile(overviewPath, overviewStat.size))
        ) {
          throw new Error('The progressive converter returned an invalid overview GLB');
        }
        for (const tile of manifest.tiles) {
          const tilePath = join(progressiveDir, 'tiles', `${tile.id}.glb`);
          const tileStat = await stat(tilePath);
          if (
            tileStat.size !== tile.bytes ||
            !(await isValidGlbFile(tilePath, tileStat.size))
          ) {
            throw new Error(`The progressive converter returned an invalid tile ${tile.id}`);
          }
        }

        while (progressivePreviewFiles.size >= PARASOLID_PROGRESSIVE_MAX_CACHED_PREVIEWS) {
          const oldestId = progressivePreviewFiles.keys().next().value;
          if (!oldestId) break;
          removeProgressivePreview(oldestId);
        }
        const previewId = randomUUID();
        progressivePreviewFiles.set(previewId, {
          root: tempRoot,
          expiresAt: Date.now() + PARASOLID_PROGRESSIVE_TTL_MS,
          tileIds: new Set(manifest.tiles.map((tile) => tile.id)),
        });
        retainTempRoot = true;
        res
          .status(200)
          .setHeader('Cache-Control', 'private, no-store')
          .json({
            previewId,
            overviewBytes: manifest.overviewBytes,
            detailBytes: manifest.detailBytes,
            triangles: manifest.triangles,
            tiles: manifest.tiles,
          });
        return;
      } else {
        glbPath = join(tempRoot, 'preview.glb');
        await new Promise<void>((resolve, reject) => {
          execFile(
            'python',
            [PARASOLID_PREVIEW_WORKER_PATH, inputPath, outputPath],
            {
              timeout: PARASOLID_PREVIEW_TIMEOUT_MS,
              maxBuffer: 256 * 1024,
              windowsHide: true,
            },
            (error) => error ? reject(error) : resolve(),
          );
        });
        const previewReport = JSON.parse(
          await readFile(join(outputPath, 'preview-report.json'), 'utf8'),
        ) as { partial?: unknown };
        partial = previewReport.partial === true;
        glbPath = join(outputPath, 'preview.glb');
      }

      const glbStat = await stat(glbPath);
      if (
        glbStat.size > PARASOLID_PREVIEW_MAX_OUTPUT_BYTES ||
        !(await isValidGlbFile(glbPath, glbStat.size))
      ) {
        throw new Error('The local converter returned an invalid or oversized preview');
      }

      res
        .status(200)
        .setHeader('Content-Type', 'model/gltf-binary')
        .setHeader('Content-Length', String(glbStat.size))
        .setHeader('Cache-Control', 'private, no-store')
        .setHeader('X-Parasolid-Preview-Partial', partial ? 'true' : 'false');
      await pipeline(createReadStream(glbPath), res);
    } catch (error) {
      req.log.warn({ err: error, sourceFormat }, 'Parasolid preview conversion failed');
      if (res.headersSent) return;
      const workerError = error as NodeJS.ErrnoException & { killed?: boolean };
      const timedOut = workerError.killed || workerError.code === 'ETIMEDOUT';
      const unavailable = workerError.code === 'ENOENT';
      res.status(unavailable ? 503 : timedOut ? 504 : 422).json({
        error: unavailable
          ? 'The local Parasolid preview converter is unavailable. Download the CAD file instead.'
          : timedOut
            ? 'Parasolid preview conversion took too long. Download the CAD file instead.'
            : 'This Parasolid model could not be converted for inline preview. Download it to open in CAD.',
      });
    } finally {
      activeParasolidPreviews -= 1;
      if (tempRoot) {
        if (!retainTempRoot) {
          await rm(tempRoot, { recursive: true, force: true }).catch((error) => {
            req.log.warn({ err: error }, 'Could not remove temporary Parasolid preview files');
          });
        }
      }
    }
  },
);

router.get(
  '/storage/parasolid-preview/:previewId/overview',
  requireAdmin,
  async (req: Request, res: Response) => {
    pruneProgressivePreviews();
    const previewId = Array.isArray(req.params.previewId)
      ? req.params.previewId[0]
      : req.params.previewId;
    const cached = progressivePreviewFiles.get(previewId);
    if (!cached) {
      res.status(404).json({ error: 'This progressive CAD preview has expired' });
      return;
    }
    cached.expiresAt = Date.now() + PARASOLID_PROGRESSIVE_TTL_MS;
    const overviewPath = join(cached.root, 'progressive', 'overview.glb');
    try {
      const overviewStat = await stat(overviewPath);
      res
        .status(200)
        .setHeader('Content-Type', 'model/gltf-binary')
        .setHeader('Content-Length', String(overviewStat.size))
        .setHeader('Cache-Control', 'private, no-store');
      await pipeline(createReadStream(overviewPath), res);
    } catch (error) {
      req.log.warn({ err: error, previewId }, 'Could not serve progressive CAD overview');
      if (!res.headersSent) res.status(404).json({ error: 'Preview overview not found' });
    }
  },
);

router.get(
  '/storage/parasolid-preview/:previewId/tiles/:tileId',
  requireAdmin,
  async (req: Request, res: Response) => {
    pruneProgressivePreviews();
    const previewId = Array.isArray(req.params.previewId)
      ? req.params.previewId[0]
      : req.params.previewId;
    const tileId = Array.isArray(req.params.tileId)
      ? req.params.tileId[0]
      : req.params.tileId;
    const cached = progressivePreviewFiles.get(previewId);
    if (!cached || !cached.tileIds.has(tileId) || !/^g\d+$/.test(tileId)) {
      res.status(404).json({ error: 'This progressive CAD detail tile was not found' });
      return;
    }
    cached.expiresAt = Date.now() + PARASOLID_PROGRESSIVE_TTL_MS;
    const tilePath = join(cached.root, 'progressive', 'tiles', `${tileId}.glb`);
    try {
      const tileStat = await stat(tilePath);
      res
        .status(200)
        .setHeader('Content-Type', 'model/gltf-binary')
        .setHeader('Content-Length', String(tileStat.size))
        .setHeader('Cache-Control', 'private, no-store');
      await pipeline(createReadStream(tilePath), res);
    } catch (error) {
      req.log.warn({ err: error, previewId, tileId }, 'Could not serve progressive CAD tile');
      if (!res.headersSent) res.status(404).json({ error: 'Preview detail tile not found' });
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

    if (wildcardPath.startsWith('chunk/')) {
      const uploadId = wildcardPath.slice('chunk/'.length);
      const manifest = await getChunkUpload(uploadId);
      if (!manifest) {
        res.status(404).json({ error: 'Object not found' });
        return;
      }
      res.status(200);
      res.setHeader('Content-Type', manifest.contentType || 'application/octet-stream');
      if (manifest.sizeBytes) res.setHeader('Content-Length', String(manifest.sizeBytes));
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('Content-Disposition', `inline; filename="${manifest.fileName.replace(/"/g, '')}"`);
      await streamChunkedUpload(
        uploadId,
        res as unknown as Parameters<typeof streamChunkedUpload>[1],
        (path) => objectStorageService.signDownloadUrl(path),
      );
      return;
    }

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

    if (wildcardPath.startsWith('chunk/')) {
      const uploadId = wildcardPath.slice('chunk/'.length);
      if (await isPrivateObjectReferenced(objectPath)) {
        res.status(200).json({ ok: true, deleted: false, reason: 'referenced' });
        return;
      }
      const manifest = await getChunkUpload(uploadId);
      if (manifest) {
        await deleteChunkParts(uploadId, manifest.totalParts);
        await db.delete(chunkedUploadsTable).where(eq(chunkedUploadsTable.uploadId, uploadId));
      }
      res.status(200).json({ ok: true, deleted: true });
      return;
    }

    if (await isPrivateObjectReferenced(objectPath)) {
      res.status(200).json({ ok: true, deleted: false, reason: 'referenced' });
      return;
    }
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
