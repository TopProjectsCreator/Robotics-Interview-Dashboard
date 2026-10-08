import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";
import { requireWorkspaceAccess } from "../middlewares/adminAuth";
import { authenticatedInterviewerId } from "../middlewares/adminAuth";
import { accountById } from "../lib/interviewerAccounts";
import { deployProjectToHub, normalizeHubBaseUrl } from "../lib/hubDeploy";

const router: IRouter = Router();
const codeAccess = requireWorkspaceAccess("code");

const PATH_PATTERN = /^[A-Za-z0-9_.$\-\/+]{1,255}$/;

function cleanName(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/g, " ");
  if (!name || name.length > max) return null;
  return name;
}

function cleanPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (!path || path.length > 255 || !PATH_PATTERN.test(path) || path.includes("..")) return null;
  return path;
}

async function displayName(req: Request): Promise<string | null> {
  const accountId = authenticatedInterviewerId(req);
  if (!accountId) return null;
  try {
    return (await accountById(accountId))?.displayName ?? null;
  } catch {
    return null;
  }
}

function mapProject(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    name: String(row.name),
    sdkVersion: String(row.sdkVersion ?? "v12.0"),
    gitConfig: (row.gitConfig ?? {}) as Record<string, unknown>,
    fileCount: Number(row.fileCount ?? 0),
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
}

function mapFile(row: Record<string, unknown>) {
  return {
    id: String(row.id),
    projectId: String(row.projectId),
    path: String(row.path),
    content: String(row.content ?? ""),
    sizeBytes: Number(row.sizeBytes ?? 0),
    updatedBy: row.updatedBy == null ? null : String(row.updatedBy),
    createdAt: new Date(String(row.createdAt)).toISOString(),
    updatedAt: new Date(String(row.updatedAt)).toISOString(),
  };
}

// Projects ---------------------------------------------------------------

router.get("/code/projects", codeAccess, async (req, res): Promise<void> => {
  try {
    const projects = await pool.query(
      `select p."id", p."name", p."sdk_version" as "sdkVersion", p."git_config" as "gitConfig",
              p."created_at" as "createdAt", p."updated_at" as "updatedAt",
              (select count(*) from "code_files" f where f."project_id" = p."id") as "fileCount"
       from "code_projects" p order by lower(p."name")`,
    );
    res.json({ projects: projects.rows.map(mapProject) });
  } catch (error) {
    req.log.error({ err: error }, "Code projects read failed");
    res.status(500).json({ error: "Unable to load code projects." });
  }
});

router.post("/code/projects", codeAccess, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = cleanName(body.name, 120);
  if (!name) {
    res.status(400).json({ error: "Give this project a name." });
    return;
  }
  const sdkVersion = typeof body.sdkVersion === "string" && body.sdkVersion.trim()
    ? body.sdkVersion.trim().slice(0, 32)
    : "v12.0";
  const by = await displayName(req);
  try {
    const inserted = await pool.query(
      `insert into "code_projects" ("id", "name", "sdk_version", "created_by")
       values ($1, $2, $3, $4)
       returning "id", "name", "sdk_version" as "sdkVersion", "git_config" as "gitConfig",
                 0 as "fileCount", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [randomUUID(), name, sdkVersion, by],
    );
    res.status(201).json({ project: mapProject(inserted.rows[0]) });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A project with that name already exists." });
      return;
    }
    req.log.error({ err: error }, "Code project creation failed");
    res.status(500).json({ error: "Unable to create this project." });
  }
});

router.patch("/code/projects/:projectId", codeAccess, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: string[] = [];
  const values: unknown[] = [req.params.projectId];
  if (body.name !== undefined) {
    const name = cleanName(body.name, 120);
    if (!name) {
      res.status(400).json({ error: "Give this project a name." });
      return;
    }
    values.push(name);
    patch.push(`"name" = $${values.length}`);
  }
  if (body.gitConfig !== undefined) {
    if (typeof body.gitConfig !== "object" || body.gitConfig === null) {
      res.status(400).json({ error: "The git settings are invalid." });
      return;
    }
    const git = body.gitConfig as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};
    if (typeof git.remoteUrl === "string") cleaned.remoteUrl = git.remoteUrl.trim().slice(0, 500);
    if (typeof git.branch === "string") cleaned.branch = git.branch.trim().slice(0, 120) || "main";
    if (typeof git.corsProxy === "string") cleaned.corsProxy = git.corsProxy.trim().slice(0, 500);
    values.push(JSON.stringify(cleaned));
    patch.push(`"git_config" = $${values.length}::jsonb`);
  }
  if (!patch.length) {
    res.status(400).json({ error: "Nothing to change." });
    return;
  }
  try {
    const updated = await pool.query(
      `update "code_projects" set ${patch.join(", ")}, "updated_at" = now()
       where "id" = $1
       returning "id", "name", "sdk_version" as "sdkVersion", "git_config" as "gitConfig",
                 (select count(*) from "code_files" f where f."project_id" = "code_projects"."id") as "fileCount",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      values,
    );
    if (!updated.rows[0]) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.json({ project: mapProject(updated.rows[0]) });
  } catch (error) {
    req.log.error({ err: error }, "Code project update failed");
    res.status(500).json({ error: "Unable to update this project." });
  }
});

router.delete("/code/projects/:projectId", codeAccess, async (req, res): Promise<void> => {
  try {
    const deleted = await pool.query(`delete from "code_projects" where "id" = $1`, [
      req.params.projectId,
    ]);
    if (deleted.rowCount === 0) {
      res.status(404).json({ error: "Project not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "Code project deletion failed");
    res.status(500).json({ error: "Unable to delete this project." });
  }
});

// Files ------------------------------------------------------------------

router.get("/code/projects/:projectId/files", codeAccess, async (req, res): Promise<void> => {
  try {
    const files = await pool.query(
      `select "id", "project_id" as "projectId", "path", "content",
              octet_length("content") as "sizeBytes",
              "updated_by" as "updatedBy", "created_at" as "createdAt", "updated_at" as "updatedAt"
       from "code_files" where "project_id" = $1 order by "path"`,
      [req.params.projectId],
    );
    res.json({ files: files.rows.map(mapFile) });
  } catch (error) {
    req.log.error({ err: error }, "Code files read failed");
    res.status(500).json({ error: "Unable to load project files." });
  }
});

router.post("/code/files", codeAccess, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const path = cleanPath(body.path);
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const content = typeof body.content === "string" ? body.content.slice(0, 500_000) : "";
  if (!projectId || !path) {
    res.status(400).json({ error: "A project and file path are required." });
    return;
  }
  const by = await displayName(req);
  try {
    const inserted = await pool.query(
      `insert into "code_files" ("id", "project_id", "path", "content", "updated_by")
       values ($1, $2, $3, $4, $5)
       on conflict ("project_id", "path") do update
         set "content" = excluded."content", "updated_by" = excluded."updated_by", "updated_at" = now()
       returning "id", "project_id" as "projectId", "path", "content",
                 octet_length("content") as "sizeBytes",
                 "updated_by" as "updatedBy", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [randomUUID(), projectId, path, content, by],
    );
    await pool.query(`update "code_projects" set "updated_at" = now() where "id" = $1`, [projectId]);
    res.status(201).json({ file: mapFile(inserted.rows[0]) });
  } catch (error) {
    req.log.error({ err: error }, "Code file save failed");
    res.status(500).json({ error: "Unable to save this file." });
  }
});

router.put("/code/files/:fileId", codeAccess, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sets: string[] = [];
  const values: unknown[] = [req.params.fileId];
  if (body.content !== undefined) {
    if (typeof body.content !== "string" || body.content.length > 500_000) {
      res.status(400).json({ error: "File content is too large." });
      return;
    }
    values.push(body.content);
    sets.push(`"content" = $${values.length}`);
  }
  if (body.path !== undefined) {
    const path = cleanPath(body.path);
    if (!path) {
      res.status(400).json({ error: "That file path is invalid." });
      return;
    }
    values.push(path);
    sets.push(`"path" = $${values.length}`);
  }
  if (!sets.length) {
    res.status(400).json({ error: "Nothing to change." });
    return;
  }
  const by = await displayName(req);
  values.push(by);
  sets.push(`"updated_by" = $${values.length}`);
  try {
    const updated = await pool.query(
      `update "code_files" set ${sets.join(", ")}, "updated_at" = now()
       where "id" = $1
       returning "id", "project_id" as "projectId", "path", "content",
                 octet_length("content") as "sizeBytes",
                 "updated_by" as "updatedBy", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      values,
    );
    if (!updated.rows[0]) {
      res.status(404).json({ error: "File not found." });
      return;
    }
    res.json({ file: mapFile(updated.rows[0]) });
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "23505") {
      res.status(409).json({ error: "A file with that path already exists." });
      return;
    }
    req.log.error({ err: error }, "Code file update failed");
    res.status(500).json({ error: "Unable to update this file." });
  }
});

router.delete("/code/files/:fileId", codeAccess, async (req, res): Promise<void> => {
  try {
    const deleted = await pool.query(`delete from "code_files" where "id" = $1`, [
      req.params.fileId,
    ]);
    if (deleted.rowCount === 0) {
      res.status(404).json({ error: "File not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "Code file deletion failed");
    res.status(500).json({ error: "Unable to delete this file." });
  }
});

// Revisions (git pane commits) --------------------------------------------

router.get("/code/projects/:projectId/revisions", codeAccess, async (req, res): Promise<void> => {
  try {
    const revisions = await pool.query(
      `select "id", "project_id" as "projectId", "message", "author", "created_at" as "createdAt"
       from "code_revisions" where "project_id" = $1 order by "created_at" desc limit 100`,
      [req.params.projectId],
    );
    res.json({
      revisions: revisions.rows.map((row) => ({
        id: String(row.id),
        projectId: String(row.projectId),
        message: String(row.message),
        author: row.author == null ? null : String(row.author),
        createdAt: new Date(String(row.createdAt)).toISOString(),
      })),
    });
  } catch (error) {
    req.log.error({ err: error }, "Code revisions read failed");
    res.status(500).json({ error: "Unable to load commit history." });
  }
});

router.post("/code/projects/:projectId/revisions", codeAccess, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const message = cleanName(body.message, 200) ?? "Checkpoint";
  const by = await displayName(req);
  try {
    const files = await pool.query(
      `select "path", "content" from "code_files" where "project_id" = $1 order by "path"`,
      [req.params.projectId],
    );
    const snapshot = files.rows.map((row) => ({ path: String(row.path), content: String(row.content ?? "") }));
    const inserted = await pool.query(
      `insert into "code_revisions" ("id", "project_id", "message", "author", "snapshot")
       values ($1, $2, $3, $4, $5::jsonb)
       returning "id", "project_id" as "projectId", "message", "author", "created_at" as "createdAt"`,
      [randomUUID(), req.params.projectId, message, by, JSON.stringify(snapshot)],
    );
    // Keep history bounded: newest 100 survive per project.
    await pool.query(
      `delete from "code_revisions" where "project_id" = $1 and "id" not in (
         select "id" from "code_revisions" where "project_id" = $1 order by "created_at" desc limit 100
       )`,
      [req.params.projectId],
    );
    const row = inserted.rows[0];
    res.status(201).json({
      revision: {
        id: String(row.id),
        projectId: String(row.projectId),
        message: String(row.message),
        author: row.author == null ? null : String(row.author),
        createdAt: new Date(String(row.createdAt)).toISOString(),
      },
    });
  } catch (error) {
    req.log.error({ err: error }, "Code revision creation failed");
    res.status(500).json({ error: "Unable to save this commit." });
  }
});

// Deploy: push straight to the hub and build there ---------------------------
// Nobody opens the hub's Program & Manage site: the dashboard server saves
// each .java to the hub's OnBotJava server and triggers its on-hub build,
// then reports the compiler log back here.
router.post("/code/projects/:projectId/deploy", codeAccess, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const hubBaseUrl = normalizeHubBaseUrl(body.hubBaseUrl);
  if (!hubBaseUrl) {
    res.status(400).json({ error: "Enter the hub address, e.g. http://192.168.43.1:8080." });
    return;
  }
  try {
    let files: { path: string; content: string }[];
    if (Array.isArray(body.files)) {
      files = body.files
        .filter((entry): entry is { path: string; content: string } =>
          typeof entry === "object" && entry !== null &&
          typeof (entry as { path?: unknown }).path === "string" &&
          typeof (entry as { content?: unknown }).content === "string")
        .map((entry) => ({ path: entry.path.slice(0, 255), content: entry.content.slice(0, 500_000) }));
    } else {
      const rows = await pool.query(
        `select "path", "content" from "code_files" where "project_id" = $1 order by "path"`,
        [req.params.projectId],
      );
      files = rows.rows.map((row) => ({ path: String(row.path), content: String(row.content ?? "") }));
    }
    if (!files.length) {
      res.status(400).json({ error: "This project has no files to upload." });
      return;
    }
    // A hub build compiles every file on the hub and can take a while.
    req.setTimeout(180_000);
    const result = await deployProjectToHub(hubBaseUrl, files);
    res.json(result);
  } catch (error) {
    req.log.error({ err: error }, "Hub deploy failed");
    res.status(502).json({ error: error instanceof Error ? error.message : "The hub upload failed." });
  }
});

// Presence (who is where, for the collab roster) ----------------------------

router.get("/code/projects/:projectId/presence", codeAccess, async (req, res): Promise<void> => {
  try {
    const rows = await pool.query(
      `select "display_name" as "displayName", "file_id" as "fileId", "color", "updated_at" as "updatedAt"
       from "code_presence" where "project_id" = $1 and "updated_at" > now() - interval '2 minutes'
       order by "updated_at" desc`,
      [req.params.projectId],
    );
    res.json({
      presence: rows.rows.map((row) => ({
        displayName: String(row.displayName),
        fileId: row.fileId == null ? null : String(row.fileId),
        color: String(row.color ?? "#f8c84a"),
        updatedAt: new Date(String(row.updatedAt)).toISOString(),
      })),
    });
  } catch (error) {
    req.log.error({ err: error }, "Code presence read failed");
    res.status(500).json({ error: "Unable to load collaborators." });
  }
});

router.put("/code/projects/:projectId/presence", codeAccess, async (req, res): Promise<void> => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const by = (await displayName(req)) ?? "Teammate";
  const fileId = typeof body.fileId === "string" ? body.fileId.slice(0, 120) : null;
  const color = typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)
    ? body.color
    : "#f8c84a";
  try {
    await pool.query(
      `insert into "code_presence" ("id", "project_id", "file_id", "display_name", "color", "updated_at")
       values ($1, $2, $3, $4, $5, now())
       on conflict ("id") do update set "file_id" = excluded."file_id", "color" = excluded."color", "updated_at" = now()`,
      [`${req.params.projectId}:${by.toLowerCase()}`, req.params.projectId, fileId, by, color],
    );
    res.status(204).end();
  } catch (error) {
    req.log.error({ err: error }, "Code presence write failed");
    res.status(500).json({ error: "Unable to update presence." });
  }
});

export default router;
