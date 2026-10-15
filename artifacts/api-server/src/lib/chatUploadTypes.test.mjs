import assert from "node:assert/strict";
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

/** A ZIP carrying the mandatory 3D model part, which is what a 3MF must be. */
function threeMfBytes() {
  return Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x03, 0x04]),
    Buffer.from("3D/3dmodel.model "),
  ]);
}

// ESM named imports are resolved statically, so every generated schema the
// storage route imports has to be listed explicitly.
const SCHEMA_NAMES = [
  "RequestUploadUrlBody",
  "RequestUploadUrlResponse",
  "UploadPartsRobotPreviewFileResponse",
  "UploadCadModelFileResponse",
  "CreateChunkUploadUrlBody",
  "CreateChunkUploadUrlResponse",
  "AbortChunkUploadBody",
  "AbortChunkUploadResponse",
  "CompleteChunkUploadBody",
  "CompleteChunkUploadResponse",
  "GetCadStorageStatusResponse",
];

let importId = 0;
async function loadStorage(t) {
  // Mocks are process-wide, so each test registers its own and tears them down.
  t.after(() => mock.restoreAll());
  const namedExports = { db: {}, pool: {}, chunkedUploadsTable: { uploadId: "upload_id" } };
  for (const name of SCHEMA_NAMES) {
    namedExports[name] = {
      safeParse: (value) => ({ success: true, data: value }),
      parse: (value) => value,
    };
  }
  mock.module("@workspace/api-zod", { namedExports });
  mock.module("@workspace/db", {
    namedExports: {
      db: {},
      pool: {},
      currentInstance: () => "primary",
      chunkedUploadsTable: { uploadId: "upload_id" },
      teamsTable: {},
      DEFAULT_TEAM_ID: "default",
      normalizeTeamName: (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase(),
    },
  });
  mock.module("../lib/objectStorage", {
    namedExports: {
      MAX_STORAGE_UPLOAD_BYTES: 50 * 1024 * 1024,
      hasSecondaryStorage: () => false,
      getCadStorageStatus: () => ({
        usingBackupStorage: false,
        lastFailoverAt: null,
        lastRecoveryAt: null,
      }),
      recordCadStorageFailover: () => false,
      recordCadStorageRecovery: () => false,
      ObjectNotFoundError: class extends Error {},
      ObjectStorageService: class {},
    },
  });
  mock.module("../middlewares/adminAuth", {
    namedExports: {
      authenticatedInterviewerId: () => "account-1",
      requireAdmin: (_req, _res, next) => next(),
      requireCoordinator: (_req, _res, next) => next(),
      requireWorkspaceAccess: () => (_req, _res, next) => next(),
      requireWorkspaceAccessOrCoordinator: () => (_req, _res, next) => next(),
      requestTeamId: async () => "default",
      requestTeamIdSync: () => "default",
    },
  });
  mock.module("../lib/interviewerAccounts", {
    namedExports: { accountById: async () => ({ displayName: "Ada" }) },
  });
  const module = await import(`../routes/storage.ts?test=${++importId}`);
  return {
    CHAT_UPLOAD_CONTENT_TYPES: module.CHAT_UPLOAD_CONTENT_TYPES,
    isAllowedChatUploadType: module.isAllowedChatUploadType,
    isThreeMfUpload: module.isThreeMfUpload,
    isPlainMeshUpload: module.isPlainMeshUpload,
    isObjUpload: module.isObjUpload,
    isPlyUpload: module.isPlyUpload,
    meshKindFor: module.meshKindFor,
  };
}

test("chat uploads accept 3MF under every type a browser might report", async (t) => {
  const { CHAT_UPLOAD_CONTENT_TYPES, isAllowedChatUploadType } = await loadStorage(t);
  for (const type of [
    "model/3mf",
    "application/3mf",
    "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  ]) {
    assert.ok(
      CHAT_UPLOAD_CONTENT_TYPES.includes(type),
      `${type} should be on the chat upload allow-list`,
    );
    assert.equal(isAllowedChatUploadType(type), true, `${type} should be allowed`);
  }
});

test("the other CAD formats keep working alongside 3MF, OBJ, and PLY", async (t) => {
  const { isAllowedChatUploadType, CHAT_UPLOAD_CONTENT_TYPES } = await loadStorage(t);
  for (const type of [
    "model/gltf-binary",
    "model/stl",
    "model/obj",
    "model/ply",
    "application/ply",
    "model/step",
    "model/x-parasolid",
  ]) {
    assert.equal(isAllowedChatUploadType(type), true, `${type} should still be allowed`);
  }
  // Unrelated formats must stay rejected.
  assert.equal(isAllowedChatUploadType("application/x-msdownload"), false);
  assert.equal(isAllowedChatUploadType("application/octet-stream"), false);
  // A duplicate entry would let a later edit drift out of sync.
  assert.equal(
    new Set(CHAT_UPLOAD_CONTENT_TYPES).size,
    CHAT_UPLOAD_CONTENT_TYPES.length,
    "the allow-list should not repeat a type",
  );
});

test("identifies the 3MF content types so they can be signature-checked", async (t) => {
  const { isThreeMfUpload } = await loadStorage(t);
  assert.equal(isThreeMfUpload("model/3mf"), true);
  assert.equal(isThreeMfUpload("application/3mf"), true);
  assert.equal(
    isThreeMfUpload("application/vnd.ms-package.3dmanufacturing-3dmodel+xml"),
    true,
  );
  assert.equal(isThreeMfUpload("model/gltf-binary"), false);
  assert.equal(isThreeMfUpload("model/stl"), false);
  assert.equal(isThreeMfUpload("image/png"), false);
});

test("routes each plain mesh content type to the right signature check", async (t) => {
  const { isPlainMeshUpload, isObjUpload, isPlyUpload, meshKindFor } = await loadStorage(t);
  assert.equal(isObjUpload("model/obj"), true);
  assert.equal(isObjUpload("model/ply"), false);
  assert.equal(isPlyUpload("model/ply"), true);
  assert.equal(isPlyUpload("application/ply"), true);
  assert.equal(meshKindFor("model/obj"), "obj");
  assert.equal(meshKindFor("application/ply"), "ply");
  assert.equal(isPlainMeshUpload("model/obj"), true);
  assert.equal(isPlainMeshUpload("model/ply"), true);
  // Other CAD types must not be caught by the plain-mesh check.
  assert.equal(isPlainMeshUpload("model/stl"), false);
  assert.equal(isPlainMeshUpload("model/3mf"), false);
  assert.equal(isPlainMeshUpload("image/png"), false);
});

test("the signature the upload route enforces accepts a real 3MF and nothing else", async (t) => {
  const { isThreeMfUpload } = await loadStorage(t);
  const { cadFileMatchesKind } = await import("../lib/cadModels.ts");
  assert.equal(isThreeMfUpload("model/3mf"), true);
  assert.equal(cadFileMatchesKind("three-mf", threeMfBytes()), true);
  // Anything that is not a ZIP carrying the model part is refused at upload
  // rather than failing later inside the browser viewer.
  assert.equal(cadFileMatchesKind("three-mf", Buffer.from("not a zip at all")), false);
  assert.equal(
    cadFileMatchesKind(
      "three-mf",
      Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.from("other.txt")]),
    ),
    false,
  );
});
