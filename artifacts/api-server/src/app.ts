import express, { type Express, type RequestHandler } from "express";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { sitemapHandler } from "./routes/sitemap";
import { attachAdminSession } from "./middlewares/adminAuth";

const app: Express = express();

// Trust the first proxy hop (Replit/Codespaces) so req.ip reflects the real
// client for presence tracking and login rate limiting.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
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
// The dashboard can be hosted inside a coordinator's iframe. Reflect the
// embedding origin so browser requests are allowed to include the session
// cookie, while keeping the API usable from the same-origin preview too.
// In production, set ALLOWED_ORIGINS (comma-separated) to restrict which
// sites may call the API — open reflection invites cross-site request
// forgery against coordinator sessions.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : true,
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
}

export default app;
