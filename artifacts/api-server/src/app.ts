import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";
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
app.use(cookieParser());
app.use(attachAdminSession);
app.use("/api/queue/custom-emojis", express.json({ limit: "1mb" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

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
