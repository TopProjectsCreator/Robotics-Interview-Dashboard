import { randomUUID } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { pool } from "@workspace/db";
import type { NextFunction } from "express";
import {
  authenticatedInterviewerId,
  requestTeamId,
  requireAdmin,
  requireCoordinator,
} from "../middlewares/adminAuth";
import { accountById } from "../lib/interviewerAccounts";
import { teamSqlCondition } from "../lib/teams";

/**
 * Admins only. Custom apps is an unfinished experiment with no settled purpose,
 * so it is hidden from the sidebar and closed to every role except admin.
 * The stored admin role is "coordinator" (Settings labels it "Admin"); the
 * legacy "admin" value is accepted too so no account is locked out by a stale
 * role string. Everyone else — team members and treasurers — gets 403.
 */
function requireCustomWorkspaceAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAdmin(req, res, () => {
    const interviewerId = authenticatedInterviewerId(req);
    if (!interviewerId) {
      res.status(401).json({ error: "Interviewer session is invalid" });
      return;
    }
    void accountById(interviewerId)
      .then((account) => {
        if (account?.role !== "coordinator" && account?.role !== "admin") {
          res.status(403).json({ error: "Admins only" });
          return;
        }
        next();
      })
      .catch((error) => {
        req.log?.error?.({ err: error }, "Custom workspace admin check failed");
        res.status(503).json({ error: "Authentication unavailable" });
      });
  });
}

const router = Router();
const CAPABILITIES = new Set(["data", "llm"]);
const MAX_HTML_BYTES = 120_000;
const MAX_RECORD_BYTES = 16_000;
const requestWindows = new Map<string, { startedAt: number; count: number }>();

type WorkspaceRow = {
  id: string;
  title: string;
  description: string;
  html: string;
  capabilities: string[];
  status: "draft" | "published";
  accessMode: "team" | "owner" | "selected";
  allowedInterviewerIds: string[];
  createdAt: Date | string;
  updatedAt: Date | string;
};

function bodyObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function clipped(value: unknown, limit: number): string {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function parseCapabilities(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !CAPABILITIES.has(item))) return null;
  return [...new Set(value as string[])];
}

function parseAllowedInterviewerIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) return null;
  if (value.length > 500) return null;
  return [...new Set((value as string[]).map((item) => item.trim()))];
}

async function saveableAccessSettings(value: unknown, teamId: string): Promise<{
  accessMode: "team" | "owner" | "selected";
  allowedInterviewerIds: string[];
} | null> {
  const body = bodyObject(value);
  const accessMode = body.accessMode;
  if (accessMode !== "team" && accessMode !== "owner" && accessMode !== "selected") return null;
  const allowedInterviewerIds = body.allowedInterviewerIds === undefined && accessMode !== "selected"
    ? []
    : parseAllowedInterviewerIds(body.allowedInterviewerIds);
  if (!allowedInterviewerIds) return null;
  if (!allowedInterviewerIds.length) return { accessMode, allowedInterviewerIds };
  const members = await pool.query<{ id: string }>(
    `select "id" from "interviewer_accounts"
      where ${teamSqlCondition('"team_id"', "$1")} and "id" = any($2::text[])`,
    [teamId, allowedInterviewerIds],
  );
  if (members.rows.length !== allowedInterviewerIds.length) return null;
  return { accessMode, allowedInterviewerIds };
}

function limited(key: string, maximum = 30): boolean {
  const now = Date.now();
  if (requestWindows.size > 10_000) {
    for (const [windowKey, window] of requestWindows) {
      if (now - window.startedAt >= 60_000) requestWindows.delete(windowKey);
    }
  }
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > maximum;
}

async function accessibleWorkspace(
  req: Request,
  res: Response,
  id: string,
  allowDraftOwner = false,
): Promise<WorkspaceRow | null> {
  const teamId = await requestTeamId(req);
  const accountId = authenticatedInterviewerId(req);
  const result = await pool.query<WorkspaceRow>(
    `select "id", "title", "description", "html", "capabilities", "status",
            "access_mode" as "accessMode", "allowed_interviewer_ids" as "allowedInterviewerIds",
            "created_at" as "createdAt",
            "updated_at" as "updatedAt"
       from "custom_workspaces"
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        and (("status" = 'published' and (
              "access_mode" = 'team'
              or ("access_mode" = 'owner' and "created_by" = $4)
              or ("access_mode" = 'selected' and "allowed_interviewer_ids" ? $4)
            ))
          or ($3::boolean and "status" = 'draft' and "created_by" = $4))
      limit 1`,
    [id, teamId, allowDraftOwner, accountId],
  );
  const row = result.rows[0];
  if (!row) {
    res.status(404).json({ error: "Workspace not found." });
    return null;
  }
  return row;
}

async function workspaceForVersionHistory(
  req: Request,
  res: Response,
  id: string,
): Promise<boolean> {
  const teamId = await requestTeamId(req);
  const accountId = authenticatedInterviewerId(req);
  const result = await pool.query(
    `select "id" from "custom_workspaces"
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        and ("status" = 'published' or ("status" = 'draft' and "created_by" = $3))
      limit 1`,
    [id, teamId, accountId],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Workspace not found." });
    return false;
  }
  return true;
}

router.get("/custom-workspaces", requireCustomWorkspaceAdmin, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const accountId = authenticatedInterviewerId(req);
  const result = await pool.query(
    `select "id", "title", "description", "capabilities", "status", "access_mode" as "accessMode",
            "allowed_interviewer_ids" as "allowedInterviewerIds",
            "created_at" as "createdAt", "updated_at" as "updatedAt"
       from "custom_workspaces"
      where ${teamSqlCondition('"team_id"', "$1")}
        and (("status" = 'published' and (
              "access_mode" = 'team'
              or ("access_mode" = 'owner' and "created_by" = $2)
              or ("access_mode" = 'selected' and "allowed_interviewer_ids" ? $2)
            )) or "created_by" = $2)
      order by "updated_at" desc limit 100`,
    [teamId, accountId],
  );
  res.json({ workspaces: result.rows });
});

router.get("/custom-workspaces/team-members", requireCoordinator, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const members = await pool.query<{ id: string; displayName: string }>(
    `select "id", "display_name" as "displayName"
       from "interviewer_accounts"
      where ${teamSqlCondition('"team_id"', "$1")}
      order by "display_name" asc`,
    [teamId],
  );
  res.json({ members: members.rows });
});

router.post("/custom-workspaces/generate", requireCoordinator, async (req, res): Promise<void> => {
  const body = bodyObject(req.body);
  const prompt = clipped(body.prompt, 8000);
  const capabilities = parseCapabilities(body.capabilities);
  if (!prompt || !capabilities) {
    res.status(400).json({ error: "Describe the workspace and choose valid capabilities." });
    return;
  }
  if (limited(`generate:${authenticatedInterviewerId(req)}`, 5)) {
    res.status(429).json({ error: "Workspace generation is temporarily rate limited." });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_ASSISTANT_MODEL || "gpt-5.6-terra",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Build a complete, responsive internal web application from the user's requirements. Return JSON only: {"title":string,"description":string,"html":string}. The html must be a complete standalone document with inline CSS and JavaScript, no external dependencies, URLs, scripts, or network requests. Use semantic accessible HTML, mobile-first layout, and real interactive behavior. The only permitted integrations are capabilities selected by the user: ${capabilities.join(", ") || "none"}. For data use window.workspaceAPI.data.list(), .create(record), .update(id, record), .delete(id). For LLM use window.workspaceAPI.llm.ask(prompt). Do not access localStorage, cookies, parent DOM, or browser APIs for network access. Do not invent credentials. Do not include applicant or private team data unless the user explicitly asks. Produce actual app behavior, not a mockup.`,
        },
        { role: "user", content: prompt },
      ],
    });
    const content = completion.choices[0]?.message.content ?? "";
    let generated: Record<string, unknown>;
    try {
      generated = JSON.parse(content) as Record<string, unknown>;
    } catch {
      res.status(502).json({ error: "The assistant returned an invalid workspace draft. Try again." });
      return;
    }
    const title = clipped(generated.title, 120);
    const description = clipped(generated.description, 1000);
    const html = typeof generated.html === "string" ? generated.html : "";
    if (!title || !html || Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      res.status(502).json({ error: "The generated workspace did not pass validation. Try simplifying the request." });
      return;
    }
    const id = randomUUID();
    const teamId = await requestTeamId(req);
    const accountId = authenticatedInterviewerId(req) ?? "";
    const saved = await pool.query(
      `insert into "custom_workspaces"
        ("id", "team_id", "title", "description", "prompt", "html", "capabilities", "status", "created_by")
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', $8)
      returning "id", "title", "description", "html", "capabilities", "status", "access_mode" as "accessMode",
                "allowed_interviewer_ids" as "allowedInterviewerIds",
                 "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [id, teamId, title, description, prompt, html, JSON.stringify(capabilities), accountId],
    );
    await pool.query(
      `insert into "custom_workspace_versions" ("id", "team_id", "workspace_id", "html", "capabilities", "created_by", "message")
       values ($1, $2, $3, $4, $5::jsonb, $6, 'Initial AI draft')`,
      [randomUUID(), teamId, id, html, JSON.stringify(capabilities), accountId],
    );
    res.status(201).json({ workspace: saved.rows[0] });
  } catch (error) {
    req.log.error({ err: error }, "Custom workspace generation failed");
    res.status(503).json({ error: "Workspace generation is unavailable right now." });
  }
});

router.get("/custom-workspaces/:id", requireCustomWorkspaceAdmin, async (req, res): Promise<void> => {
  const row = await accessibleWorkspace(req, res, String(req.params.id ?? ""), true);
  if (row) res.json({ workspace: row });
});

router.get("/custom-workspaces/:id/versions", requireCoordinator, async (req, res): Promise<void> => {
  const workspaceId = String(req.params.id ?? "");
  if (!await workspaceForVersionHistory(req, res, workspaceId)) return;
  const teamId = await requestTeamId(req);
  const versions = await pool.query(
    `select "id", "message", "created_by" as "createdBy", "created_at" as "createdAt"
       from "custom_workspace_versions"
      where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      order by "created_at" desc limit 50`,
    [workspaceId, teamId],
  );
  res.json({ versions: versions.rows });
});

router.get("/custom-workspaces/:id/versions/:versionId", requireCoordinator, async (req, res): Promise<void> => {
  const workspaceId = String(req.params.id ?? "");
  if (!await workspaceForVersionHistory(req, res, workspaceId)) return;
  const teamId = await requestTeamId(req);
  const version = await pool.query(
    `select "id", "html", "capabilities", "message", "created_by" as "createdBy",
            "created_at" as "createdAt"
       from "custom_workspace_versions"
      where "id" = $1 and "workspace_id" = $2 and ${teamSqlCondition('"team_id"', "$3")}
      limit 1`,
    [String(req.params.versionId ?? ""), workspaceId, teamId],
  );
  if (!version.rowCount) {
    res.status(404).json({ error: "That version was not found." });
    return;
  }
  res.json({ version: version.rows[0] });
});

router.post("/custom-workspaces/:id/revise", requireCoordinator, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const workspaceId = String(req.params.id ?? "");
  const instruction = clipped(bodyObject(req.body).prompt, 4000);
  if (!instruction) {
    res.status(400).json({ error: "Describe the changes you want." });
    return;
  }
  const existing = await pool.query<WorkspaceRow & { prompt: string }>(
    `select "id", "title", "description", "html", "capabilities", "status", "prompt",
            "created_at", "updated_at"
       from "custom_workspaces"
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} and "status" = 'draft'
      limit 1`,
    [workspaceId, teamId],
  );
  const current = existing.rows[0];
  if (!current) {
    res.status(404).json({ error: "Draft workspace not found." });
    return;
  }
  if (limited(`revise:${authenticatedInterviewerId(req)}`, 5)) {
    res.status(429).json({ error: "Workspace generation is temporarily rate limited." });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_ASSISTANT_MODEL || "gpt-5.6-terra",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Revise the supplied standalone internal web application to meet the requested changes. Keep it responsive and accessible, use inline CSS/JavaScript only, and do not add external URLs, scripts, or direct network access. Preserve working behavior not affected by the request. Return JSON only: {\"title\":string,\"description\":string,\"html\":string}." },
        { role: "user", content: JSON.stringify({ requirements: instruction, existing: { title: current.title, description: current.description, html: current.html, capabilities: current.capabilities } }) },
      ],
    });
    let generated: Record<string, unknown>;
    try {
      generated = JSON.parse(completion.choices[0]?.message.content ?? "") as Record<string, unknown>;
    } catch {
      res.status(502).json({ error: "The assistant returned an invalid revision. Try again." });
      return;
    }
    const html = typeof generated.html === "string" ? generated.html : "";
    const title = clipped(generated.title, 120);
    const description = clipped(generated.description, 1000);
    if (!html || !title || Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
      res.status(502).json({ error: "The revised workspace did not pass validation." });
      return;
    }
    const accountId = authenticatedInterviewerId(req) ?? "";
    await pool.query(
      `insert into "custom_workspace_versions" ("id", "team_id", "workspace_id", "html", "capabilities", "created_by", "message")
       values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [randomUUID(), teamId, workspaceId, current.html, JSON.stringify(current.capabilities), accountId, `Before revision: ${instruction.slice(0, 300)}`],
    );
    const updated = await pool.query(
      `update "custom_workspaces" set "title" = $3, "description" = $4, "html" = $5, "updated_at" = now()
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      returning "id", "title", "description", "html", "capabilities", "status", "access_mode" as "accessMode",
                "allowed_interviewer_ids" as "allowedInterviewerIds",
                  "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [workspaceId, teamId, title, description, html],
    );
    res.json({ workspace: updated.rows[0] });
  } catch (error) {
    req.log.error({ err: error, workspaceId }, "Custom workspace revision failed");
    res.status(503).json({ error: "Workspace revision is unavailable right now." });
  }
});

router.post("/custom-workspaces/:id/versions/:versionId/restore", requireCoordinator, async (req, res): Promise<void> => {
  const workspaceId = String(req.params.id ?? "");
  const versionId = String(req.params.versionId ?? "");
  const teamId = await requestTeamId(req);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      id: string;
      html: string;
      capabilities: string[];
      status: "draft" | "published";
    }>(
      `select "id", "html", "capabilities", "status" from "custom_workspaces"
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
          and "status" in ('draft', 'published')
        limit 1 for update`,
      [workspaceId, teamId],
    );
    const currentWorkspace = current.rows[0];
    if (!currentWorkspace) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "Workspace not found." });
      return;
    }
    const previous = await client.query<{ html: string; capabilities: string[] }>(
      `select "html", "capabilities" from "custom_workspace_versions"
        where "id" = $1 and "workspace_id" = $2 and ${teamSqlCondition('"team_id"', "$3")}
        limit 1`,
      [versionId, workspaceId, teamId],
    );
    const previousVersion = previous.rows[0];
    if (!previousVersion) {
      await client.query("ROLLBACK");
      res.status(404).json({ error: "That version was not found." });
      return;
    }
    const accountId = authenticatedInterviewerId(req) ?? "";
    await client.query(
      `insert into "custom_workspace_versions" ("id", "team_id", "workspace_id", "html", "capabilities", "created_by", "message")
       values ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        randomUUID(),
        teamId,
        workspaceId,
        currentWorkspace.html,
        JSON.stringify(currentWorkspace.capabilities),
        accountId,
        currentWorkspace.status === "published" ? "Before published version restore" : "Before version restore",
      ],
    );
    const restored = await client.query(
      `update "custom_workspaces"
          set "html" = $3,
              "capabilities" = case when "status" = 'draft' then $4::jsonb else "capabilities" end,
              "updated_at" = now()
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        returning "id", "title", "description", "html", "capabilities", "status", "access_mode" as "accessMode",
                  "allowed_interviewer_ids" as "allowedInterviewerIds",
                  "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [workspaceId, teamId, previousVersion.html, JSON.stringify(previousVersion.capabilities)],
    );
    await client.query("COMMIT");
    res.json({ workspace: restored.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    req.log.error({ err: error, workspaceId, versionId }, "Custom workspace version restore failed");
    res.status(500).json({ error: "Unable to restore this workspace version." });
  } finally {
    client.release();
  }
});

router.post("/custom-workspaces/:id/publish", requireCoordinator, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const accessSettings = await saveableAccessSettings(req.body, teamId);
  if (!accessSettings) {
    res.status(400).json({ error: "Choose a valid access mode and current team members." });
    return;
  }
  const result = await pool.query(
    `update "custom_workspaces" set "status" = 'published', "access_mode" = $3,
              "allowed_interviewer_ids" = $4::jsonb, "updated_at" = now()
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      returning "id", "title", "description", "capabilities", "status", "access_mode" as "accessMode",
                "allowed_interviewer_ids" as "allowedInterviewerIds",
                "created_at" as "createdAt", "updated_at" as "updatedAt"`,
    [String(req.params.id ?? ""), teamId, accessSettings.accessMode, JSON.stringify(accessSettings.allowedInterviewerIds)],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Workspace not found." });
    return;
  }
  res.json({ workspace: result.rows[0] });
});

router.patch("/custom-workspaces/:id/access", requireCoordinator, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const accessSettings = await saveableAccessSettings(req.body, teamId);
  if (!accessSettings) {
    res.status(400).json({ error: "Choose a valid access mode and current team members." });
    return;
  }
  const result = await pool.query(
    `update "custom_workspaces" set "access_mode" = $3,
              "allowed_interviewer_ids" = $4::jsonb, "updated_at" = now()
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} and "status" = 'published'
      returning "id", "title", "description", "capabilities", "status", "access_mode" as "accessMode",
                "allowed_interviewer_ids" as "allowedInterviewerIds",
                "created_at" as "createdAt", "updated_at" as "updatedAt"`,
    [String(req.params.id ?? ""), teamId, accessSettings.accessMode, JSON.stringify(accessSettings.allowedInterviewerIds)],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Published workspace not found." });
    return;
  }
  res.json({ workspace: result.rows[0] });
});

router.get("/custom-workspaces/:id/data", requireCustomWorkspaceAdmin, async (req, res): Promise<void> => {
  const workspace = await accessibleWorkspace(req, res, String(req.params.id ?? ""));
  if (!workspace) return;
  if (!workspace.capabilities.includes("data")) {
    res.status(403).json({ error: "This workspace has not been granted data access." });
    return;
  }
  const teamId = await requestTeamId(req);
  const result = await pool.query(
    `select "id", "value", "created_at" as "createdAt", "updated_at" as "updatedAt"
       from "custom_workspace_data"
      where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      order by "updated_at" desc limit 500`,
    [workspace.id, teamId],
  );
  res.json({ records: result.rows });
});

router.post("/custom-workspaces/:id/data", requireCustomWorkspaceAdmin, async (req, res): Promise<void> => {
  const workspace = await accessibleWorkspace(req, res, String(req.params.id ?? ""));
  if (!workspace) return;
  if (workspace.status !== "published" || !workspace.capabilities.includes("data")) {
    res.status(403).json({ error: "Data writes require a published workspace with data access." });
    return;
  }
  const value = bodyObject(bodyObject(req.body).record);
  const serialized = JSON.stringify(value);
  if (!Object.keys(value).length || Buffer.byteLength(serialized, "utf8") > MAX_RECORD_BYTES) {
    res.status(400).json({ error: "Provide a record under 16 KB." });
    return;
  }
  const teamId = await requestTeamId(req);
  const saved = await pool.query(
    `insert into "custom_workspace_data" ("id", "team_id", "workspace_id", "value")
     values ($1, $2, $3, $4::jsonb)
     returning "id", "value", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
    [randomUUID(), teamId, workspace.id, serialized],
  );
  req.log.info({ workspaceId: workspace.id, action: "record.create" }, "Custom workspace data changed");
  res.status(201).json({ record: saved.rows[0] });
});

router.patch("/custom-workspaces/:id/data/:recordId", requireCustomWorkspaceAdmin, async (req, res): Promise<void> => {
  const workspace = await accessibleWorkspace(req, res, String(req.params.id ?? ""));
  if (!workspace) return;
  if (workspace.status !== "published" || !workspace.capabilities.includes("data")) {
    res.status(403).json({ error: "Data writes require a published workspace with data access." });
    return;
  }
  const value = bodyObject(bodyObject(req.body).record);
  const serialized = JSON.stringify(value);
  if (!Object.keys(value).length || Buffer.byteLength(serialized, "utf8") > MAX_RECORD_BYTES) {
    res.status(400).json({ error: "Provide a record under 16 KB." });
    return;
  }
  const teamId = await requestTeamId(req);
  const result = await pool.query(
    `update "custom_workspace_data" set "value" = $3::jsonb, "updated_at" = now()
      where "id" = $1 and "workspace_id" = $2 and ${teamSqlCondition('"team_id"', "$4")}
      returning "id", "value", "created_at" as "createdAt", "updated_at" as "updatedAt"`,
    [String(req.params.recordId ?? ""), workspace.id, serialized, teamId],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Record not found in this workspace." });
    return;
  }
  req.log.info({ workspaceId: workspace.id, action: "record.update" }, "Custom workspace data changed");
  res.json({ record: result.rows[0] });
});

router.delete("/custom-workspaces/:id/data/:recordId", requireCustomWorkspaceAdmin, async (req, res): Promise<void> => {
  const workspace = await accessibleWorkspace(req, res, String(req.params.id ?? ""));
  if (!workspace) return;
  if (workspace.status !== "published" || !workspace.capabilities.includes("data")) {
    res.status(403).json({ error: "Data writes require a published workspace with data access." });
    return;
  }
  const teamId = await requestTeamId(req);
  const result = await pool.query(
    `delete from "custom_workspace_data"
      where "id" = $1 and "workspace_id" = $2 and ${teamSqlCondition('"team_id"', "$3")}
      returning "id"`,
    [String(req.params.recordId ?? ""), workspace.id, teamId],
  );
  if (!result.rowCount) {
    res.status(404).json({ error: "Record not found in this workspace." });
    return;
  }
  req.log.info({ workspaceId: workspace.id, action: "record.delete" }, "Custom workspace data changed");
  res.json({ deleted: true });
});

router.post("/custom-workspaces/:id/llm", requireCustomWorkspaceAdmin, async (req, res): Promise<void> => {
  const workspace = await accessibleWorkspace(req, res, String(req.params.id ?? ""));
  if (!workspace) return;
  if (!workspace.capabilities.includes("llm")) {
    res.status(403).json({ error: "This workspace has not been granted LLM access." });
    return;
  }
  const question = clipped(bodyObject(req.body).prompt, 2000);
  if (!question) {
    res.status(400).json({ error: "Ask a question first." });
    return;
  }
  const accountId = authenticatedInterviewerId(req) ?? "";
  if (limited(`llm:${workspace.id}:${accountId}`)) {
    res.status(429).json({ error: "This workspace has reached its temporary LLM request limit." });
    return;
  }
  try {
    const completion = await openai.chat.completions.create({
      model: process.env.AI_ASSISTANT_MODEL || "gpt-5.6-terra",
      max_tokens: 800,
      messages: [{ role: "user", content: question }],
    });
    res.json({ answer: completion.choices[0]?.message.content ?? "" });
  } catch (error) {
    req.log.warn({ err: error, workspaceId: workspace.id }, "Custom workspace LLM call failed");
    res.status(503).json({ error: "LLM service is temporarily unavailable." });
  }
});

export default router;
