import { Router, type IRouter, type Request, type Response } from "express";

/**
 * Sitemap endpoint.
 *
 * Serves `GET /sitemap.xml` (canonical, mounted in app.ts before the SPA
 * fallback) and `GET /api/sitemap.xml` (alias, mounted via routes/index.ts).
 *
 * The sitemap lists the frontend pages a crawler can visit. API endpoints are
 * deliberately excluded: they are not pages, a crawler cannot render them,
 * and the machine-readable contract for them lives in
 * lib/api-spec/openapi.yaml instead.
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
  "/custom-workspaces",
  "/display",
  "/assistant",
  "/error/404",
  "/sitemap.xml",
];

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
