import express, { type ErrorRequestHandler, type Express, type RequestHandler } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { getRedirectConfig, getRedirectLocation } from "./lib/primaryRedirect";
import { sitemapHandler } from "./routes/sitemap";
import { attachAdminSession } from "./middlewares/adminAuth";
import { isDatabaseConnectionError } from "./lib/databaseErrors";
import { and, eq } from "drizzle-orm";
import { db, interviewerAccountsTable, teamRolesTable, DEFAULT_TEAM_ID } from "@workspace/db";
import { isAdminRole } from "./lib/roles";
import { isUnauthenticatedOrSelfServiceRoute, routePermissionIsGranted, workspaceVisibilityFallback } from "./lib/routePermissions";
import { readWorkspaceVisibility, userCanSeeWorkspace } from "./lib/workspaceAccess";
import { WORKSPACE_KEYS } from "./lib/workspaceVisibility";
import { normalizePermissions, permissionsForBuiltInRole } from "@workspace/api-zod";

const app: Express = express();

// Trust the first proxy hop (Replit/Codespaces) so req.ip reflects the real
// client for presence tracking and login rate limiting.
app.set("trust proxy", 1);

// Primary → backup redirect (egress relief). Must run before any body
// parsing, session work, or static serving so the primary answers with a
// tiny 302 instead of loading the full app. Temporary (302) so the
// primary can be restored after egress resets; the backup host and
// health checks are exempt (see lib/primaryRedirect.ts).
const redirectConfig = getRedirectConfig(process.env);
if (redirectConfig.enabled) {
  logger.info(
    {
      targetUrl: redirectConfig.targetUrl,
      fromHosts: [...redirectConfig.fromHosts],
    },
    "Primary → backup redirect active",
  );
}
app.use((req, res, next) => {
  if (req.path === "/api/healthz") return next();
  const location = getRedirectLocation({
    host: req.hostname ?? req.get("host"),
    originalUrl: req.originalUrl,
    config: redirectConfig,
  });
  if (location) {
    return res.redirect(302, location);
  }
  return next();
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          // Public assistant share tokens are bearer capabilities. Keep both
          // API reads and direct SPA navigations out of request logs.
          url: req.url?.split("?")[0].replace(
            /(\/assistant\/(?:public-shares|share)\/)[A-Za-z0-9_-]{43}(?=\/|$)/g,
            "$1[redacted]",
          ),
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// The dashboard can be hosted inside a coordinator's iframe. In production,
// set ALLOWED_ORIGINS (comma-separated) to explicitly allow embedding sites.
// Never reflect arbitrary origins while credentials are enabled.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
}));
// Security headers. The app is embeddable in a coordinator's iframe, so
// framing is allowed ONLY for the same origin and the explicitly allowed
// origins (never for arbitrary sites). Everything else is locked down:
// no sniffing, no referrer leaking paths, HSTS so browsers never try plain
// HTTP again, and a content policy that only loads our own scripts.
const frameAncestors = ["'self'", ...allowedOrigins].join(" ");
const cameraAllowlist = ["self", ...allowedOrigins.map((origin) => JSON.stringify(origin))].join(" ");
export const securityHeaders: RequestHandler = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.setHeader(
    "Permissions-Policy",
    `camera=(${cameraAllowlist}), microphone=(), geolocation=()`,
  );
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      // Scripts: our bundle plus WASM modules (Yjs, kokoro TTS, three).
      "script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval' blob:",
      // The app loads Inter from Google Fonts, so both the stylesheet and
      // the font files have to stay allowed.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Images/media come from Supabase storage and any https host.
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      // API calls and realtime websockets.
      "connect-src 'self' https: wss:",
      "worker-src 'self' blob:",
      // Chat messages can embed a live page (pasted <iframe> HTML). frame-src
      // otherwise falls back to default-src 'self', which would block embed
      // hosts; chat rendering itself only accepts cross-origin https srcs.
      "frame-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      `frame-ancestors ${frameAncestors}`,
    ].join("; "),
  );
  next();
};
app.use(securityHeaders);
app.use(cookieParser());
app.use(attachAdminSession);
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const session = req.cookies?.robotics_admin_session;
  const origin = req.get("origin");
  const sameOrigin = origin === `${req.protocol}://${req.get("host")}`;
  if (!session || !origin || sameOrigin || allowedOrigins.includes(origin)) {
    next();
    return;
  }
  res.status(403).json({ error: "Origin is not allowed" });
});
// Shrink JSON over the wire (Render meters every byte out): ~75% off lists
// and boards for ~1ms of CPU. Skips streams, images, and tiny bodies.
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    const type = res.getHeader("Content-Type");
    if (typeof type === "string" && /^(image|audio|video|model)\//.test(type)) return false;
    if (typeof type === "string" && /octet-stream|zip|gzip/.test(type)) return false;
    if (req.path === "/api/events") return false;
    return true;
  },
}));
app.use("/api/queue/custom-emojis", express.json({ limit: "1mb" }));
app.use("/api/spreadsheets", express.json({ limit: "10mb" }));
app.use("/api/parts/catalog/identify-image", express.json({ limit: "4.1mb" }));
app.use("/api/assistant/questions", express.json({ limit: "8mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Team capabilities are evaluated centrally before every API handler,
// including direct requests and routes that use different legacy middleware.
// Built-in defaults preserve existing access; unknown accounts and routes fail closed.
app.use("/api", async (req, res, next) => {
  if (isUnauthenticatedOrSelfServiceRoute(req.method, req.originalUrl)) {
    next();
    return;
  }
  const interviewerId = (req as typeof req & { interviewerId?: string }).interviewerId;
  if (!interviewerId) {
    next();
    return;
  }
  try {
    const [account] = await db.select({
      role: interviewerAccountsTable.role,
      customRoleId: interviewerAccountsTable.customRoleId,
      teamId: interviewerAccountsTable.teamId,
    }).from(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, interviewerId)).limit(1);
    if (!account) {
      res.status(403).json({ error: "This action is not available for your account." });
      return;
    }
    if (isAdminRole(account.role)) {
      next();
      return;
    }
    let permissions: string[];
    let isCustomRole = false;
    if (account.customRoleId) {
      const teamId = account.teamId?.trim() || DEFAULT_TEAM_ID;
      const [role] = await db.select({ permissions: teamRolesTable.permissions })
        .from(teamRolesTable)
        .where(and(eq(teamRolesTable.id, account.customRoleId), eq(teamRolesTable.teamId, teamId)))
        .limit(1);
      if (!role) {
        res.status(403).json({ error: "This action is not available for your role." });
        return;
      }
      permissions = normalizePermissions(role.permissions);
      isCustomRole = true;
    } else {
      permissions = permissionsForBuiltInRole(account.role);
    }
    if (!routePermissionIsGranted(permissions, req.method, req.originalUrl, req.body)) {
      // Settings → Workspace access is an explicit per-person grant from an
      // admin, so it also satisfies the permissions tied to that workspace.
      // Administration permissions (*.manage) are outside the fallback.
      const fallback = workspaceVisibilityFallback(req.method, req.originalUrl);
      let grantedByVisibility = false;
      if (fallback) {
        try {
          const teamId = account.teamId?.trim() || DEFAULT_TEAM_ID;
          const visibility = await readWorkspaceVisibility(teamId);
          grantedByVisibility = fallback === "any"
            ? WORKSPACE_KEYS.some((key) => userCanSeeWorkspace(visibility, interviewerId, account.role, key))
            : userCanSeeWorkspace(visibility, interviewerId, account.role, fallback);
        } catch {
          grantedByVisibility = false;
        }
      }
      if (!grantedByVisibility) {
        res.status(403).json({ error: "This action is not available for your role." });
        return;
      }
    }
    const permissionRequest = req as typeof req & { customRolePermissions?: string[]; effectivePermissions?: string[]; isCustomRole?: boolean };
    permissionRequest.effectivePermissions = permissions;
    if (isCustomRole) {
      permissionRequest.customRolePermissions = permissions;
      permissionRequest.isCustomRole = true;
    }
    next();
  } catch (error) {
    req.log.error({ err: error }, "Custom role permission lookup failed");
    res.status(503).json({ error: "Permissions are temporarily unavailable." });
  }
});

app.use("/api", router);

// Canonical sitemap for crawlers. Registered before static + SPA fallback
// so GET /sitemap.xml returns XML instead of index.html. The same handler
// also serves GET /api/sitemap.xml via routes/index.ts.
app.get("/sitemap.xml", sitemapHandler);

// Serve the production frontend build from the same origin so the
// coordinator app can use relative `/api` URLs and cookie sessions.
// The bundle is built to artifacts/robotics-interview-dashboard/dist/public.
// `globalThis.__dirname` is injected by build.mjs; fall back to the
// working directory (repo root in production, api-server dir in dev).
function resolvePublicDir(): string | null {
  const serverDir =
    (globalThis as { __dirname?: string }).__dirname ?? process.cwd();
  const candidates = [
    process.env["FRONTEND_DIST_DIR"],
    path.resolve(
      serverDir,
      "../../robotics-interview-dashboard/dist/public",
    ),
    path.resolve(
      process.cwd(),
      "artifacts/robotics-interview-dashboard/dist/public",
    ),
  ].filter((dir): dir is string => Boolean(dir));
  for (const dir of candidates) {
    if (existsSync(dir) && existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

const publicDir = resolvePublicDir();
if (publicDir) {
  logger.info({ publicDir }, "Serving frontend build");
  app.use(express.static(publicDir, { index: false }));
  // SPA fallback for client-side routes. API routes are mounted above,
  // so only non-API paths reach here.
  app.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.sendFile(path.join(publicDir, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else {
  logger.warn("Frontend build not found; serving API only");
  // The API artifact's development workflow may probe the service root even
  // though application routes live under /api. Keep that probe healthy without
  // shadowing the production frontend route when a frontend build is present.
  app.get("/", (_req, res) => {
    res.json({ status: "ok" });
  });
}

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }
  if (isDatabaseConnectionError(error)) {
    req.log.warn({ err: error }, "Database connection unavailable; request can be retried");
    res.status(503).json({ error: "The database is temporarily unavailable. Please try again." });
    return;
  }
  req.log.error({ err: error }, "Unhandled request error");
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

export default app;
