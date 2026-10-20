import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
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
const execFileAsync = promisify(execFile);
const VISUAL_REPAIR_LIMIT = 2;

async function retryAiCall<T>(operation: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      const status = (error as { status?: number }).status;
      const retryable = status === undefined || status === 429 || status >= 500;
      if (!retryable || attempt >= 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    }
  }
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

type WorkspaceRuntimeIssue = { kind: string; message: string };
type WorkspaceSourceFile = { path: string; content: string };

function compileWorkspaceFiles(sourceFiles: WorkspaceSourceFile[]): string | null {
  const files = new Map(sourceFiles.map((file) => [file.path, file.content]));
  const html = files.get("index.html");
  if (html === undefined) return null;
  return html
    .replace(/<link\b([^>]*?)href=(["'])([^"']+)\2([^>]*)>/gi, (tag, before: string, _quote: string, href: string, after: string) => {
      const css = files.get(href.replace(/^\.\//, ""));
      return css === undefined || !/stylesheet/i.test(`${before}${after}`) ? tag : `<style>${css.replace(/<\/style/gi, "<\\/style")}</style>`;
    })
    .replace(/<script\b([^>]*?)src=(["'])([^"']+)\2([^>]*)>\s*<\/script>/gi, (tag, before: string, _quote: string, src: string, after: string) => {
      const js = files.get(src.replace(/^\.\//, ""));
      return js === undefined ? tag : `<script${before}${after}>${js.replace(/<\/script/gi, "<\\/script")}</script>`;
    });
}

function visualSandboxDocument(html: string, darkMode: boolean): string {
  const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'">`;
  const dashboardTheme = `<style>
  :root {
    --background: 216 38% 96%; --foreground: 220 25% 16%; --border: 215 25% 86%;
    --card: 0 0% 100%; --card-foreground: 220 25% 16%; --card-border: 215 25% 87%;
    --primary: 190 76% 37%; --primary-foreground: 0 0% 100%; --secondary: 215 26% 91%;
    --secondary-foreground: 220 25% 21%; --muted: 215 26% 92%; --muted-foreground: 216 13% 44%;
    --accent: 42 91% 62%; --accent-foreground: 220 32% 13%; --input: 215 22% 80%; --ring: 190 76% 37%;
    --workspace-navy: #183a4b; --workspace-teal: #16869a; --workspace-yellow: #f8c84a;
    --app-font-sans: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
    --app-font-mono: 'DM Mono', ui-monospace, monospace;
  }
  :root.dark {
    color-scheme: dark;
    --background: 220 32% 7%; --foreground: 210 20% 90%; --border: 215 20% 22%;
    --card: 218 28% 11%; --card-foreground: 210 20% 90%; --card-border: 215 20% 22%;
    --primary: 190 55% 55%; --primary-foreground: 220 32% 8%; --secondary: 215 22% 18%;
    --secondary-foreground: 210 18% 88%; --muted: 215 22% 16%; --muted-foreground: 214 14% 62%;
    --accent: 215 22% 18%; --accent-foreground: 210 20% 90%; --input: 215 20% 26%; --ring: 190 60% 55%;
    --workspace-navy: #e5edf2; --workspace-teal: #6fc3cf; --workspace-yellow: #e8c85a;
  }
  html, body { min-height: 100%; }
  body { margin: 0; background: hsl(var(--background)); color: hsl(var(--foreground)); font-family: var(--app-font-sans); }
  </style>`;
  const reporter = `<script>
(() => {
  const send = (kind, message) => {
    try { window.parent.postMessage({ channel: "workspace-runtime-diagnostic", kind, message: String(message).replace(/\\s+/g, " ").slice(0, 500) }, "*"); } catch {}
  };
  window.addEventListener("error", (event) => {
    const target = event.target;
    if (target && target !== window) {
      const name = target.localName || target.tagName || "resource";
      const url = target.currentSrc || target.src || target.href || target.getAttribute?.("src") || target.getAttribute?.("href") || "";
      send("Asset load failure", name + (url ? " " + url : ""));
      return;
    }
    send("JavaScript exception", (event.message || "Script execution failed") + (event.filename ? " (" + event.filename + ":" + event.lineno + ")" : ""));
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    send("Unhandled promise rejection", reason && typeof reason === "object" && "message" in reason ? reason.message : reason ?? "Promise rejected");
  });
  document.addEventListener("securitypolicyviolation", (event) => {
    send("Blocked resource", (event.blockedURI || "unknown resource") + " (" + event.violatedDirective + ")");
  });
})();
</script>`;
  // Keep one known diagnostic-friendly policy. A draft's own CSP meta can only
  // add a second, stricter policy and accidentally disable the injected reporter.
  const cleanHtml = html.replace(
    /<meta\b(?=[^>]*\bhttp-equiv\s*=\s*(?:"content-security-policy"|'content-security-policy'|content-security-policy))[^>]*>/gi,
    "",
  );
  const themedHtml = /<html\b([^>]*)>/i.test(cleanHtml)
    ? cleanHtml.replace(/<html\b([^>]*)>/i, (_tag, attrs: string) => {
      const existingClass = attrs.match(/\bclass=(["'])(.*?)\1/i);
      if (existingClass) {
        const retainedClasses = existingClass[2].split(/\s+/).filter((name) => name && name !== "dark");
        if (darkMode) retainedClasses.push("dark");
        return `<html${attrs.replace(existingClass[0], `class="${retainedClasses.join(" ")}"`)}>`;
      }
      return `<html${attrs}${darkMode ? ' class="dark"' : ""}>`;
    })
    : `<!doctype html><html${darkMode ? ' class="dark"' : ""}>${cleanHtml}</html>`;
  const document = /<head\b[^>]*>/i.test(themedHtml)
    ? themedHtml.replace(/<head\b[^>]*>/i, (head) => `${head}${policy}${dashboardTheme}${reporter}`)
    : themedHtml.replace(/<html\b[^>]*>/i, (root) => `${root}<head>${policy}${dashboardTheme}${reporter}</head>`);
  const wrapperBackground = darkMode ? "#0c121a" : "#f3f6f5";
  const wrapper = `<!doctype html><html><head><script>
(() => {
  document.addEventListener("DOMContentLoaded", () => {
    const frame = document.getElementById("workspace-preview");
    const issues = [];
    let captured = false;
    window.addEventListener("message", (event) => {
      if (event.source !== frame.contentWindow || event.data?.channel !== "workspace-runtime-diagnostic") return;
      const issue = { kind: String(event.data.kind || "Runtime error").slice(0, 80), message: String(event.data.message || "").slice(0, 500) };
      if (!issues.some((existing) => existing.kind === issue.kind && existing.message === issue.message) && issues.length < 20) issues.push(issue);
    });
    const finish = () => {
      if (captured) return;
      captured = true;
      document.documentElement.setAttribute("data-qa-runtime", encodeURIComponent(JSON.stringify(issues)));
    };
    frame.addEventListener("load", () => setTimeout(finish, 4500), { once: true });
    setTimeout(finish, 4800);
  });
})();
</script></head><body style="margin:0;width:1280px;height:900px;overflow:hidden;background:${wrapperBackground}"><iframe id="workspace-preview" sandbox="allow-scripts" style="width:1280px;height:900px;border:0" srcdoc="${escapeAttribute(document)}"></iframe></body></html>`;
  return wrapper;
}

type WorkspaceTheme = "light" | "dark";

async function captureWorkspaceScreenshot(
  html: string,
  theme: WorkspaceTheme,
): Promise<{ screenshot: string; runtimeIssues: WorkspaceRuntimeIssue[] }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "workspace-visual-qa-"));
  const source = path.join(directory, "preview.html");
  const screenshot = path.join(directory, "preview.png");
  try {
    await writeFile(source, visualSandboxDocument(html, theme === "dark"), "utf8");
    const { stdout } = await execFileAsync(process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium", [
      "--headless", "--disable-gpu", "--disable-dev-shm-usage",
      "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND",
      "--hide-scrollbars", "--window-size=1280,900", "--virtual-time-budget=5000", "--dump-dom",
      `--screenshot=${screenshot}`, `file://${source}`,
    ], { timeout: 20000, maxBuffer: 1024 * 1024 });
    const encodedIssues = stdout.match(/data-qa-runtime="([^"]*)"/)?.[1];
    if (!encodedIssues) throw new Error("The isolated preview did not return its runtime diagnostics.");
    const runtimeIssues = JSON.parse(decodeURIComponent(encodedIssues)) as WorkspaceRuntimeIssue[];
    return { screenshot: (await readFile(screenshot)).toString("base64"), runtimeIssues };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

/**
 * Test seam for the browser-visual step. The real capture needs a headless
 * Chromium, which is not present everywhere (and is absent on Render), so the
 * tools are swappable: tests inject a deterministic capture instead of
 * requiring a machine-specific binary, and production reports a clear
 * failure instead of crashing the stream when Chromium is missing.
 */
export type WorkspaceVisualTools = {
  capture: typeof captureWorkspaceScreenshot;
  inspect: typeof inspectWorkspaceScreenshot;
  repair: typeof repairWorkspaceHtml;
};

let visualTools: WorkspaceVisualTools = {
  capture: captureWorkspaceScreenshot,
  inspect: inspectWorkspaceScreenshot,
  repair: repairWorkspaceHtml,
};

export function setWorkspaceVisualTools(overrides: Partial<WorkspaceVisualTools>): void {
  visualTools = { ...visualTools, ...overrides };
}

async function inspectWorkspaceScreenshot(
  requirements: string,
  theme: WorkspaceTheme,
  screenshotBase64: string,
): Promise<{ passed: boolean; issues: string[]; repair: string }> {
  const completion = await retryAiCall(() => openai.chat.completions.create({
    model: process.env.AI_ASSISTANT_MODEL || "gpt-5.6-terra",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Act as the visual QA agent for an app embedded in the Robotics team workspace. Review the rendered 1280x900 ${theme.toUpperCase()}-THEME screenshot against the requirements and the host dashboard design system: navy hierarchy, teal primary actions, restrained yellow accents, cool light/dark surfaces, white cards, subtle borders, rounded corners, and compact practical layouts. For dark mode, ensure text, controls, cards, borders, and states remain readable against dark surfaces, and reject hard-coded light surfaces or colors that become low-contrast or off-brand. Reject unrelated palettes, oversized marketing hero styling, or duplicated host navigation as brand mismatches. Also check for blank or broken rendering, clipped/overlapping content, unreadable contrast, missing key UI, and obvious layout defects. Pass only when this theme is coherent, meets the brief, and visually belongs to the host workspace. Return JSON only: {"passed":boolean,"issues":string[],"repair":string}. If passed, repair must be empty. If not, give precise changes.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: `Requirements:\n${requirements}\n\nReview this ${theme} theme screenshot.` },
          { type: "image_url", image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
        ],
      },
    ],
  }));
  const raw = completion.choices[0]?.message.content ?? "";
  const result = JSON.parse(raw) as { passed?: unknown; issues?: unknown; repair?: unknown };
  return {
    passed: result.passed === true,
    issues: Array.isArray(result.issues) ? result.issues.filter((item): item is string => typeof item === "string").slice(0, 8) : [],
    repair: typeof result.repair === "string" ? result.repair.slice(0, 4000) : "",
  };
}

async function repairWorkspaceHtml(
  requirements: string,
  html: string,
  repair: string,
  sourceFiles: WorkspaceSourceFile[],
): Promise<{ title: string; description: string; html: string; sourceFiles: WorkspaceSourceFile[] }> {
  const completion = await retryAiCall(() => openai.chat.completions.create({
    model: process.env.AI_ASSISTANT_MODEL || "gpt-5.6-terra",
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Repair the standalone internal app using the visual QA findings for BOTH light and dark theme screenshots and the browser runtime findings. Preserve and apply the Robotics dashboard design system: navy hierarchy, teal primary actions, restrained yellow accents, cool light/dark surfaces, white cards, subtle borders, rounded corners, and compact practical layouts. In dark mode, ensure text, controls, cards, borders, and interactive states have readable contrast and avoid hard-coded light surfaces or colors that conflict with the host palette. Do not introduce a competing brand or duplicate the host navigation. Inspect the supplied saved source files when tracing local asset references; fix JavaScript exceptions, unhandled rejections, missing or blocked resources, and style mismatches as well as visible defects. Preserve unrelated working behavior. Keep all code inline, accessible, mobile responsive, and offline. Do not add network access or external resources. Return JSON only: {\"title\":string,\"description\":string,\"html\":string,\"sourceFiles\":[{\"path\":string,\"content\":string}]}. Include every supplied source file, with repaired contents where needed.",
      },
      {
        role: "user",
        content: JSON.stringify({ requirements, visualAndRuntimeFindings: repair, html, savedSourceFiles: sourceFiles }),
      },
    ],
  }));
  const result = JSON.parse(completion.choices[0]?.message.content ?? "") as Record<string, unknown>;
  const repairedHtml = typeof result.html === "string" ? result.html : "";
  const title = clipped(result.title, 120);
  if (!repairedHtml || !title || Buffer.byteLength(repairedHtml, "utf8") > MAX_HTML_BYTES) {
    throw new Error("The visual QA repair did not produce a valid app.");
  }
  let repairedSourceFiles = sourceFiles;
  if (Array.isArray(result.sourceFiles)) {
    const byPath = new Map(sourceFiles.map((file) => [file.path, file.content]));
    for (const file of result.sourceFiles) {
      if (
        !file || typeof file !== "object" || typeof file.path !== "string" ||
        typeof file.content !== "string" || !byPath.has(file.path) ||
        Buffer.byteLength(file.content, "utf8") > MAX_HTML_BYTES
      ) continue;
      byPath.set(file.path, file.content);
    }
    repairedSourceFiles = [...byPath].map(([path, content]) => ({ path, content }));
  } else {
    repairedSourceFiles = sourceFiles.map((file) => file.path === "index.html"
      ? { ...file, content: repairedHtml }
      : file);
  }
  const compiledHtml = compileWorkspaceFiles(repairedSourceFiles) ?? repairedHtml;
  if (Buffer.byteLength(compiledHtml, "utf8") > MAX_HTML_BYTES) {
    throw new Error("The repaired workspace files compile to an app that is too large.");
  }
  return { title, description: clipped(result.description, 1000), html: compiledHtml, sourceFiles: repairedSourceFiles };
}

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
          content: `Build a complete, responsive internal web application from the user's requirements that looks native inside the Robotics team workspace. Follow this design system: navy headings, teal #16869a primary actions, restrained yellow #f8c84a accents, cool-gray surfaces, white cards, subtle borders, 10–16px corners, compact mono metadata, and accessible light/dark variants using shared CSS theme tokens. Do not invent a competing palette, duplicate the host sidebar/header/navigation, or use oversized marketing hero styling. Before considering the build finished, complete exactly five sequential critique rounds (1 through 5); all five are mandatory, even when a round has no eligible fixes. Each critique must produce exactly 10 ranked actionable flaws scored 1–10. Implement every score above 6 and every score below 6 for rounds 1–4, then re-critique the updated source; on round 5 implement only scores above 6. Do not stop early, skip a round, or omit a finding because its fix is large. Return JSON only: {"title":string,"description":string,"html":string}. The html must be a complete standalone document with inline CSS and JavaScript, no external dependencies, URLs, scripts, or network requests. Use semantic accessible HTML, mobile-first layout, and real interactive behavior. The only permitted integrations are capabilities selected by the user: ${capabilities.join(", ") || "none"}. For data use window.workspaceAPI.data.list(), .create(record), .update(id, record), .delete(id). For LLM use window.workspaceAPI.llm.ask(prompt). Do not access localStorage, cookies, parent DOM, or browser APIs for network access. Do not invent credentials. Do not include applicant or private team data unless the user explicitly asks. Produce actual app behavior, not a mockup.`,
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
      `insert into "custom_workspace_versions"
        ("id", "team_id", "workspace_id", "html", "capabilities", "source_files", "created_by", "message")
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'Initial AI draft')`,
      [randomUUID(), teamId, id, html, JSON.stringify(capabilities), JSON.stringify([{ path: "index.html", content: html }]), accountId],
    );
    await pool.query(
      `insert into "custom_workspace_files" ("id", "team_id", "workspace_id", "path", "content", "updated_by")
       values ($1, $2, $3, 'index.html', $4, $5)
       on conflict ("workspace_id", "path") do update
         set "content" = excluded."content", "updated_by" = excluded."updated_by", "updated_at" = now()`,
      [randomUUID(), teamId, id, html, accountId],
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

router.get("/custom-workspaces/:id/files", requireCoordinator, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const workspaceId = String(req.params.id ?? "");
  const workspace = await pool.query(
    `select "id" from "custom_workspaces"
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        and ("status" = 'published' or ("status" = 'draft' and "created_by" = $3))
      limit 1`,
    [workspaceId, teamId, authenticatedInterviewerId(req)],
  );
  if (!workspace.rowCount) {
    res.status(404).json({ error: "Workspace not found." });
    return;
  }
  const files = await pool.query(
    `select "path", "content", "updated_at" as "updatedAt"
       from "custom_workspace_files"
      where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      order by "path"`,
    [workspaceId, teamId],
  );
  res.json({ files: files.rows });
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
    `select "id", "html", "capabilities", "source_files" as "sourceFiles", "message", "created_by" as "createdBy",
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
        { role: "system", content: "Revise the supplied standalone internal web application to meet the requested changes while preserving the Robotics dashboard design system: navy hierarchy, teal primary actions, restrained yellow accents, cool light/dark surfaces, white cards, subtle borders, rounded corners, and compact practical layouts. Use the shared CSS theme tokens; do not invent a competing brand or duplicate the host navigation. Before reporting the revision finished, complete exactly five sequential critique rounds (1 through 5); all five are mandatory, even when a round has no eligible fixes. Each critique must produce exactly 10 ranked actionable flaws scored 1–10. Implement every score above 6 and every score below 6 for rounds 1–4, re-critique the updated source, and on round 5 implement only scores above 6. Do not stop early, skip a round, or omit a finding because its fix is large. Keep it responsive and accessible, use inline CSS/JavaScript only, and do not add external URLs, scripts, or direct network access. Preserve working behavior not affected by the request. Return JSON only: {\"title\":string,\"description\":string,\"html\":string}." },
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
    const currentFiles = await pool.query<{ path: string; content: string }>(
      `select "path", "content" from "custom_workspace_files"
        where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        order by "path"`,
      [workspaceId, teamId],
    );
    const currentSourceFiles = currentFiles.rows.length
      ? currentFiles.rows
      : [{ path: "index.html", content: current.html }];
    await pool.query(
      `insert into "custom_workspace_versions"
        ("id", "team_id", "workspace_id", "html", "capabilities", "source_files", "created_by", "message")
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
      [randomUUID(), teamId, workspaceId, current.html, JSON.stringify(current.capabilities), JSON.stringify(currentSourceFiles), accountId, `Before revision: ${instruction.slice(0, 300)}`],
    );
    const updated = await pool.query(
      `update "custom_workspaces" set "title" = $3, "description" = $4, "html" = $5, "updated_at" = now()
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      returning "id", "title", "description", "html", "capabilities", "status", "access_mode" as "accessMode",
                "allowed_interviewer_ids" as "allowedInterviewerIds",
                  "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [workspaceId, teamId, title, description, html],
    );
    await pool.query(
      `insert into "custom_workspace_files" ("id", "team_id", "workspace_id", "path", "content", "updated_by")
       values ($1, $2, $3, 'index.html', $4, $5)
       on conflict ("workspace_id", "path") do update
         set "content" = excluded."content", "updated_by" = excluded."updated_by", "updated_at" = now()`,
      [randomUUID(), teamId, workspaceId, html, accountId],
    );
    await pool.query(
      `update "custom_workspaces"
          set "critique_rounds" = 0, "verified_critique_rounds" = 0,
              "critique_findings" = '{}'::jsonb, "updated_at" = now()
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} and "status" = 'draft'`,
      [workspaceId, teamId],
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
    const currentFiles = await client.query<{ path: string; content: string }>(
      `select "path", "content" from "custom_workspace_files"
        where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        order by "path"`,
      [workspaceId, teamId],
    );
    const currentSourceFiles = currentFiles.rows.length
      ? currentFiles.rows
      : [{ path: "index.html", content: currentWorkspace.html }];
    const previous = await client.query<{ html: string; capabilities: string[]; sourceFiles: WorkspaceSourceFile[] }>(
      `select "html", "capabilities", "source_files" as "sourceFiles" from "custom_workspace_versions"
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
    const versionSourceFiles = Array.isArray(previousVersion.sourceFiles)
      ? previousVersion.sourceFiles
      : [];
    const restoredSourceFiles = versionSourceFiles.length
      ? versionSourceFiles
      : [{ path: "index.html", content: previousVersion.html }];
    if (!restoredSourceFiles.some((file) => file.path === "index.html")) {
      restoredSourceFiles.push({ path: "index.html", content: previousVersion.html });
    }
    const accountId = authenticatedInterviewerId(req) ?? "";
    await client.query(
      `insert into "custom_workspace_versions"
        ("id", "team_id", "workspace_id", "html", "capabilities", "source_files", "created_by", "message")
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)`,
      [
        randomUUID(),
        teamId,
        workspaceId,
        currentWorkspace.html,
        JSON.stringify(currentWorkspace.capabilities),
        JSON.stringify(currentSourceFiles),
        accountId,
        currentWorkspace.status === "published" ? "Before published version restore" : "Before version restore",
      ],
    );
    const restored = await client.query(
      `update "custom_workspaces"
          set "html" = $3,
              "capabilities" = case when "status" = 'draft' then $4::jsonb else "capabilities" end,
              "critique_rounds" = 0,
              "verified_critique_rounds" = 0,
              "critique_findings" = '{}'::jsonb,
              "updated_at" = now()
        where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        returning "id", "title", "description", "html", "capabilities", "status", "access_mode" as "accessMode",
                  "allowed_interviewer_ids" as "allowedInterviewerIds",
                  "created_at" as "createdAt", "updated_at" as "updatedAt"`,
      [workspaceId, teamId, previousVersion.html, JSON.stringify(previousVersion.capabilities)],
    );
    await client.query(
      `delete from "custom_workspace_files"
        where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}`,
      [workspaceId, teamId],
    );
    for (const file of restoredSourceFiles) {
      await client.query(
        `insert into "custom_workspace_files" ("id", "team_id", "workspace_id", "path", "content", "updated_by")
         values ($1, $2, $3, $4, $5, $6)`,
        [randomUUID(), teamId, workspaceId, file.path, file.content, accountId],
      );
    }
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
  const workspaceId = String(req.params.id ?? "");
  if (limited(`visual-publish:${authenticatedInterviewerId(req)}`, 5)) {
    res.status(429).json({ error: "Visual publish checks are temporarily rate limited." });
    return;
  }
  const accessSettings = await saveableAccessSettings(req.body, teamId);
  if (!accessSettings) {
    res.status(400).json({ error: "Choose a valid access mode and current team members." });
    return;
  }
  const currentResult = await pool.query<WorkspaceRow & { prompt: string; critique_rounds: number; verified_critique_rounds: number }>(
    `select "id", "title", "description", "html", "capabilities", "status", "prompt",
            "critique_rounds", "verified_critique_rounds",
            "access_mode" as "accessMode", "allowed_interviewer_ids" as "allowedInterviewerIds"
       from "custom_workspaces"
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} and "status" = 'draft'
      limit 1`,
    [workspaceId, teamId],
  );
  const current = currentResult.rows[0];
  if (!current) {
    res.status(404).json({ error: "Workspace not found." });
    return;
  }
  if (Number(current.critique_rounds) < 5 || Number(current.verified_critique_rounds) < 5) {
    res.status(409).json({ error: "Complete and independently verify all five critique rounds before publishing this workspace." });
    return;
  }
  const accountId = authenticatedInterviewerId(req) ?? "";
  res.status(200);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  const emit = (event: Record<string, unknown>) => {
    res.write(`${JSON.stringify(event)}\n`);
    (res as Response & { flush?: () => void }).flush?.();
  };

  try {
    let html = current.html;
    let finalScreenshot = "";
    const finalScreenshots: Partial<Record<WorkspaceTheme, string>> = {};
    let finalReview: { passed: boolean; issues: string[]; repair: string } | null = null;
    const sourceFilesResult = await pool.query<{ path: string; content: string }>(
      `select "path", "content" from "custom_workspace_files"
        where "workspace_id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
        order by "path"`,
      [workspaceId, teamId],
    );
    let sourceFiles = sourceFilesResult.rows.length
      ? sourceFilesResult.rows
      : [{ path: "index.html", content: current.html }];
    for (let attempt = 0; attempt <= VISUAL_REPAIR_LIMIT; attempt += 1) {
      emit({
        type: "tool_start",
        id: `runtime-${attempt + 1}`,
        tool: "Check browser runtime",
        detail: `Opening the isolated draft in light and dark themes (attempt ${attempt + 1}).`,
      });
      const runtimeDetails: string[] = [];
      for (const theme of ["light", "dark"] as const) {
        const screenshotId = `screenshot-${theme}-${attempt + 1}`;
        emit({
          type: "tool_start",
          id: screenshotId,
          tool: `Capture ${theme} theme screenshot`,
          detail: "Rendering at 1280 × 900.",
        });
        let preview: Awaited<ReturnType<typeof visualTools.capture>>;
        try {
          preview = await visualTools.capture(html, theme);
        } catch (captureError) {
          emit({
            type: "failed",
            message: "The browser runtime check could not run on this server. The workspace remains a draft.",
            issues: [captureError instanceof Error ? captureError.message : "Browser preview unavailable."],
          });
          return;
        }
        finalScreenshots[theme] = preview.screenshot;
        if (theme === "light") finalScreenshot = preview.screenshot;
        emit({
          type: "screenshot",
          id: screenshotId,
          theme,
          image: `data:image/png;base64,${preview.screenshot}`,
        });
        runtimeDetails.push(...preview.runtimeIssues.map((issue) => `${theme} theme — ${issue.kind}: ${issue.message}`));
      }
      emit({
        type: "tool_done",
        id: `runtime-${attempt + 1}`,
        passed: runtimeDetails.length === 0,
        detail: runtimeDetails.length ? runtimeDetails.join(" · ") : "No JavaScript errors or failed resource loads.",
      });
      if (runtimeDetails.length) {
        if (attempt === VISUAL_REPAIR_LIMIT) {
          emit({ type: "failed", message: "Browser runtime checks still found errors. The workspace remains a draft.", issues: runtimeDetails });
          return;
        }
        emit({ type: "tool_start", id: `repair-${attempt + 1}`, tool: "Repair browser runtime issues", detail: runtimeDetails.join(" · ") });
        const repaired = await visualTools.repair(
          current.prompt,
          html,
          `Browser runtime diagnostics:\n${runtimeDetails.join("\n")}`,
          sourceFiles,
        );
        html = repaired.html;
        sourceFiles = repaired.sourceFiles;
        emit({ type: "tool_done", id: `repair-${attempt + 1}` });
        continue;
      }
      const themeReviews: Array<{ theme: WorkspaceTheme; review: Awaited<ReturnType<typeof visualTools.inspect>> }> = [];
      for (const theme of ["light", "dark"] as const) {
        const reviewId = `review-${theme}-${attempt + 1}`;
        emit({
          type: "tool_start",
          id: reviewId,
          tool: `Review ${theme} theme contrast and layout`,
          detail: `Checking the ${theme} rendering against the brief and Robotics workspace style.`,
        });
        const review = await visualTools.inspect(current.prompt, theme, finalScreenshots[theme] ?? "");
        themeReviews.push({ theme, review });
        emit({
          type: "review",
          id: reviewId,
          theme,
          passed: review.passed,
          issues: review.issues,
        });
      }
      finalReview = {
        passed: themeReviews.every(({ review }) => review.passed),
        issues: themeReviews.flatMap(({ theme, review }) =>
          review.issues.length
            ? review.issues.map((issue) => `${theme} theme — ${issue}`)
            : review.passed
              ? []
              : [`${theme} theme — the visual review did not identify a specific issue.`],
        ),
        repair: themeReviews
          .filter(({ review }) => !review.passed)
          .map(({ theme, review }) => `${theme.toUpperCase()} THEME:\n${[...review.issues, review.repair].filter(Boolean).join("\n") || "Correct contrast and align colors with the dashboard theme tokens."}`)
          .join("\n\n"),
      };
      if (finalReview.passed) break;
      if (attempt === VISUAL_REPAIR_LIMIT) {
        emit({ type: "failed", message: "Visual review still found issues. The workspace remains a draft.", issues: finalReview.issues });
        return;
      }
      emit({ type: "tool_start", id: `repair-${attempt + 1}`, tool: "Repair visual issues", detail: finalReview.issues.join(" · ") || finalReview.repair });
      const repaired = await visualTools.repair(
        current.prompt,
        html,
        finalReview.repair || finalReview.issues.join("\n"),
        sourceFiles,
      );
      html = repaired.html;
      sourceFiles = repaired.sourceFiles;
      emit({ type: "tool_done", id: `repair-${attempt + 1}` });
    }

    if (!finalReview?.passed) {
      emit({ type: "failed", message: "Visual review could not confirm this workspace." });
      return;
    }
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const locked = await client.query<{ html: string; status: string }>(
        `select "html", "status" from "custom_workspaces"
          where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")} limit 1 for update`,
        [workspaceId, teamId],
      );
      if (locked.rows[0]?.status !== "draft" || locked.rows[0].html !== current.html) {
        await client.query("ROLLBACK");
        emit({ type: "failed", message: "This draft changed while it was being reviewed. Reload it and try again." });
        return;
      }
      if (html !== current.html || JSON.stringify(sourceFiles) !== JSON.stringify(
        sourceFilesResult.rows.length ? sourceFilesResult.rows : [{ path: "index.html", content: current.html }],
      )) {
        await client.query(
          `insert into "custom_workspace_versions"
            ("id", "team_id", "workspace_id", "html", "capabilities", "source_files", "created_by", "message")
           values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, 'Before visual QA repair')`,
          [
            randomUUID(), teamId, workspaceId, current.html, JSON.stringify(current.capabilities),
            JSON.stringify(sourceFilesResult.rows.length ? sourceFilesResult.rows : [{ path: "index.html", content: current.html }]),
            accountId,
          ],
        );
      }
      const result = await client.query(
        `update "custom_workspaces" set "html" = $3, "status" = 'published', "access_mode" = $4,
                  "allowed_interviewer_ids" = $5::jsonb, "updated_at" = now()
          where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
          returning "id", "title", "description", "html", "capabilities", "status", "access_mode" as "accessMode",
                    "allowed_interviewer_ids" as "allowedInterviewerIds",
                    "created_at" as "createdAt", "updated_at" as "updatedAt"`,
        [workspaceId, teamId, html, accessSettings.accessMode, JSON.stringify(accessSettings.allowedInterviewerIds)],
      );
      for (const file of sourceFiles) {
        await client.query(
          `insert into "custom_workspace_files" ("id", "team_id", "workspace_id", "path", "content", "updated_by")
           values ($1, $2, $3, $4, $5, $6)
           on conflict ("workspace_id", "path") do update
             set "content" = excluded."content", "updated_by" = excluded."updated_by", "updated_at" = now()`,
          [randomUUID(), teamId, workspaceId, file.path, file.content, accountId],
        );
      }
      await client.query("COMMIT");
      emit({ type: "complete", workspace: result.rows[0], image: `data:image/png;base64,${finalScreenshot}` });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    req.log.error({ err: error, workspaceId }, "Custom workspace visual publish failed");
    emit({ type: "failed", message: "Visual review failed, so this workspace was not published." });
  } finally {
    res.end();
  }
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
