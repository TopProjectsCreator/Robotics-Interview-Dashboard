import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
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
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
