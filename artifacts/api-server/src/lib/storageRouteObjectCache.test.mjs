import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const schema = { parse: (value) => value, safeParse: (value) => ({ success: true, data: value }) };

let importId = 0;
async function loadStorageObjectsRoute(t) {
  const downloads = [];
  mock.module("@workspace/api-zod", {
    namedExports: {
      AbortChunkUploadBody: schema,
      AbortChunkUploadResponse: schema,
      RequestUploadUrlBody: schema,
      RequestUploadUrlResponse: schema,
      UploadPartsRobotPreviewFileResponse: schema,
      UploadCadModelFileResponse: schema,
      CreateChunkUploadUrlBody: schema,
      CreateChunkUploadUrlResponse: schema,
      CompleteChunkUploadBody: schema,
      CompleteChunkUploadResponse: schema,
      GetCadStorageStatusResponse: schema,
    },
  });
  const dbChain = { where: () => ({ limit: async () => [] }) };
  mock.module("@workspace/db", {
    namedExports: {
      cadPreviewJobsTable: {},
      chunkedUploadsTable: {},
      currentInstance: () => "primary",
      db: {
        select: () => ({ from: () => dbChain }),
        insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => [] }) }) }),
        update: () => ({ set: () => ({ where: async () => [] }) }),
      },
    },
  });
  mock.module("../lib/chunkedUploads", {
    namedExports: {
      CHUNKED_UPLOAD_THRESHOLD_BYTES: 5 * 1024 * 1024,
      chunkStoragePath: () => "chunk/path",
      deleteChunkParts: async () => undefined,
      getChunkUpload: async () => null,
      getChunkUploadForTeam: async () => null,
      isChunkUploadId: () => true,
      materializeChunkedUpload: async () => undefined,
      streamChunkedUpload: async () => undefined,
    },
  });
  mock.module("../lib/logger", { namedExports: { logger: { info() {}, warn() {}, error() {} } } });
  mock.module("../lib/objectStorage", {
    namedExports: {
      MAX_STORAGE_UPLOAD_BYTES: 50 * 1024 * 1024,
      hasSecondaryStorage: () => false,
      getCadStorageStatus: () => ({ usingBackupStorage: false, lastFailoverAt: null, lastRecoveryAt: null }),
      ObjectNotFoundError: class ObjectNotFoundError extends Error {},
      storageInstanceRestricted: () => false,
      recordCadStorageFailover: () => false,
      recordCadStorageRecovery: () => false,
      ObjectStorageService: class ObjectStorageService {
        async downloadObject(path) {
          downloads.push(path);
          return { data: Buffer.from("ok"), contentType: "application/octet-stream" };
        }
        async probePrimaryStorageWrite() {
          return true;
        }
      },
    },
  });
  mock.module("drizzle-orm", { namedExports: { and: (...v) => v, eq: (...v) => v, lt: (...v) => v } });
  mock.module("../lib/cadconvertPreview", { namedExports: { requireCompleteCadconvertFaceSummary: () => undefined } });
  mock.module("../middlewares/adminAuth", {
    namedExports: {
      authenticatedInterviewerId: () => "acct",
      requestTeamId: async () => "default",
      requireAdmin: (_req, _res, next) => next(),
      requireCoordinator: (_req, _res, next) => next(),
      requireWolverinesCoordinator: (_req, _res, next) => next(),
      requireWorkspaceAccess: () => (_req, _res, next) => next(),
      requireWorkspaceAccessOrCoordinator: () => (_req, _res, next) => next(),
    },
  });
  mock.module("../lib/interviewerAccounts", { namedExports: { accountById: async () => null } });
  mock.module("../lib/partsRobotPreview", { namedExports: { validatePartsPreviewFile: () => ({ ok: true }) } });
  mock.module("../lib/cadModels", {
    namedExports: {
      cadFileMatchesKind: () => true,
      cadModelMaxBytes: () => 50 * 1024 * 1024,
      resolveCadUploadKind: () => ({ contentType: "application/octet-stream" }),
    },
  });
  mock.module("../lib/privateObjectReferences", { namedExports: { isPrivateObjectReferenced: async () => false } });
  t.after(() => mock.restoreAll());

  const router = await import(`../routes/storage.ts?cache-test=${++importId}`);
  const layer = router.default.stack.find(
    (entry) => entry.route?.path === "/storage/objects/*path" && entry.route?.methods.get,
  );
  return { handler: layer.route.stack[layer.route.stack.length - 1].handle, downloads };
}

function fakeRes() {
  const headers = new Map();
  return {
    statusCode: 200,
    sent: null,
    ended: false,
    headers,
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), String(value));
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.sent = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
    json(body) {
      this.sent = body;
      return this;
    },
  };
}

test("object route returns 304 from ETag without re-downloading from storage", async (t) => {
  const { handler, downloads } = await loadStorageObjectsRoute(t);
  const objectPath = "/objects/upload-123";
  const etag = `W/"${createHash("sha1").update(objectPath).digest("hex").slice(0, 24)}"`;
  const res = fakeRes();
  await handler(
    {
      params: { path: "upload-123" },
      headers: { "if-none-match": etag },
      log: { warn() {}, error() {} },
    },
    res,
  );
  assert.equal(res.statusCode, 304);
  assert.equal(downloads.length, 0);
  assert.equal(res.headers.get("etag"), etag);
  assert.equal(res.headers.get("cache-control"), "private, max-age=31536000, immutable");
});

test("object route downloads and serves data when validators do not match", async (t) => {
  const { handler, downloads } = await loadStorageObjectsRoute(t);
  const res = fakeRes();
  await handler(
    {
      params: { path: "upload-123" },
      headers: {},
      log: { warn() {}, error() {} },
    },
    res,
  );
  assert.equal(res.statusCode, 200);
  assert.equal(downloads.length, 1);
  assert.equal(Buffer.isBuffer(res.sent), true);
});
