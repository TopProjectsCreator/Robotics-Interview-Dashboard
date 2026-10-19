import { randomUUID } from "node:crypto";
import { pool } from "@workspace/db";
import { applyCodeFileContent } from "./codeCollaboration";
import { pushRealtimeHint } from "./realtime";
import { teamSqlCondition } from "./teams";
import { accountById } from "./interviewerAccounts";
import { readWorkspaceVisibility } from "./workspaceAccess";
import { userCanSeeWorkspace, type WorkspaceKey } from "./workspaceVisibility";

async function snapshotCustomWorkspaceBeforeFileChange(
  workspaceId: string,
  teamId: string,
  accountId: string,
  message: string,
): Promise<void> {
  const workspace = await pool.query<{ html: string; capabilities: string[] }>(
    `select "html", "capabilities" from "custom_workspaces"
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      limit 1`,
    [workspaceId, teamId],
  );
  const current = workspace.rows[0];
  if (!current) throw new Error("Custom workspace not found while saving version.");
  const files = await pool.query<{ path: string; content: string }>(
    `select "path", "content" from "custom_workspace_files"
      where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      order by "path"`,
    [workspaceId, teamId],
  );
  const sourceFiles = files.rows.length ? files.rows : [{ path: "index.html", content: current.html }];
  await pool.query(
    `insert into "custom_workspace_versions"
      ("id", "team_id", "workspace_id", "html", "capabilities", "source_files", "created_by", "message")
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
    [randomUUID(), teamId, workspaceId, current.html, JSON.stringify(current.capabilities), JSON.stringify(sourceFiles), accountId, message],
  );
}

const tool = (
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  type: "function" as const,
  function: {
    name,
    description,
    parameters: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  },
});

export const ASSISTANT_WORKSPACE_TOOLS = [
  tool(
    "list_team_chat_messages",
    "Read recent messages from the shared team Chat channel. Direct messages are never included. Deleted messages appear only as a deletion marker.",
    { limit: { type: "integer", minimum: 1, maximum: 50 } },
  ),
  tool(
    "send_team_chat_message",
    "Post a message to the shared team Chat channel as AI assistant. Use only when the user explicitly asks you to share or send something to the team.",
    { message: { type: "string", minLength: 1, maxLength: 4000 } },
    ["message"],
  ),
  tool(
    "list_cad_library",
    "List the current team's CAD bots, folders, and model metadata. This does not download model files or expose private object-storage paths.",
    { limit: { type: "integer", minimum: 1, maximum: 50 } },
  ),
  tool(
    "create_cad_bot",
    "Create a named robot group in the CAD library. Use only when the user asks to organize CAD assets.",
    { name: { type: "string", minLength: 1, maxLength: 120 }, notes: { type: "string", maxLength: 2000 } },
    ["name"],
  ),
  tool(
    "create_cad_folder",
    "Create a folder under a CAD bot. Supply parentId to create a nested folder; botId and parentId must refer to the same team and bot.",
    {
      botId: { type: "string" },
      parentId: { type: "string" },
      name: { type: "string", minLength: 1, maxLength: 120 },
    },
    ["botId", "name"],
  ),
  tool(
    "update_cad_model_details",
    "Rename a CAD library model or update its notes. This changes library metadata only; it does not modify model geometry or delete files.",
    {
      modelId: { type: "string" },
      name: { type: "string", minLength: 1, maxLength: 255 },
      notes: { type: ["string", "null"], maxLength: 2000 },
    },
    ["modelId"],
  ),
  tool(
    "list_code_projects",
    "List code projects in the current team's Code workspace, with file counts and SDK versions.",
    {},
  ),
  tool(
    "create_code_project",
    "Create a new code project in the current team's Code workspace so you can build an app from scratch. Use only when the user asks you to create a new project or custom app.",
    {
      name: { type: "string", minLength: 1, maxLength: 120 },
      sdkVersion: { type: "string", maxLength: 32 },
    },
    ["name"],
  ),
  tool(
    "create_custom_workspace",
    "Create a new custom app workspace draft. Start with a functional standalone HTML/CSS/JavaScript app in html (saved as index.html), then use the custom workspace file tools to inspect and refine its persistent source tree. Never publish automatically. It runs in a sandboxed iframe with no direct network, OS process, or Git server hosting. It can call window.workspaceAPI.data.list/create/update/delete and window.workspaceAPI.llm.ask only when those capabilities are requested. Never claim to provision a real server.",
    {
      title: { type: "string", minLength: 1, maxLength: 120 },
      description: { type: "string", maxLength: 1000 },
      prompt: { type: "string", minLength: 1, maxLength: 8000 },
      html: { type: "string", minLength: 1, maxLength: 120000 },
      capabilities: {
        type: "array",
        uniqueItems: true,
        items: { type: "string", enum: ["data", "llm"] },
      },
    },
    ["title", "prompt", "html", "capabilities"],
  ),
  tool(
    "list_custom_workspace_files",
    "List source files in a custom workspace draft owned by the signed-in coordinator's team.",
    { workspaceId: { type: "string" } },
    ["workspaceId"],
  ),
  tool(
    "read_custom_workspace_file",
    "Read one source file from a custom workspace draft.",
    { workspaceId: { type: "string" }, path: { type: "string", maxLength: 255 } },
    ["workspaceId", "path"],
  ),
  tool(
    "create_custom_workspace_file",
    "Create a new source file in a custom workspace draft. Existing paths are never overwritten.",
    { workspaceId: { type: "string" }, path: { type: "string", minLength: 1, maxLength: 255 }, content: { type: "string", maxLength: 120000 } },
    ["workspaceId", "path", "content"],
  ),
  tool(
    "write_custom_workspace_file",
    "Replace an existing source file in a custom workspace draft.",
    { workspaceId: { type: "string" }, path: { type: "string", minLength: 1, maxLength: 255 }, content: { type: "string", maxLength: 120000 } },
    ["workspaceId", "path", "content"],
  ),
  tool(
    "list_code_project_files",
    "List source file paths and ids for one Code workspace project before reading or editing. Results are paged; use offset to continue.",
    {
      projectId: { type: "string" },
      offset: { type: "integer", minimum: 0 },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
    ["projectId"],
  ),
  tool(
    "read_code_file",
    "Read a source file from a code project in the current team's Code workspace. Returns up to 30,000 characters; ask for a specific path if several files match.",
    { projectId: { type: "string" }, path: { type: "string", maxLength: 255 } },
    ["projectId", "path"],
  ),
  tool(
    "create_code_file",
    "Create a new source file in a team code project. Existing paths are never overwritten; use write_code_file to change an existing file.",
    {
      projectId: { type: "string" },
      path: { type: "string", minLength: 1, maxLength: 255 },
      content: { type: "string", maxLength: 500000 },
    },
    ["projectId", "path", "content"],
  ),
  tool(
    "write_code_file",
    "Replace the contents of an existing source file in the team Code workspace. Use only for an explicit user request to make or apply a code change.",
    {
      fileId: { type: "string" },
      content: { type: "string", maxLength: 500000 },
    },
    ["fileId", "content"],
  ),
] as const;

export const ASSISTANT_WORKSPACE_TOOL_NAMES = new Set<string>(
  ASSISTANT_WORKSPACE_TOOLS.map((item) => item.function.name),
);

type ToolContext = {
  accountId: string;
  teamId: string;
  authorName: string;
};

function textArg(args: Record<string, unknown>, key: string, maxLength: number): string {
  return typeof args[key] === "string" ? String(args[key]).trim().slice(0, maxLength) : "";
}

async function canUseWorkspace(context: ToolContext, workspace: WorkspaceKey): Promise<boolean> {
  if (!context.accountId) return false;
  const account = await accountById(context.accountId);
  if (!account) return false;
  const visibility = await readWorkspaceVisibility(context.teamId);
  return userCanSeeWorkspace(visibility, context.accountId, account.role, workspace);
}

function cleanCodePath(path: string): string | null {
  const cleaned = path.trim().replace(/\\/g, "/").replace(/^\/+/, "");
  if (
    cleaned.length < 1 ||
    cleaned.length > 255 ||
    cleaned.includes("..") ||
    !/^[A-Za-z0-9_.$\-\/+]+$/.test(cleaned)
  ) return null;
  return cleaned;
}

async function compileCustomWorkspace(workspaceId: string, teamId: string): Promise<string | null> {
  const result = await pool.query<{ path: string; content: string }>(
    `select "path", "content" from "custom_workspace_files"
      where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}`,
    [workspaceId, teamId],
  );
  const files = new Map(result.rows.map((file) => [file.path, file.content]));
  let html = files.get("index.html");
  if (html === undefined) return null;
  html = html.replace(/<link\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi, (tag, before: string, _quote: string, href: string, after: string) => {
    const css = files.get(href.replace(/^\.\//, ""));
    return css === undefined || !/stylesheet/i.test(`${before}${after}`) ? tag : `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`;
  });
  html = html.replace(/<script\b([^>]*?)src=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (tag, before: string, _quote: string, src: string, after: string) => {
    const js = files.get(src.replace(/^\.\//, ""));
    return js === undefined ? tag : `<script${before}${after}>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
  });
  return html;
}

async function projectExists(projectId: string, teamId: string): Promise<boolean> {
  const result = await pool.query(
    `select "id" from "code_projects" where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} limit 1`,
    [projectId, teamId],
  );
  return result.rowCount === 1;
}

export async function runAssistantWorkspaceTool(
  name: string,
  args: Record<string, unknown>,
  context: ToolContext,
): Promise<{ content: string; detail: string }> {
  const workspace: WorkspaceKey =
    name === "list_team_chat_messages" || name === "send_team_chat_message"
      ? "chat"
      : name.includes("cad_")
        ? "cad"
        : "code";
  if (name === "create_custom_workspace" || name.endsWith("_custom_workspace_file") || name === "list_custom_workspace_files") {
    const account = context.accountId ? await accountById(context.accountId) : undefined;
    if (account?.role !== "coordinator") {
      return { content: "Only coordinators can create custom workspace drafts.", detail: "access denied" };
    }
  } else if (!(await canUseWorkspace(context, workspace))) {
    return { content: `This account does not have access to the ${workspace} workspace.`, detail: "access denied" };
  }

  if (name === "list_team_chat_messages") {
    const limit = typeof args.limit === "number" ? Math.max(1, Math.min(50, Math.floor(args.limit))) : 20;
    const rows = await pool.query(
      `select "id", "author", "message", "created_at" as "createdAt",
              "pinned_at" as "pinnedAt", "deleted_at" as "deletedAt"
         from "interview_chat_messages"
        where ${teamSqlCondition('"team_id"', "$1")}
          and "conversation_scope" = 'shared' and "conversation_peer" is null
        order by "created_at" desc limit $2`,
      [context.teamId, limit],
    );
    const messages = rows.rows.reverse().map((row) => ({
      id: String(row.id),
      author: String(row.author),
      message: row.deletedAt ? "[message deleted]" : String(row.message).slice(0, 1000),
      createdAt: new Date(String(row.createdAt)).toISOString(),
      pinned: Boolean(row.pinnedAt),
    }));
    return { content: JSON.stringify(messages), detail: `read ${messages.length} shared chat messages` };
  }

  if (name === "send_team_chat_message") {
    const message = textArg(args, "message", 4000);
    if (!message) return { content: "A non-empty message is required.", detail: "no message sent" };
    const id = randomUUID();
    await pool.query(
      `insert into "interview_chat_messages"
        ("id", "team_id", "author", "message", "conversation_scope", "conversation_peer", "activities")
       values ($1, $2, 'AI assistant', $3, 'shared', null, '[]')`,
      [id, context.teamId, message],
    );
    pushRealtimeHint("interview_chat_messages", "INSERT");
    return { content: `Posted to the shared team Chat channel (message ${id}).`, detail: "posted team chat message" };
  }

  if (name === "list_cad_library") {
    const limit = typeof args.limit === "number" ? Math.max(1, Math.min(50, Math.floor(args.limit))) : 30;
    const [bots, folders, models] = await Promise.all([
      pool.query(
        `select "id", "name", "notes" from "cad_bots"
          where ${teamSqlCondition('"team_id"', "$1")} order by lower("name") limit $2`,
        [context.teamId, limit],
      ),
      pool.query(
        `select "id", "bot_id" as "botId", "parent_id" as "parentId", "name"
           from "cad_folders" where ${teamSqlCondition('"team_id"', "$1")}
          order by lower("name") limit $2`,
        [context.teamId, limit],
      ),
      pool.query(
        `select m."id", m."name", m."file_name" as "fileName", m."content_type" as "contentType",
                m."size_bytes" as "sizeBytes", m."bot_id" as "botId", m."folder_id" as "folderId",
                m."notes", m."updated_at" as "updatedAt",
                b."name" as "botName", f."name" as "folderName"
           from "cad_models" m
           left join "cad_bots" b on b."id" = m."bot_id"
             and ${teamSqlCondition('b."team_id"', "$1")}
           left join "cad_folders" f on f."id" = m."folder_id"
             and ${teamSqlCondition('f."team_id"', "$1")}
          where ${teamSqlCondition('m."team_id"', "$1")}
          order by lower(m."name") limit $2`,
        [context.teamId, limit],
      ),
    ]);
    return {
      content: JSON.stringify({
        bots: bots.rows,
        folders: folders.rows,
        models: models.rows.map((row) => ({
          ...row,
          sizeBytes: Number(row.sizeBytes),
          updatedAt: new Date(String(row.updatedAt)).toISOString(),
        })),
      }),
      detail: `listed CAD library (${bots.rowCount ?? 0} bots, ${folders.rowCount ?? 0} folders, ${models.rowCount ?? 0} models)`,
    };
  }

  if (name === "create_cad_bot") {
    const botName = textArg(args, "name", 120).replace(/\s+/g, " ");
    if (!botName) return { content: "Give the CAD bot a name.", detail: "invalid bot name" };
    const notes = textArg(args, "notes", 2000) || null;
    const id = randomUUID();
    try {
      await pool.query(
        `insert into "cad_bots" ("id", "team_id", "name", "notes") values ($1, $2, $3, $4)`,
        [id, context.teamId, botName, notes],
      );
      return { content: JSON.stringify({ botId: id, name: botName }), detail: `created CAD bot ${botName}` };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return { content: "A CAD bot with that name already exists in this team.", detail: "bot name already exists" };
      }
      throw error;
    }
  }

  if (name === "create_cad_folder") {
    const botId = textArg(args, "botId", 128);
    const parentId = textArg(args, "parentId", 128) || null;
    const folderName = textArg(args, "name", 120).replace(/\s+/g, " ");
    if (!botId || !folderName) return { content: "A bot and folder name are required.", detail: "invalid folder" };
    const bot = await pool.query(
      `select "id" from "cad_bots" where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} limit 1`,
      [botId, context.teamId],
    );
    if (!bot.rowCount) return { content: "That CAD bot was not found in this team.", detail: "bot not found" };
    if (parentId) {
      const parent = await pool.query(
        `select "id" from "cad_folders" where "id" = $1 and "bot_id" = $2
           and ${teamSqlCondition('"team_id"', "$3")} limit 1`,
        [parentId, botId, context.teamId],
      );
      if (!parent.rowCount) return { content: "That parent folder is not in this bot.", detail: "parent folder not found" };
    }
    const id = randomUUID();
    try {
      await pool.query(
        `insert into "cad_folders" ("id", "team_id", "bot_id", "parent_id", "name")
         values ($1, $2, $3, $4, $5)`,
        [id, context.teamId, botId, parentId, folderName],
      );
      return { content: JSON.stringify({ folderId: id, botId, parentId, name: folderName }), detail: `created CAD folder ${folderName}` };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return { content: "A folder with that name already exists beside the selected parent.", detail: "folder name already exists" };
      }
      throw error;
    }
  }

  if (name === "update_cad_model_details") {
    const modelId = textArg(args, "modelId", 128);
    const modelName = args.name === undefined ? undefined : textArg(args, "name", 255).replace(/\s+/g, " ");
    const notes = args.notes === undefined ? undefined : args.notes === null ? null : textArg(args, "notes", 2000);
    if (!modelId || (modelName !== undefined && !modelName) || (modelName === undefined && notes === undefined)) {
      return { content: "Provide a model id and at least one valid metadata change.", detail: "invalid model update" };
    }
    const updated = await pool.query(
      `update "cad_models"
          set "name" = case when $2::boolean then $3 else "name" end,
              "notes" = case when $4::boolean then $5 else "notes" end,
              "updated_at" = now()
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$6")}
      returning "id", "name", "file_name" as "fileName", "notes"`,
      [modelId, modelName !== undefined, modelName ?? null, notes !== undefined, notes ?? null, context.teamId],
    );
    if (!updated.rowCount) return { content: "That CAD model was not found in this team.", detail: "model not found" };
    return { content: JSON.stringify(updated.rows[0]), detail: `updated CAD model ${modelId}` };
  }

  if (name === "list_code_projects") {
    const projects = await pool.query(
      `select p."id", p."name", p."sdk_version" as "sdkVersion",
              p."created_at" as "createdAt", p."updated_at" as "updatedAt",
              (select count(*) from "code_files" f
                where f."project_id" = p."id" and ${teamSqlCondition('f."team_id"', "$1")}) as "fileCount"
         from "code_projects" p
        where ${teamSqlCondition('p."team_id"', "$1")}
        order by lower(p."name")`,
      [context.teamId],
    );
    return { content: JSON.stringify(projects.rows), detail: `listed ${projects.rowCount ?? 0} code projects` };
  }

  if (name === "create_code_project") {
    const projectName = textArg(args, "name", 120).replace(/\s+/g, " ");
    if (!projectName) {
      return { content: "Give the new code project a name.", detail: "invalid code project name" };
    }
    const sdkVersion = textArg(args, "sdkVersion", 32) || "v12.0";
    const id = randomUUID();
    try {
      const created = await pool.query(
        `insert into "code_projects" ("id", "team_id", "name", "sdk_version", "created_by")
         values ($1, $2, $3, $4, $5)
         returning "id", "name", "sdk_version" as "sdkVersion",
                   "created_at" as "createdAt", "updated_at" as "updatedAt"`,
        [id, context.teamId, projectName, sdkVersion, context.authorName || "AI assistant"],
      );
      pushRealtimeHint("code_projects", "INSERT");
      return {
        content: JSON.stringify(created.rows[0]),
        detail: `created code project ${projectName}`,
      };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return { content: "A code project with that name already exists in this team.", detail: "code project name already exists" };
      }
      throw error;
    }
  }

  if (name === "create_custom_workspace") {
    const title = textArg(args, "title", 120).replace(/\s+/g, " ");
    const prompt = textArg(args, "prompt", 8000);
    const description = textArg(args, "description", 1000);
    const html = typeof args.html === "string" ? args.html : "";
    const capabilities = Array.isArray(args.capabilities) ? [...new Set(args.capabilities)] : null;
    if (
      !title || !prompt || !html || Buffer.byteLength(html, "utf8") > 120_000 ||
      !capabilities || capabilities.some((value) => value !== "data" && value !== "llm")
    ) {
      return { content: "The custom workspace draft is invalid or too large.", detail: "invalid custom workspace" };
    }
    const id = randomUUID();
    const serializedCapabilities = JSON.stringify(capabilities);
    try {
      const created = await pool.query(
        `insert into "custom_workspaces"
          ("id", "team_id", "title", "description", "prompt", "html", "capabilities", "status", "created_by")
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, 'draft', $8)
         returning "id", "title", "description", "capabilities", "status",
                   "created_at" as "createdAt", "updated_at" as "updatedAt"`,
        [id, context.teamId, title, description, prompt, html, serializedCapabilities, context.accountId],
      );
      await pool.query(
        `insert into "custom_workspace_versions"
          ("id", "team_id", "workspace_id", "html", "capabilities", "source_files", "created_by", "message")
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'Created by assistant')`,
        [
          randomUUID(), context.teamId, id, html, serializedCapabilities,
          JSON.stringify([{ path: "index.html", content: html }]), context.accountId,
        ],
      );
      await pool.query(
        `insert into "custom_workspace_files" ("id", "team_id", "workspace_id", "path", "content", "updated_by")
         values ($1, $2, $3, 'index.html', $4, $5)`,
        [randomUUID(), context.teamId, id, html, context.authorName || "AI assistant"],
      );
      pushRealtimeHint("custom_workspaces", "INSERT");
      return {
        content: `${JSON.stringify(created.rows[0])}\n\nThe draft is saved. Continue by listing its files, reading index.html, and using the custom workspace file tools to refine the persistent app source before reporting completion.`,
        detail: `created custom workspace draft ${title}`,
      };
    } catch (error) {
      throw error;
    }
  }

  if (name.endsWith("_custom_workspace_file") || name === "list_custom_workspace_files") {
    const account = context.accountId ? await accountById(context.accountId) : undefined;
    const workspaceId = textArg(args, "workspaceId", 128);
    if (account?.role !== "coordinator" || !workspaceId) {
      return { content: "Only coordinators can edit a custom workspace draft.", detail: "access denied" };
    }
    const workspace = await pool.query<{ id: string }>(
      `select "id" from "custom_workspaces"
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
          and "created_by" = $3 and "status" = 'draft'
        limit 1`,
      [workspaceId, context.teamId, context.accountId],
    );
    if (!workspace.rowCount) return { content: "That draft was not found in your team.", detail: "custom workspace not found" };
    if (name === "list_custom_workspace_files") {
      const files = await pool.query(
        `select "path", octet_length("content") as "sizeBytes", "updated_at" as "updatedAt"
           from "custom_workspace_files"
          where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
          order by "path"`,
        [workspaceId, context.teamId],
      );
      return { content: JSON.stringify(files.rows), detail: `listed ${files.rowCount ?? 0} custom workspace files` };
    }
    const path = cleanCodePath(textArg(args, "path", 255));
    if (!path) return { content: "Use a valid relative source path.", detail: "invalid file path" };
    if (name === "read_custom_workspace_file") {
      const file = await pool.query<{ content: string }>(
        `select "content" from "custom_workspace_files"
          where "workspace_id" = $1 and "path" = $2 and ${teamSqlCondition('"team_id"', "$3")}
          limit 1`,
        [workspaceId, path, context.teamId],
      );
      return file.rows[0]
        ? { content: JSON.stringify({ path, content: file.rows[0].content }), detail: `read ${path}` }
        : { content: `No file exists at ${path}.`, detail: "custom workspace file not found" };
    }
    const content = typeof args.content === "string" ? args.content : "";
    if (Buffer.byteLength(content, "utf8") > 120_000) return { content: "File exceeds 120 KB.", detail: "file too large" };
    if (name === "create_custom_workspace_file") {
      try {
        await snapshotCustomWorkspaceBeforeFileChange(
          workspaceId,
          context.teamId,
          context.accountId,
          `Before adding ${path}`,
        );
        await pool.query(
          `insert into "custom_workspace_files" ("id", "team_id", "workspace_id", "path", "content", "updated_by")
           values ($1, $2, $3, $4, $5, $6)`,
          [randomUUID(), context.teamId, workspaceId, path, content, context.authorName || "AI assistant"],
        );
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
          return { content: `A file already exists at ${path}; use write_custom_workspace_file to change it.`, detail: "file already exists" };
        }
        throw error;
      }
    } else {
      await snapshotCustomWorkspaceBeforeFileChange(
        workspaceId,
        context.teamId,
        context.accountId,
        `Before changing ${path}`,
      );
      const updated = await pool.query(
        `update "custom_workspace_files" set "content" = $4, "updated_by" = $5, "updated_at" = now()
          where "workspace_id" = $1 and "path" = $2 and ${teamSqlCondition('"team_id"', "$3")}
          returning "path"`,
        [workspaceId, path, context.teamId, content, context.authorName || "AI assistant"],
      );
      if (!updated.rowCount) return { content: `No file exists at ${path}.`, detail: "custom workspace file not found" };
    }
    const compiledHtml = await compileCustomWorkspace(workspaceId, context.teamId);
    if (compiledHtml !== null) {
      await pool.query(
        `update "custom_workspaces" set "html" = $3, "updated_at" = now()
          where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} and "status" = 'draft'`,
        [workspaceId, context.teamId, compiledHtml],
      );
    }
    return { content: `${name === "create_custom_workspace_file" ? "Created" : "Updated"} ${path}.`, detail: `${name === "create_custom_workspace_file" ? "created" : "updated"} ${path}` };
  }

  if (name === "list_code_project_files") {
    const projectId = textArg(args, "projectId", 128);
    if (!projectId || !(await projectExists(projectId, context.teamId))) {
      return { content: "The code project was not found in this team.", detail: "project not found" };
    }
    const offset = typeof args.offset === "number" ? Math.max(0, Math.floor(args.offset)) : 0;
    const limit = typeof args.limit === "number" ? Math.max(1, Math.min(100, Math.floor(args.limit))) : 50;
    const files = await pool.query(
      `select "id", "path", octet_length("content") as "sizeBytes",
              "updated_at" as "updatedAt"
         from "code_files" where "project_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        order by "path" limit $3 offset $4`,
      [projectId, context.teamId, limit, offset],
    );
    return {
      content: JSON.stringify(files.rows.map((row) => ({
        ...row,
        sizeBytes: Number(row.sizeBytes),
        updatedAt: new Date(String(row.updatedAt)).toISOString(),
      }))),
      detail: `listed ${files.rowCount ?? 0} files from code project ${projectId}`,
    };
  }

  if (name === "read_code_file") {
    const projectId = textArg(args, "projectId", 128);
    const path = cleanCodePath(textArg(args, "path", 255));
    if (!projectId || !path || !(await projectExists(projectId, context.teamId))) {
      return { content: "The code project or file path was not found in this team.", detail: "project or file not found" };
    }
    const file = await pool.query(
      `select "id", "path", "content", "updated_at" as "updatedAt"
         from "code_files" where "project_id" = $1 and "path" = $2
           and ${teamSqlCondition('"team_id"', "$3")} limit 1`,
      [projectId, path, context.teamId],
    );
    const row = file.rows[0] as { id: string; path: string; content: string; updatedAt: Date | string } | undefined;
    if (!row) return { content: `No file exists at ${path}.`, detail: "code file not found" };
    return {
      content: JSON.stringify({
        fileId: row.id,
        path: row.path,
        content: row.content.slice(0, 30_000),
        truncated: row.content.length > 30_000,
        updatedAt: new Date(String(row.updatedAt)).toISOString(),
      }),
      detail: `read ${path}`,
    };
  }

  if (name === "create_code_file") {
    const projectId = textArg(args, "projectId", 128);
    const path = cleanCodePath(textArg(args, "path", 255));
    const content = typeof args.content === "string" ? args.content : "";
    if (!projectId || !path || Buffer.byteLength(content, "utf8") > 500_000) {
      return { content: "A valid project, file path, and file content under 500 KB are required.", detail: "invalid code file" };
    }
    if (!(await projectExists(projectId, context.teamId))) {
      return { content: "The code project was not found in this team.", detail: "project not found" };
    }
    const fileId = randomUUID();
    try {
      const saved = await pool.query(
        `insert into "code_files" ("id", "team_id", "project_id", "path", "content", "updated_by")
         values ($1, $2, $3, $4, $5, $6) returning "id", "path"`,
        [fileId, context.teamId, projectId, path, content, context.authorName || "AI assistant"],
      );
      await pool.query(
        `update "code_projects" set "updated_at" = now()
          where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}`,
        [projectId, context.teamId],
      );
      pushRealtimeHint("code_files", "INSERT");
      return { content: JSON.stringify(saved.rows[0]), detail: `created code file ${path}` };
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
        return { content: `A file already exists at ${path}; use write_code_file to change it.`, detail: "code file already exists" };
      }
      throw error;
    }
  }

  if (name === "write_code_file") {
    const fileId = textArg(args, "fileId", 128);
    const content = typeof args.content === "string" ? args.content : "";
    if (!fileId || Buffer.byteLength(content, "utf8") > 500_000) {
      return { content: "A file id and content under 500 KB are required.", detail: "invalid code update" };
    }
    const updated = await pool.query(
      `update "code_files" set "content" = $2, "updated_by" = $3, "updated_at" = now()
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$4")}
      returning "id", "project_id" as "projectId", "path"`,
      [fileId, content, context.authorName || "AI assistant", context.teamId],
    );
    const file = updated.rows[0] as { id: string; projectId: string; path: string } | undefined;
    if (!file) return { content: "That code file was not found in this team.", detail: "code file not found" };
    applyCodeFileContent(file.id, content);
    await pool.query(
      `update "code_projects" set "updated_at" = now()
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}`,
      [file.projectId, context.teamId],
    );
    pushRealtimeHint("code_files", "UPDATE");
    return { content: `Updated ${file.path} (${Buffer.byteLength(content, "utf8")} bytes).`, detail: `updated code file ${file.path}` };
  }

  return { content: `Unknown workspace tool: ${name}`, detail: "unknown tool" };
}
