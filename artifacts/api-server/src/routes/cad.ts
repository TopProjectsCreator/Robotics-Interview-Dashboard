import { randomUUID } from "node:crypto";
import express, { Router, type IRouter, type Request } from "express";
import {
  CreateCadBotBody,
  CreateCadBotResponse,
  CreateCadFolderBody,
  CreateCadFolderResponse,
  CreateCadModelBody,
  CreateCadModelResponse,
  DeleteCadBotQueryParams,
  DeleteCadFolderParams,
  DeleteCadFolderResponse,
  DeleteCadModelParams,
  DeleteCadModelResponse,
  ListCadLibraryResponse,
  ListCadModelsQueryParams,
  ListCadModelsResponse,
  UpdateCadBotBody,
  UpdateCadBotParams,
  UpdateCadBotResponse,
  UpdateCadFolderBody,
  UpdateCadFolderParams,
  UpdateCadFolderResponse,
  UpdateCadModelBody,
  UpdateCadModelParams,
  UpdateCadModelResponse,
} from "@workspace/api-zod";
import { chunkedUploadsTable, db, pool } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireWorkspaceAccess } from "../middlewares/adminAuth";
import { cleanCadLabel, cadModelKind, CAD_KIND_CONTENT_TYPES } from "../lib/cadModels";
import { deleteChunkParts, getChunkUpload } from "../lib/chunkedUploads";
import { ObjectStorageService } from "../lib/objectStorage";
import { authenticatedInterviewerId } from "../middlewares/adminAuth";
import { accountById } from "../lib/interviewerAccounts";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Anyone whose role can open the CAD workspace may also organise it, so every
// route here is gated by the same admin-configurable workspace access check
// rather than by a fixed role.
const cadAccess = requireWorkspaceAccess("cad");

const OBJECT_PATH_PATTERN = /^\/objects\/[A-Za-z0-9/-]{8,160}$/;
/** Object path of a single stored file, as opposed to a chunked upload. */
const SINGLE_OBJECT_PATH = /^\/objects\/([A-Za-z0-9-]{8,128})$/;
/** Object path of a chunked upload, which is a manifest of stored parts. */
const CHUNK_OBJECT_PATH = /^\/objects\/chunk\/([A-Za-z0-9-]{8,128})$/;

type Log = { warn: (fields: object, message?: string) => void };

/**
 * Removes a CAD model's stored bytes. Large models arrive as chunked uploads, so
 * their parts and manifest have to be cleaned up too, otherwise deleting a
 * multi-hundred-megabyte assembly would quietly leak every part.
 */
async function deleteModelFile(objectPath: string, log: Log): Promise<void> {
  const chunkMatch = CHUNK_OBJECT_PATH.exec(objectPath);
  if (chunkMatch) {
    const uploadId = chunkMatch[1];
    const manifest = await getChunkUpload(uploadId);
    if (!manifest) {
      log.warn({ objectPath, uploadId }, "CAD model manifest is missing; parts left in storage");
      return;
    }
    await deleteChunkParts(uploadId, manifest.totalParts);
    await db
      .delete(chunkedUploadsTable)
      .where(eq(chunkedUploadsTable.uploadId, uploadId));
    return;
  }
  if (!SINGLE_OBJECT_PATH.test(objectPath)) {
    // Never hand an unrecognised path to storage; the CHECK constraint should
    // make this unreachable, and skipping is safer than deleting the wrong key.
    log.warn({ objectPath }, "CAD model has an unexpected object path; storage cleanup skipped");
    return;
  }
  await objectStorageService.deleteObject(objectPath);
}

/** Deletes many model files, logging rather than failing on any one of them. */
async function deleteModelFiles(
  objectPaths: string[],
  log: Log,
): Promise<void> {
  for (const objectPath of objectPaths) {
    try {
      await deleteModelFile(objectPath, log);
    } catch (error) {
      log.warn({ err: error, objectPath }, "CAD model file cleanup failed");
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

function mapBot(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
}

function mapFolder(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    botId: String(row.botId),
    parentId: row.parentId === null || row.parentId === undefined ? null : String(row.parentId),
    name: String(row.name),
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
}

function mapModel(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    fileName: String(row.fileName),
    contentType: String(row.contentType),
    objectPath: String(row.objectPath),
    sizeBytes: Number(row.sizeBytes ?? 0),
    botId: row.botId === null || row.botId === undefined ? null : String(row.botId),
    folderId: row.folderId === null || row.folderId === undefined ? null : String(row.folderId),
    notes: row.notes === null || row.notes === undefined ? null : String(row.notes),
    uploadedBy:
      row.uploadedBy === null || row.uploadedBy === undefined ? null : String(row.uploadedBy),
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
}

const MODEL_COLUMNS = `"id", "name", "file_name" as "fileName", "content_type" as "contentType",
  "object_path" as "objectPath", "size_bytes" as "sizeBytes", "bot_id" as "botId",
  "folder_id" as "folderId", "notes", "uploaded_by" as "uploadedBy",
  "created_at" as "createdAt", "updated_at" as "updatedAt"`;

async function currentDisplayName(req: Request): Promise<string | null> {
  const accountId = authenticatedInterviewerId(req);
  if (!accountId) return null;
  try {
    return (await accountById(accountId))?.displayName ?? null;
  } catch {
    return null;
  }
}

/**
 * Collects every descendant folder id of `folderId`, breadth first, so a delete
 * or a move can refuse to treat a nested folder as a stranger. Uses a bounded
 * loop so a corrupted parent cycle cannot hang the request.
 */
async function descendantFolderIds(folderId: string): Promise<Set<string>> {
  const found = new Set<string>([folderId]);
  let frontier = [folderId];
  for (let depth = 0; depth < 64 && frontier.length > 0; depth += 1) {
    const result = await pool.query<{ id: string }>(
      `select "id" from "cad_folders" where "parent_id" = any($1::text[])`,
      [frontier],
    );
    frontier = result.rows
      .map(({ id }) => id)
      .filter((id) => !found.has(id));
    for (const id of frontier) found.add(id);
  }
  return found;
}

/**
 * Resolves the folder a model should land in and confirms the pair is coherent:
 * a folder always implies its own bot, so a mismatched botId is rejected rather
 * than silently overwriting the model's bot.
 */
async function resolvePlacement(
  botId: string | null,
  folderId: string | null,
): Promise<{ ok: true; botId: string | null; folderId: string | null } | { ok: false; error: string }> {
  if (!folderId) return { ok: true, botId, folderId: null };
  const folder = await pool.query<{ botId: string }>(
    `select "bot_id" as "botId" from "cad_folders" where "id" = $1`,
    [folderId],
  );
  const row = folder.rows[0];
  if (!row) return { ok: false, error: "That folder no longer exists." };
  if (botId && botId !== row.botId) {
    return { ok: false, error: "That folder belongs to a different bot." };
  }
  return { ok: true, botId: row.botId, folderId };
}

router.get("/cad/library", cadAccess, async (req, res): Promise<void> => {
  try {
    const bots = await pool.query(      `select "id", "name", "notes", "created_at" as "createdAt", "updated_at" as "updatedAt"
       from "cad_bots" order by lower("name")`,
    );
    const folders = await pool.query(
      `select "id", "bot_id" as "botId", "parent_id" as "parentId", "name",
              "created_at" as "createdAt", "updated_at" as "updatedAt"
       from "cad_folders" order by lower("name")`,
    );
    const models = await pool.query(
      `select ${MODEL_COLUMNS} from "cad_models" order by lower("name")`,
    );
    res.json(
      ListCadLibraryResponse.parse({
        bots: bots.rows.map(mapBot),
        folders: folders.rows.map(mapFolder),
        models: models.rows.map(mapModel),
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "CAD library read failed");
    res.status(500).json({ error: "Unable to load the CAD library." });
  }
});

router.post("/cad/bots", cadAccess, async (req, res): Promise<void> => {
  const body = CreateCadBotBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Give this bot a name." });
    return;
  }
  const name = cleanCadLabel(body.data.name, 120);
  if (!name) {
    res.status(400).json({ error: "Give this bot a name." });
    return;
  }
  const notes = cleanCadLabel(body.data.notes ?? null, 2000);
  const id = randomUUID();
  try {
    const inserted = await pool.query(
      `insert into "cad_bots" ("id", "name", "notes")
       values ($1, $2, $3)
       returning "id", "name", "notes", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [id, name, notes],
    );
    res.status(201).json(CreateCadBotResponse.parse(mapBot(inserted.rows[0])));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A bot with that name already exists." });
      return;
    }
    req.log.error({ err: error }, "CAD bot creation failed");
    res.status(500).json({ error: "Unable to create this bot." });
  }
});

router.patch("/cad/bots/:botId", cadAccess, async (req, res): Promise<void> => {
  const params = UpdateCadBotParams.safeParse(req.params);
  const body = UpdateCadBotBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "The bot details are invalid." });
    return;
  }
  const patch = body.data;
  if (patch.name === undefined && patch.notes === undefined) {
    res.status(400).json({ error: "Nothing to change." });
    return;
  }
  const name = patch.name === undefined ? undefined : cleanCadLabel(patch.name, 120);
  if (patch.name !== undefined && !name) {
    res.status(400).json({ error: "Give this bot a name." });
    return;
  }
  const notes =
    patch.notes === undefined ? undefined : patch.notes === null ? null : cleanCadLabel(patch.notes, 2000);
  try {
    const updated = await pool.query(
      // $4 distinguishes "not supplied" from "cleared", so notes can be emptied.
      `update "cad_bots"
       set "name" = coalesce($2, "name"),
           "notes" = case when $4 then $3 else "notes" end,
           "updated_at" = now()
       where "id" = $1
       returning "id", "name", "notes", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [params.data.botId, name ?? null, notes ?? null, patch.notes !== undefined],
    );
    if (updated.rowCount === 0) {
      res.status(404).json({ error: "Bot not found." });
      return;
    }
    res.json(UpdateCadBotResponse.parse(mapBot(updated.rows[0])));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A bot with that name already exists." });
      return;
    }
    req.log.error({ err: error }, "CAD bot update failed");
    res.status(500).json({ error: "Unable to update this bot." });
  }
});

router.delete("/cad/bots", cadAccess, async (req, res): Promise<void> => {
  const params = DeleteCadBotQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "The bot request is invalid." });
    return;
  }
  try {
    // Models are detached rather than cascaded so their files can be cleaned up
    // deliberately; the folder rows cascade from the bot itself.
    const models = await pool.query<{ objectPath: string }>(
      `update "cad_models" set "bot_id" = null, "folder_id" = null, "updated_at" = now()
       where "bot_id" = $1 returning "object_path" as "objectPath"`,
      [params.data.botId],
    );
    const deleted = await pool.query(`delete from "cad_bots" where "id" = $1`, [
      params.data.botId,
    ]);
    if (deleted.rowCount === 0) {
      res.status(404).json({ error: "Bot not found." });
      return;
    }
    await deleteModelFiles(models.rows.map(({ objectPath }) => objectPath), req.log);
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "CAD bot deletion failed");
    res.status(500).json({ error: "Unable to delete this bot." });
  }
});

router.post("/cad/folders", cadAccess, async (req, res): Promise<void> => {
  const body = CreateCadFolderBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Give this folder a name and choose a bot." });
    return;
  }
  const name = cleanCadLabel(body.data.name, 120);
  if (!name) {
    res.status(400).json({ error: "Give this folder a name." });
    return;
  }
  const parentId = body.data.parentId ?? null;
  try {
    if (parentId) {
      const parent = await pool.query<{ botId: string }>(
        `select "bot_id" as "botId" from "cad_folders" where "id" = $1`,
        [parentId],
      );
      const row = parent.rows[0];
      if (!row) {
        res.status(404).json({ error: "The parent folder no longer exists." });
        return;
      }
      if (row.botId !== body.data.botId) {
        res.status(400).json({ error: "That folder belongs to a different bot." });
        return;
      }
    } else {
      const bot = await pool.query(`select 1 from "cad_bots" where "id" = $1`, [
        body.data.botId,
      ]);
      if (bot.rowCount === 0) {
        res.status(404).json({ error: "Bot not found." });
        return;
      }
    }
    const inserted = await pool.query(
      `insert into "cad_folders" ("id", "bot_id", "parent_id", "name")
       values ($1, $2, $3, $4)
       returning "id", "bot_id" as "botId", "parent_id" as "parentId", "name",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [randomUUID(), body.data.botId, parentId, name],
    );
    res.status(201).json(CreateCadFolderResponse.parse(mapFolder(inserted.rows[0])));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A folder with that name already exists here." });
      return;
    }
    req.log.error({ err: error }, "CAD folder creation failed");
    res.status(500).json({ error: "Unable to create this folder." });
  }
});

router.patch("/cad/folders/:folderId", cadAccess, async (req, res): Promise<void> => {
  const params = UpdateCadFolderParams.safeParse(req.params);
  const body = UpdateCadFolderBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "The folder details are invalid." });
    return;
  }
  const patch = body.data;
  if (patch.name === undefined && patch.parentId === undefined) {
    res.status(400).json({ error: "Nothing to change." });
    return;
  }
  const name = patch.name === undefined ? undefined : cleanCadLabel(patch.name, 120);
  if (patch.name !== undefined && !name) {
    res.status(400).json({ error: "Give this folder a name." });
    return;
  }
  try {
    const current = await pool.query<{ botId: string }>(
      `select "bot_id" as "botId" from "cad_folders" where "id" = $1`,
      [params.data.folderId],
    );
    const folder = current.rows[0];
    if (!folder) {
      res.status(404).json({ error: "Folder not found." });
      return;
    }
    let parentId: string | null | undefined;
    if (patch.parentId !== undefined) {
      parentId = patch.parentId;
      if (parentId) {
        if (parentId === params.data.folderId) {
          res.status(400).json({ error: "A folder cannot be moved inside itself." });
          return;
        }
        const parent = await pool.query<{ botId: string }>(
          `select "bot_id" as "botId" from "cad_folders" where "id" = $1`,
          [parentId],
        );
        const parentRow = parent.rows[0];
        if (!parentRow) {
          res.status(404).json({ error: "The parent folder no longer exists." });
          return;
        }
        if (parentRow.botId !== folder.botId) {
          res.status(400).json({ error: "A folder cannot be moved into another bot." });
          return;
        }
        // Moving a folder under its own descendant would detach the subtree.
        const descendants = await descendantFolderIds(params.data.folderId);
        if (descendants.has(parentId)) {
          res.status(400).json({ error: "A folder cannot be moved inside one of its own subfolders." });
          return;
        }
      }
    }
    const updated = await pool.query(
      `update "cad_folders"
       set "name" = coalesce($2, "name"),
           "parent_id" = case when $3::text is null and $4 then null else coalesce($3::text, "parent_id") end,
           "updated_at" = now()
       where "id" = $1
       returning "id", "bot_id" as "botId", "parent_id" as "parentId", "name",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [params.data.folderId, name ?? null, parentId ?? null, patch.parentId !== undefined],
    );
    res.json(UpdateCadFolderResponse.parse(mapFolder(updated.rows[0])));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A folder with that name already exists here." });
      return;
    }
    req.log.error({ err: error }, "CAD folder update failed");
    res.status(500).json({ error: "Unable to update this folder." });
  }
});

router.delete("/cad/folders/:folderId", cadAccess, async (req, res): Promise<void> => {
  const params = DeleteCadFolderParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "The folder request is invalid." });
    return;
  }
  try {
    const descendants = await descendantFolderIds(params.data.folderId);
    const ids = [...descendants];
    // Models are unfiled, never destroyed, so deleting a folder cannot lose work.
    await pool.query(
      `update "cad_models" set "folder_id" = null, "updated_at" = now()
       where "folder_id" = any($1::text[])`,
      [ids],
    );
    const deleted = await pool.query(
      `delete from "cad_folders" where "id" = any($1::text[])`,
      [ids],
    );
    if (deleted.rowCount === 0) {
      res.status(404).json({ error: "Folder not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "CAD folder deletion failed");
    res.status(500).json({ error: "Unable to delete this folder." });
  }
});

router.get("/cad/models", cadAccess, async (req, res): Promise<void> => {
  const params = ListCadModelsQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: "The model filter is invalid." });
    return;
  }
  const filters: string[] = [];
  const values: unknown[] = [];
  if (params.data.folderId) {
    values.push(params.data.folderId);
    filters.push(`"folder_id" = $${values.length}`);
  }
  if (params.data.botId) {
    values.push(params.data.botId);
    filters.push(`"bot_id" = $${values.length}`);
  }
  const where = filters.length > 0 ? `where ${filters.join(" and ")}` : "";
  try {
    const models = await pool.query(
      `select ${MODEL_COLUMNS} from "cad_models" ${where} order by lower("name")`,
      values,
    );
    res.json(ListCadModelsResponse.parse({ items: models.rows.map(mapModel) }));
  } catch (error) {
    req.log.error({ err: error }, "CAD model list failed");
    res.status(500).json({ error: "Unable to load CAD models." });
  }
});

router.post("/cad/models", cadAccess, async (req, res): Promise<void> => {
  const body = CreateCadModelBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "The model details are invalid." });
    return;
  }
  const input = body.data;
  if (!OBJECT_PATH_PATTERN.test(input.objectPath)) {
    res.status(400).json({ error: "Upload the model file before recording it." });
    return;
  }
  // The upload endpoint already validated the bytes; re-checking the kind here
  // means a model record can never name a format nothing can render.
  const kind = cadModelKind(input.fileName);
  if (!kind || !CAD_KIND_CONTENT_TYPES[kind].includes(input.contentType.toLowerCase())) {
    res.status(400).json({ error: "Choose a GLB, STL, 3MF, STEP, IGES, BREP, X_T, or X_B file." });
    return;
  }
  const placement = await resolvePlacement(input.botId ?? null, input.folderId ?? null);
  if (!placement.ok) {
    res.status(400).json({ error: placement.error });
    return;
  }
  const name = cleanCadLabel(input.name, 255);
  const notes = cleanCadLabel(input.notes ?? null, 2000);
  const uploadedBy = await currentDisplayName(req);
  try {
    const inserted = await pool.query(
      `insert into "cad_models"
         ("id", "name", "file_name", "content_type", "object_path", "size_bytes",
          "bot_id", "folder_id", "notes", "uploaded_by")
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning ${MODEL_COLUMNS}`,
      [
        randomUUID(),
        // Default the display name to the original file name.
        name ?? input.fileName,
        input.fileName,
        input.contentType,
        input.objectPath,
        input.sizeBytes,
        placement.botId,
        placement.folderId,
        notes,
        uploadedBy,
      ],
    );
    res.status(201).json(CreateCadModelResponse.parse(mapModel(inserted.rows[0])));
  } catch (error) {
    req.log.error({ err: error }, "CAD model creation failed");
    res.status(500).json({ error: "Unable to add this model." });
  }
});

router.patch("/cad/models/:modelId", cadAccess, async (req, res): Promise<void> => {
  const params = UpdateCadModelParams.safeParse(req.params);
  const body = UpdateCadModelBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "The model details are invalid." });
    return;
  }
  const patch = body.data;
  if (
    patch.name === undefined &&
    patch.botId === undefined &&
    patch.folderId === undefined &&
    patch.notes === undefined
  ) {
    res.status(400).json({ error: "Nothing to change." });
    return;
  }
  const name = patch.name === undefined ? undefined : cleanCadLabel(patch.name, 255);
  if (patch.name !== undefined && !name) {
    res.status(400).json({ error: "Give this model a name." });
    return;
  }
  const notes =
    patch.notes === undefined
      ? undefined
      : patch.notes === null
        ? null
        : cleanCadLabel(patch.notes, 2000);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ botId: string | null; folderId: string | null }>(
      `select "bot_id" as "botId", "folder_id" as "folderId"
       from "cad_models" where "id" = $1 for update`,
      [params.data.modelId],
    );
    const existing = current.rows[0];
    if (!existing) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Model not found." });
      return;
    }
    const nextBotId = patch.botId !== undefined ? patch.botId : existing.botId;
    const nextFolderId = patch.folderId !== undefined ? patch.folderId : existing.folderId;
    const placement = await resolvePlacement(nextBotId, nextFolderId);
    if (!placement.ok) {
      await client.query("ROLLBACK");
      res.status(400).json({ error: placement.error });
      return;
    }
    const updated = await client.query(
      // $6 distinguishes "not supplied" from "cleared", so notes can be emptied.
      `update "cad_models"
       set "name" = coalesce($2, "name"),
           "bot_id" = $3, "folder_id" = $4,
           "notes" = case when $6 then $5 else "notes" end,
           "updated_at" = now()
       where "id" = $1
       returning ${MODEL_COLUMNS}`,
      [
        params.data.modelId,
        name ?? null,
        placement.botId,
        placement.folderId,
        notes ?? null,
        patch.notes !== undefined,
      ],
    );
    await client.query("COMMIT");
    res.json(UpdateCadModelResponse.parse(mapModel(updated.rows[0])));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error }, "CAD model update failed");
    res.status(500).json({ error: "Unable to update this model." });
  } finally {
    client.release();
  }
});

router.delete("/cad/models/:modelId", cadAccess, async (req, res): Promise<void> => {
  const params = DeleteCadModelParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "The model request is invalid." });
    return;
  }
  try {
    const deleted = await pool.query<{ objectPath: string }>(
      `delete from "cad_models" where "id" = $1 returning "object_path" as "objectPath"`,
      [params.data.modelId],
    );
    const row = deleted.rows[0];
    if (!row) {
      res.status(404).json({ error: "Model not found." });
      return;
    }
    await deleteModelFiles([row.objectPath], req.log);
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "CAD model deletion failed");
    res.status(500).json({ error: "Unable to delete this model." });
  }
});

export default router;
