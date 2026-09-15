import { Router, type IRouter } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  GetSessionResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
} from "@workspace/api-zod";
import {
  clearAdminCookie,
  createAdminSession,
  isValidAdminSession,
  requestAdminSession,
  revokeAdminSession,
  setAdminCookie,
} from "../middlewares/adminAuth";
import { deletePresenceHeartbeat } from "./presence";

const router: IRouter = Router();

const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();

function loginAllowed(ip: string): boolean {
  const now = Date.now();
  const entry = loginFailures.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginFailures.delete(ip);
    return true;
  }
  return entry.count < LOGIN_MAX_FAILURES;
}

function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginFailures.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginFailures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function passwordsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

router.post("/auth/login", (req, res): void => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Password is required" });
    return;
  }
  const ip = req.ip ?? "unknown";
  if (!loginAllowed(ip)) {
    res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
    return;
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !passwordsMatch(parsed.data.password, expected)) {
    recordLoginFailure(ip);
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  loginFailures.delete(ip);
  const session = createAdminSession();
  setAdminCookie(res, session);
  res.json(LoginResponse.parse({ authenticated: true, label: "Coordinator", token: session }));
});

router.get("/auth/session", (req, res): void => {
  const session = requestAdminSession(req);
  const authenticated = isValidAdminSession(session);
  res.json(GetSessionResponse.parse({ authenticated, label: authenticated ? "Coordinator" : undefined }));
});

router.post("/auth/logout", (req, res): void => {
  const session = requestAdminSession(req);
  revokeAdminSession(session).catch((error) => {
    req.log.error({ err: error }, "Failed to revoke session on logout");
  });
  deletePresenceHeartbeat(session).catch(() => undefined);
  clearAdminCookie(res);
  res.json(LogoutResponse.parse({ message: "Logged out" }));
});

export default router;