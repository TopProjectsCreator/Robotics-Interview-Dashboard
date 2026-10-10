import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test, { mock } from "node:test";
import { teamsTable, DEFAULT_TEAM_ID, normalizeTeamName } from "../../../../lib/db/src/schema/teams.ts";

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

/**
 * Exercises the CAD routes against a scripted database. Each test declares the
 * rows its queries return, so the assertions are about the route's decisions
 * (placement validation, cycle refusal, file cleanup) rather than about SQL text.
 */
function createHarness(t, {
  bots = [{ id: "bot-1" }],
  folders = [],
  models = [],
  chunkManifest = null,
  deletedObjects = [],
  deletedChunkParts = [],
  deletedChunkManifests = [],
  uniqueViolation = null,
  queryError = null,
} = {}) {
  const calls = { update: [], delete: [], poolQueries: [] };

  const pool = {
    query: async (statement, values) => {
      calls.poolQueries.push({ statement, values });
      if (queryError) throw queryError;
      if (statement.includes("from \"cad_bots\"") && statement.includes("select")) {
        return { rows: bots, rowCount: bots.length };
      }
      // Ordered most specific first: the child-listing query and the by-id
      // lookups all read from cad_folders.
      if (statement.startsWith("select \"id\" from \"cad_folders\" where \"parent_id\" = any")) {
        const parents = values?.[0] ?? [];
        const children = folders.filter((f) => parents.includes(f.parentId));
        return { rows: children.map(({ id }) => ({ id })), rowCount: children.length };
      }
      if (statement.startsWith("select \"id\" from \"cad_folders\"")) {
        const match = folders.find((f) => f.id === values?.[0]);
        return match ? { rows: [match], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (statement.startsWith("update \"cad_folders\"")) {
        return {
          rows: [{ ...FOLDER_SEED, id: values?.[0] }],
          rowCount: 1,
        };
      }
      if (statement.startsWith("select \"bot_id\" as \"botId\" from \"cad_folders\"")) {
        const match = folders.find((f) => f.id === values?.[0]);
        return match ? { rows: [{ botId: match.botId }], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (statement.includes("from \"cad_folders\"")) {
        const parentId = values?.[0] ?? null;
        const children = folders.filter((f) => (f.parentId ?? null) === parentId);
        return { rows: children, rowCount: children.length };
      }
      if (statement.startsWith("delete from \"cad_bots\"")) {
        return { rows: [], rowCount: bots.some((b) => b.id === values?.[0]) ? 1 : 0 };
      }
      if (statement.startsWith("update \"cad_models\"")) {
        calls.update.push({ statement, values });
        // Detaching a bot's models returns their paths so their files can go too.
        return {
          rows: models.map(({ objectPath }) => ({ objectPath })),
          rowCount: models.length,
        };
      }
      if (statement.startsWith("delete from \"cad_models\"")) {
        calls.delete.push({ statement, values });
        return { rows: models, rowCount: models.length };
      }
      if (statement.startsWith("select \"bot_id\" as \"botId\", \"folder_id\" as \"folderId\"")) {
        const match = models.find((m) => m.id === values?.[0]);
        return match ? { rows: [match], rowCount: 1 } : { rows: [], rowCount: 0 };
      }
      if (statement.startsWith("insert into \"cad_folders\"")) {
        if (uniqueViolation) throw { code: "23505" };
        return { rows: [{ ...folders[0] }], rowCount: 1 };
      }
      if (statement.startsWith("insert into \"cad_bots\"")) {
        if (uniqueViolation) throw { code: "23505" };
        return { rows: [{ id: "bot-1", name: "Scout", notes: null }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    connect: async () => ({
      query: async (statement, values) => {
        if (statement === "BEGIN" || statement === "COMMIT" || statement === "ROLLBACK") {
          return { rows: [], rowCount: 0 };
        }
        if (statement.startsWith("select \"bot_id\" as \"botId\", \"folder_id\" as \"folderId\"")) {
          const match = models.find((m) => m.id === values?.[0]);
          return match ? { rows: [match], rowCount: 1 } : { rows: [], rowCount: 0 };
        }
        if (statement.startsWith("update \"cad_models\"")) {
          calls.update.push({ statement, values });
          return { rows: [{ ...models[0] }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      },
      release: () => undefined,
    }),
  };

  mock.module("@workspace/db", {
    namedExports: {
      pool,
      db: {
        select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
        insert: () => ({ values: () => ({ onConflictDoUpdate: () => ({ returning: async () => [] }) }) }),
        delete: () => ({ where: () => Promise.resolve() }),
      },
      chunkedUploadsTable: { uploadId: "upload_id" },
      teamsTable,
      DEFAULT_TEAM_ID,
      normalizeTeamName,
    },
  });
  mock.module("@workspace/api-zod", {
    namedExports: {
      CreateCadBotBody: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      CreateCadBotResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      CreateCadFolderBody: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      CreateCadFolderResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      CreateCadModelBody: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      CreateCadModelResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      DeleteCadBotQueryParams: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      DeleteCadFolderParams: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      DeleteCadFolderResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      DeleteCadModelParams: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      DeleteCadModelResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      ListCadLibraryResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      ListCadModelsQueryParams: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      ListCadModelsResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadBotBody: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadBotParams: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadBotResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadFolderBody: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadFolderParams: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadFolderResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadModelBody: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadModelParams: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
      UpdateCadModelResponse: { safeParse: (value) => ({ success: true, data: value }), parse: (value) => value },
    },
  });
  mock.module("./objectStorage", {
    namedExports: {
      ObjectStorageService: class {
        async deleteObject(objectPath) {
          deletedObjects.push(objectPath);
        }
      },
    },
  });
  mock.module("./chunkedUploads", {
    namedExports: {
      getChunkUpload: async () => chunkManifest,
      getChunkUploadForTeam: async () => chunkManifest,
      deleteChunkParts: async (uploadId, totalParts) => {
        deletedChunkParts.push({ uploadId, totalParts });
      },
    },
  });
  mock.module("../middlewares/adminAuth", {
    namedExports: {
      requireAdmin: (_req, _res, next) => next(),
      requireCoordinator: (_req, _res, next) => next(),
      requireWorkspaceAccess: () => (_req, _res, next) => next(),
      requireWorkspaceAccessOrCoordinator: () => (_req, _res, next) => next(),
      authenticatedInterviewerId: () => "account-1",
      requestTeamId: async () => "default",
      requestTeamIdSync: () => "default",
    },
  });
  mock.module("./interviewerAccounts", {
    namedExports: { accountById: async () => ({ displayName: "Ada" }) },
  });
  t.after(() => mock.restoreAll());

  return { calls, deletedObjects, deletedChunkParts, deletedChunkManifests };
}

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(payload) {
      res.body = payload;
      return res;
    },
    end() {
      return res;
    },
  };
  return res;
}

let importId = 0;
async function loadRouter() {
  const router = await import(`../routes/cad.ts?test=${++importId}`);
  const route = (path, method) => {
    const layer = router.default.stack.find(
      (entry) => entry.route?.path === path && entry.route?.methods[method],
    );
    return layer.route.stack[layer.route.stack.length - 1].handle;
  };
  return { router, route };
}

const INT = { id: "bot-1" };
const STAMP = "2026-09-01T00:00:00.000Z";
// A complete folder row, used when the harness has to echo an update back.
const FOLDER_SEED = {
  id: "f-top",
  botId: "bot-1",
  parentId: null,
  name: "Intake",
  createdAt: STAMP,
  updatedAt: STAMP,
};
const FOLDER_TOP = {
  id: "f-top",
  botId: "bot-1",
  parentId: null,
  name: "Intake",
  createdAt: STAMP,
  updatedAt: STAMP,
};
const FOLDER_NESTED = {
  id: "f-nested",
  botId: "bot-1",
  parentId: "f-top",
  name: "Chassis",
  createdAt: STAMP,
  updatedAt: STAMP,
};
const MODEL = {
  id: "model-1",
  botId: "bot-1",
  folderId: "f-top",
  objectPath: "/objects/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
};

test("rejects moving a folder inside one of its own subfolders", async (t) => {
  const harness = createHarness(t, { folders: [FOLDER_TOP, FOLDER_NESTED] });
  const { route } = await loadRouter();
  const handler = route("/cad/folders/:folderId", "patch");
  const res = fakeRes();

  await handler(
    { params: { folderId: "f-top" }, body: { parentId: "f-nested" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );

  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /inside one of its own subfolders/);
  assert.equal(
    harness.calls.update.some((call) => call.statement.startsWith("update \"cad_folders\"")),
    false,
    "a refused move must not write anything",
  );
});

test("rejects moving a folder into itself", async (t) => {
  createHarness(t, { folders: [FOLDER_TOP] });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/folders/:folderId", "patch")(
    { params: { folderId: "f-top" }, body: { parentId: "f-top" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /cannot be moved inside itself/);
});

test("rejects creating a subfolder under a folder from another bot", async (t) => {
  createHarness(t, {
    folders: [{ id: "f-other", botId: "bot-2", parentId: null }],
    bots: [INT, { id: "bot-2" }],
  });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/folders", "post")(
    { body: { botId: "bot-1", parentId: "f-other", name: "Nested" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /different bot/);
});

test("reports a duplicate sibling folder name as a conflict", async (t) => {
  createHarness(t, { folders: [FOLDER_TOP], uniqueViolation: true });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/folders", "post")(
    { body: { botId: "bot-1", parentId: null, name: "Intake" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 409);
  assert.match(res.body.error, /already exists/);
});

test("refuses to move a model into a folder that no longer exists", async (t) => {
  const harness = createHarness(t, { models: [MODEL] });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/models/:modelId", "patch")(
    { params: { modelId: "model-1" }, body: { folderId: "f-gone" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /folder no longer exists/);
  assert.equal(
    harness.calls.update.length,
    0,
    "a stale folder reference must not clear the model's location",
  );
});

test("deleting a bot unfiles its models and deletes each stored file", async (t) => {
  const harness = createHarness(t, {
    models: [
      { ...MODEL, id: "model-1" },
      { ...MODEL, id: "model-2", objectPath: "/objects/11111111-2222-3333-4444-555555555555" },
    ],
  });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/bots", "delete")(
    { query: { botId: "bot-1" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 204);
  assert.deepEqual(harness.deletedObjects.sort(), [
    "/objects/11111111-2222-3333-4444-555555555555",
    "/objects/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  ]);
});

test("deleting a chunked CAD model removes its parts and manifest", async (t) => {
  const harness = createHarness(t, {
    models: [{ ...MODEL, objectPath: "/objects/chunk/upload-12345678" }],
    chunkManifest: { uploadId: "upload-12345678", totalParts: 3 },
  });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/models/:modelId", "delete")(
    { params: { modelId: "model-1" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 204);
  // Without this, deleting a large assembly would leak every uploaded part.
  assert.deepEqual(harness.deletedChunkParts, [
    { uploadId: "upload-12345678", totalParts: 3 },
  ]);
});

test("refuses to hand storage an object path it does not recognise", async (t) => {
  const harness = createHarness(t, {
    models: [{ ...MODEL, objectPath: "/objects/generated/whatever" }],
  });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/models/:modelId", "delete")(
    { params: { modelId: "model-1" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 204);
  assert.deepEqual(
    harness.deletedObjects,
    [],
    "an unexpected path must be skipped rather than deleted",
  );
});

test("reports a missing model rather than claiming success", async (t) => {
  createHarness(t, { models: [] });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/models/:modelId", "delete")(
    { params: { modelId: "nope" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 404);
  assert.match(res.body.error, /not found/);
});

test("allows a valid move and clears notes only when they are sent", async (t) => {
  const harness = createHarness(t, { folders: [FOLDER_TOP, FOLDER_NESTED] });
  const { route } = await loadRouter();
  const res = fakeRes();

  await route("/cad/folders/:folderId", "patch")(
    {
      params: { folderId: "f-nested" },
      body: { parentId: null, notes: null },
      log: { warn() {}, error() {} },
    },
    res,
    () => undefined,
  );

  assert.equal(res.statusCode, 200);
  // $4 is the "notes were supplied" flag; without it a cleared note would be
  // silently ignored by COALESCE.
  const [call] = harness.calls.poolQueries.filter((entry) =>
    entry.statement.startsWith("update \"cad_folders\""),
  );
  assert.ok(call, "expected a folder update");
  assert.equal(call.values[3], true, "notes: null must be applied, not skipped");
  assert.equal(call.values[2], null);
});

test("leaves notes alone when the request does not mention them", async (t) => {
  const harness = createHarness(t, { folders: [FOLDER_TOP, FOLDER_NESTED] });
  const { route } = await loadRouter();
  const res = fakeRes();
  await route("/cad/folders/:folderId", "patch")(
    { params: { folderId: "f-nested" }, body: { name: "Frame" }, log: { warn() {}, error() {} } },
    res,
    () => undefined,
  );
  assert.equal(res.statusCode, 200);
  const [call] = harness.calls.poolQueries.filter((entry) =>
    entry.statement.startsWith("update \"cad_folders\""),
  );
  assert.equal(call.values[3], false, "an absent notes key must not clear notes");
});
