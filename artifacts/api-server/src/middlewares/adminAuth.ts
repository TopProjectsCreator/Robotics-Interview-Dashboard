import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const SESSION_COOKIE = "robotics_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sessionDigest(payload: string): string {
  const secret = process.env.SESSION_SECRET ?? "development-session-secret";
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createAdminSession(): string {
  const payload = `${Date.now()}.${randomBytes(24).toString("hex")}`;
  return `${payload}.${sessionDigest(payload)}`;
}

export function isValidAdminSession(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [timestamp, nonce, digest] = parts;
  const createdAt = Number(timestamp);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > SESSION_TTL_MS) {
    return false;
  }
  if (!nonce || !digest) return false;
  const expected = sessionDigest(`${timestamp}.${nonce}`);
  const actualBuffer = Buffer.from(digest);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function bearerSession(req: Request): string | undefined {
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

export function requestAdminSession(req: Request): string | undefined {
  const bearer = bearerSession(req);
  if (bearer && isValidAdminSession(bearer)) return bearer;
  return req.cookies?.[SESSION_COOKIE];
}

export function attachAdminSession(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const session = requestAdminSession(req);
  (req as Request & { isAuthenticated?: () => boolean }).isAuthenticated =
    () => isValidAdminSession(session);
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const session = requestAdminSession(req);
  if (!isValidAdminSession(session)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

export function setAdminCookie(res: Response, session: string): void {
  const request = res.req;
  const forwardedProto = request.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isSecureRequest =
    request.secure ||
    forwardedProto === "https" ||
    process.env.NODE_ENV === "production";

  res.cookie(SESSION_COOKIE, session, {
    httpOnly: true,
    // SameSite=None is required when the dashboard is embedded by a
    // different site. Keep local HTTP development compatible with browsers
    // that reject SameSite=None cookies without Secure.
    sameSite: isSecureRequest ? "none" : "lax",
    secure: isSecureRequest,
    maxAge: SESSION_TTL_MS,
    path: "/",
  });
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}