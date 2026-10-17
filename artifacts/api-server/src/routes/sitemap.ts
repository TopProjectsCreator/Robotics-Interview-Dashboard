import { Router, type IRouter, type Request, type Response } from "express";

/**
 * Sitemap endpoint.
 *
 * Serves `GET /sitemap.xml` (canonical, mounted in app.ts before the SPA
 * fallback) and `GET /api/sitemap.xml` (alias, mounted via routes/index.ts).
 * Every frontend page and every backend API endpoint is listed as a <url>,
 * so crawlers and reviewers can discover the full surface from one file.
 *
 * API paths are discovered at request time by walking the mounted /api
 * router stack, with an exhaustive static fallback so the sitemap stays
 * complete even if introspection ever returns nothing.
 */

// Frontend client-side routes (mirrors the <Switch> in
// artifacts/robotics-interview-dashboard/src/App.tsx). Parameterised routes
// use a harmless example segment so each <loc> is a valid absolute URL.
export const FRONTEND_PATHS = [
  "/",
  "/interview-landing",
  "/chat-landing",
  "/parts-landing",
  "/code-landing",
  "/cad-landing",
  "/auth",
  "/dashboard",
  "/interview",
  "/interview/assistant",
  "/applicants",
  "/queue",
  "/chat",
  "/spreadsheets/example",
  "/attendance",
  "/big-screen",
  "/parts",
  "/parts/assistant",
  "/cad",
  "/code",
  "/display",
  "/assistant",
  "/error/404",
  "/sitemap.xml",
];

// Exhaustive fallback of API routes (Express form, without the /api prefix
// here — the builder adds it). Kept in sync with src/routes/*.ts and
// lib/api-spec/openapi.yaml. Runtime introspection of the live router is
// preferred; this list guarantees completeness if that ever yields nothing.
const FALLBACK_API_ROUTES = [
  "/healthz",
  "/system/usage",
  "/diagnostics",
  "/events",
  "/workspaces/visibility",
  "/auth/login",
  "/auth/logout",
  "/auth/session",
  "/auth/verify-event-passcode",
  "/auth/teams",
  "/auth/teams/random-code",
  "/auth/interviewers",
  "/auth/interviewers/setup",
  "/auth/interviewers/passwords/reset-all",
  "/auth/interviewers/:interviewerId",
  "/auth/interviewers/:interviewerId/name",
  "/auth/interviewers/:interviewerId/role",
  "/auth/interviewers/:interviewerId/password",
  "/auth/passkey/register/options",
  "/auth/passkey/register",
  "/auth/passkey/list",
  "/auth/passkey/:credentialId",
  "/auth/passkey/login/options",
  "/auth/passkey/login",
  "/dashboard/summary",
  "/dashboard/charts",
  "/dashboard/charts/:chartId",
  "/applicants",
  "/applicants/search/ai",
  "/applicants/:id",
  "/applicants/:id/regenerate",
  "/imports",
  "/imports/preview",
  "/imports/history",
  "/storage/uploads/request-url",
  "/storage/uploads",
  "/storage/uploads/chunk-url",
  "/storage/uploads/chunk-complete",
  "/storage/parts-robot-previews",
  "/storage/cad-models",
  "/storage/parasolid-preview",
  "/storage/parasolid-preview/:previewId/overview",
  "/storage/parasolid-preview/:previewId/tiles/:tileId",
  "/storage/objects/*path",
  "/queue",
  "/queue/labels",
  "/queue/advance",
  "/queue/callback",
  "/queue/reset",
  "/queue/settings",
  "/queue/reorder",
  "/queue/chat",
  "/queue/chat/conversations",
  "/queue/chat/:messageId",
  "/queue/chat/:messageId/poll",
  "/queue/chat/:messageId/poll/vote",
  "/queue/chat/:messageId/reactions",
  "/queue/chat/:messageId/pin",
  "/queue/custom-emojis",
  "/chat/settings",
  "/whiteboards",
  "/whiteboards/:whiteboardId",
  "/boards",
  "/boards/:boardId",
  "/spreadsheets",
  "/spreadsheets/:spreadsheetId",
  "/display/state",
  "/display/announcement",
  "/display/settings",
  "/seating/settings",
  "/seating/assign",
  "/assistant/ask",
  "/assistant/ask/stream",
  "/assistant/images",
  "/assistant/models",
  "/assistant/config",
  "/assistant/conversations",
  "/assistant/conversations/:conversationId",
  "/assistant/conversations/:conversationId/messages",
  "/assistant/history",
  "/presence",
  "/presence/heartbeat",
  "/presence/stats",
  "/presence/kick",
  "/broadcasts",
  "/broadcasts/mine",
  "/broadcasts/commands",
  "/broadcasts/:broadcastId/ack",
  "/snapshots",
  "/snapshots/:snapshotId/restore",
  "/parts/dashboard",
  "/parts/catalog",
  "/parts/catalog/search",
  "/parts/catalog/search/stream",
  "/parts/catalog/import",
  "/parts/catalog/sync",
  "/parts/catalog/:partId/stock",
  "/parts/catalog/:partId/cost",
  "/parts/catalog/:partId/price-snapshots",
  "/parts/robots",
  "/parts/robots/:robotId",
  "/parts/robots/:robotId/details",
  "/parts/robots/:robotId/preview",
  "/parts/robots/:robotId/parts/:partId",
  "/code/projects",
  "/code/projects/:projectId",
  "/code/projects/:projectId/files",
  "/code/projects/:projectId/revisions",
  "/code/projects/:projectId/deploy",
  "/code/projects/:projectId/presence",
  "/code/files",
  "/code/files/:fileId",
  "/cad/library",
  "/cad/bots",
  "/cad/bots/:botId",
  "/cad/folders",
  "/cad/folders/:folderId",
  "/cad/models",
  "/cad/models/:modelId",
  "/sitemap.xml",
];

let apiRouterRef: IRouter | null = null;

/** Called once from routes/index.ts so the handler can introspect live routes. */
export function setApiRouter(router: IRouter): void {
  apiRouterRef = router;
}

type StackLayer = {
  route?: { path?: string | string[] };
  name?: string;
  regexp?: RegExp;
  handle?: { stack?: StackLayer[] };
};

function parseMountPrefix(layer: StackLayer): string {
  const source = layer.regexp?.source ?? "";
  // Express mounts like app.use("/api", router) compile to ^\/api\/?(?=\/|$).
  // Bare router.use(subRouter) compiles to ^\/?(?=\/|$) (no prefix).
  const match = source.match(/^\^\\\/((?:[^\\?]+?))(?:\\\/\?)?\(\?=[\\/]/);
  if (!match) return "";
  const raw = match[1].replace(/\\\//g, "/");
  // Guard against regex artefacts; only accept plain path segments.
  if (!/^[A-Za-z0-9._~\/-]+$/.test(raw)) return "";
  return `/${raw}`.replace(/\/+/g, "/").replace(/\/$/, "");
}

function collectFromStack(stack: StackLayer[] | undefined, prefix: string, out: Set<string>): void {
  if (!stack) return;
  for (const layer of stack) {
    const routePath = layer.route?.path;
    if (routePath) {
      const paths = Array.isArray(routePath) ? routePath : [routePath];
      for (const p of paths) {
        if (typeof p === "string" && p) out.add(`${prefix}${p}`.replace(/\/+/g, "/"));
      }
      continue;
    }
    const nested = layer.handle?.stack;
    if (nested) {
      collectFromStack(nested, `${prefix}${parseMountPrefix(layer)}`, out);
    }
  }
}

/** All /api route paths (Express form, e.g. /api/applicants/:id). */
export function listApiRoutePaths(): string[] {
  const found = new Set<string>();
  const stack = (apiRouterRef as unknown as { stack?: StackLayer[] } | null)?.stack;
  collectFromStack(stack, "/api", found);
  // Static fallback guarantees completeness (e.g. routes added after boot
  // introspection, or an Express version with an opaque stack shape).
  for (const p of FALLBACK_API_ROUTES) found.add(`/api${p}`.replace(/\/+/g, "/"));
  return [...found].sort();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Turn an Express-style path into a crawlable example URL segment. */
export function sitemapPathForUrl(path: string): string {
  return path
    .replace(/\{[^}]+\}/g, "example")
    .replace(/\*path\b/g, "example")
    .replace(/\*/g, "example")
    .replace(/:([A-Za-z0-9_]+)\?/g, "example")
    .replace(/:([A-Za-z0-9_]+)/g, "example");
}

function baseUrlForRequest(req: Request): string {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (
    Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto?.split(",")[0]
  )?.trim();
  const protocol = (proto || req.protocol || "http").replace(/:$/, "");
  const host = req.get("host") || "localhost";
  return `${protocol}://${host}`;
}

export function buildSitemapXml(baseUrl: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const cleanBase = baseUrl.replace(/\/$/, "");
  const urls = new Set<string>();
  for (const p of FRONTEND_PATHS) urls.add(`${cleanBase}${sitemapPathForUrl(p)}`);
  for (const p of listApiRoutePaths()) urls.add(`${cleanBase}${sitemapPathForUrl(p)}`);
  const sorted = [...urls].sort();
  const body = sorted
    .map((loc) => `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapHandler(req: Request, res: Response): void {
  const xml = buildSitemapXml(baseUrlForRequest(req));
  res.status(200).set({
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
  res.send(xml);
}

const router: IRouter = Router();

// Alias under /api (mounted router lives at /api, so this serves
// GET /api/sitemap.xml). The canonical GET /sitemap.xml is registered
// directly on the app in app.ts before the SPA fallback.
router.get("/sitemap.xml", sitemapHandler);

export default router;
