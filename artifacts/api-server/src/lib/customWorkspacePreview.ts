import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { openai } from "@workspace/integrations-openai-ai-server";
import { DEFAULT_TEAM_ID } from "@workspace/db";
import { getAssistantModel } from "./assistantModel";

const execFileAsync = promisify(execFile);

export interface WorkspaceRuntimeIssue { kind: string; message: string; }
export type WorkspaceTheme = "light" | "dark";
export interface WorkspaceViewport { name: string; width: number; height: number; }

export const WORKSPACE_VIEWPORTS: WorkspaceViewport[] = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

export interface WorkspacePreviewVariant {
  viewport: string;
  theme: WorkspaceTheme;
  passed: boolean;
  issues: string[];
  repair: string;
  runtimeIssues: WorkspaceRuntimeIssue[];
  screenshotBytes: number;
  error?: string;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Render `html` inside a sealed sandbox document (no network, script-only
 * iframe) with the host dashboard theme injected, mirroring the live
 * preview theme tokens. `size` defaults to the desktop QA viewport.
 */
export function visualSandboxDocument(
  html: string,
  darkMode: boolean,
  size: { width: number; height: number } = WORKSPACE_VIEWPORTS[0],
): string {
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
</script></head><body style="margin:0;width:${size.width}px;height:${size.height}px;overflow:hidden;background:${wrapperBackground}"><iframe id="workspace-preview" sandbox="allow-scripts" style="width:${size.width}px;height:${size.height}px;border:0" srcdoc="${escapeAttribute(document)}"></iframe></body></html>`;
  return wrapper;
}

export async function captureWorkspaceScreenshot(
  html: string,
  theme: WorkspaceTheme,
  size: { width: number; height: number } = WORKSPACE_VIEWPORTS[0],
): Promise<{ screenshot: string; runtimeIssues: WorkspaceRuntimeIssue[] }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "workspace-visual-qa-"));
  const source = path.join(directory, "preview.html");
  const screenshot = path.join(directory, "preview.png");
  try {
    await writeFile(source, visualSandboxDocument(html, theme === "dark", size), "utf8");
    const { stdout } = await execFileAsync(process.env.CHROMIUM_PATH || "/repl/tools/bin/chromium", [
      "--headless", "--disable-gpu", "--disable-dev-shm-usage",
      "--disable-background-networking", "--host-resolver-rules=MAP * ~NOTFOUND",
      "--hide-scrollbars", `--window-size=${size.width},${size.height}`, "--virtual-time-budget=5000", "--dump-dom",
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

export async function inspectWorkspaceScreenshot(
  requirements: string,
  theme: WorkspaceTheme,
  screenshotBase64: string,
  teamId = DEFAULT_TEAM_ID,
): Promise<{ passed: boolean; issues: string[]; repair: string }> {
  const model = await getAssistantModel(teamId);
  const completion = await retryAiCall(() => openai.chat.completions.create({
    model,
    max_completion_tokens: 8192,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Act as the visual QA agent for an app embedded in the Robotics team workspace. Review the rendered ${theme.toUpperCase()}-THEME screenshot against the requirements and the host dashboard design system: navy hierarchy, teal primary actions, restrained yellow accents, cool light/dark surfaces, white cards, subtle borders, rounded corners, and compact practical layouts. For dark mode, ensure text, controls, cards, borders, and states remain readable against dark surfaces, and reject hard-coded light surfaces or colors that become low-contrast or off-brand. Reject unrelated palettes, oversized marketing hero styling, or duplicated host navigation as brand mismatches. Also check for blank or broken rendering, clipped/overlapping content, unreadable contrast, missing key UI, and obvious layout defects. Pass only when this theme is coherent, meets the brief, and visually belongs to the host workspace. Return JSON only: {"passed":boolean,"issues":string[],"repair":string}. If passed, repair must be empty. If not, give precise changes.`,
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

/**
 * Test seam. The real capture needs a headless Chromium (absent on some
 * hosts), so tests inject a deterministic capture instead of requiring a
 * machine-specific binary.
 */
export type WorkspaceVisualTools = {
  capture: typeof captureWorkspaceScreenshot;
  inspect: typeof inspectWorkspaceScreenshot;
};

let visualTools: WorkspaceVisualTools = {
  capture: captureWorkspaceScreenshot,
  inspect: inspectWorkspaceScreenshot,
};

export function setWorkspaceVisualTools(overrides: Partial<WorkspaceVisualTools>): void {
  visualTools = { ...visualTools, ...overrides };
}

export function getWorkspaceVisualTools(): WorkspaceVisualTools {
  return visualTools;
}

/**
 * Render `html` at the requested themes × viewports, report sandboxed
 * runtime errors, and run the vision QA check per variant. Screenshots
 * stay server-side; the builder receives findings, not base64 images.
 */
export async function previewWorkspaceHtml(
  requirements: string,
  html: string,
  options: {
    themes?: WorkspaceTheme[];
    viewports?: WorkspaceViewport[];
    teamId?: string;
  } = {},
): Promise<WorkspacePreviewVariant[]> {
  const themes = options.themes?.length ? options.themes : (["light", "dark"] as WorkspaceTheme[]);
  const viewports = options.viewports?.length ? options.viewports : [WORKSPACE_VIEWPORTS[0]];
  const variants: WorkspacePreviewVariant[] = [];
  for (const viewport of viewports) {
    for (const theme of themes) {
      try {
        const captured = await visualTools.capture(html, theme, viewport);
        const inspected = await visualTools.inspect(requirements, theme, captured.screenshot, options.teamId ?? DEFAULT_TEAM_ID);
        variants.push({
          viewport: viewport.name,
          theme,
          passed: inspected.passed && captured.runtimeIssues.length === 0,
          issues: [...inspected.issues, ...captured.runtimeIssues.map((issue) => `${issue.kind}: ${issue.message}`)].slice(0, 12),
          repair: inspected.repair,
          runtimeIssues: captured.runtimeIssues,
          screenshotBytes: Buffer.byteLength(captured.screenshot, "base64"),
        });
      } catch (error) {
        variants.push({
          viewport: viewport.name,
          theme,
          passed: false,
          issues: [`Preview could not run: ${error instanceof Error ? error.message : "unknown error"}`],
          repair: "",
          runtimeIssues: [],
          screenshotBytes: 0,
          error: "preview_unavailable",
        });
      }
    }
  }
  return variants;
}
