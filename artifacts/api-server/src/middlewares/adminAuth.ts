import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq, lt } from "drizzle-orm";
import { db, interviewerAccountsTable, revokedSessionsTable } from "@workspace/db";
import { roleCanSeeWorkspace, type WorkspaceKey } from "../lib/workspaceVisibility";
import { readWorkspaceVisibility } from "../lib/workspaceAccess";

const SESSION_COOKIE = "robotics_admin_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return secret ?? "development-session-secret";
}

function sessionDigest(payload: string): string {
  return createHmac("sha256", sessionSecret()).update(payload).digest("hex");
}

function sessionTokenHash(session: string): string {
  return createHash("sha256").update(session).digest("hex");
}

export async function revokeAdminSession(session: string | undefined): Promise<void> {
  if (typeof session !== "string" || !session) return;
  await db.insert(revokedSessionsTable).values({
    tokenHash: sessionTokenHash(session),
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  }).onConflictDoNothing();
  await db.delete(revokedSessionsTable).where(lt(revokedSessionsTable.expiresAt, new Date()));
}

export async function isRevokedAdminSession(session: string | undefined): Promise<boolean> {
  if (typeof session !== "string" || !session) return false;
  const [row] = await db.select({ tokenHash: revokedSessionsTable.tokenHash })
    .from(revokedSessionsTable)
    .where(eq(revokedSessionsTable.tokenHash, sessionTokenHash(session)));
  return !!row;
}

export function createAdminSession(): string {
  return createInterviewerSession("legacy");
}

export function createInterviewerSession(interviewerId: string): string {
  const payload = `${Date.now()}.${randomBytes(24).toString("hex")}.${interviewerId}`;
  return `${payload}.${sessionDigest(payload)}`;
}

export function isValidAdminSession(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  const [timestamp, nonce, interviewerId, digest] = parts;
  const createdAt = Number(timestamp);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > SESSION_TTL_MS) {
    return false;
  }
  if (createdAt > Date.now() + 60000) {
    return false;
  }
  if (!nonce || !interviewerId || !digest) return false;
  const expected = sessionDigest(`${timestamp}.${nonce}.${interviewerId}`);
  const actualBuffer = Buffer.from(digest);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function interviewerIdFromSession(value: unknown): string | undefined {
  if (!isValidAdminSession(value)) return undefined;
  const parts = (value as string).split(".");
  return parts.length === 4 ? parts[2] : undefined;
}

export function authenticatedInterviewerId(req: Request): string | undefined {
  return interviewerIdFromSession(requestAdminSession(req));
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
  const enriched = req as Request & {
    isAuthenticated?: () => boolean;
    interviewerId?: string;
  };
  enriched.isAuthenticated = () => isValidAdminSession(session);
  enriched.interviewerId = interviewerIdFromSession(session);
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
  isRevokedAdminSession(session).then((revoked) => {
    if (revoked) {
      res.status(401).json({ error: "Session revoked" });
      return;
    }
    const interviewerId = interviewerIdFromSession(session);
    if (!interviewerId) {
      res.status(401).json({ error: "Interviewer session is invalid" });
      return;
    }
    db.select({ passwordHash: interviewerAccountsTable.passwordHash })
      .from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.id, interviewerId))
      .limit(1)
      .then(([account]) => {
        if (!account?.passwordHash) {
          res.status(401).json({ error: "Password setup required" });
          return;
        }
        (req as Request & { interviewerId?: string }).interviewerId = interviewerId;
        next();
      })
      .catch((error) => {
        req.log.error({ err: error }, "Interviewer account check failed");
        res.status(503).json({ error: "Authentication unavailable" });
      });
  }).catch((error) => {
    req.log.error({ err: error }, "Session revocation check failed");
    res.status(503).json({ error: "Authentication unavailable" });
  });
}

// Staff level: admins (coordinators) and treasurers. Treasurers get the
// read-only applicant roster on top of what any signed-in account can do.
const STAFF_ROLES = new Set(["coordinator", "treasurer"]);

export function requireStaff(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAdmin(req, res, () => {
    const interviewerId = (req as Request & { interviewerId?: string }).interviewerId;
    if (!interviewerId) {
      res.status(401).json({ error: "Interviewer session is invalid" });
      return;
    }
    db.select({ role: interviewerAccountsTable.role })
      .from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.id, interviewerId))
      .limit(1)
      .then(([account]) => {
        if (!account?.role || !STAFF_ROLES.has(account.role)) {
          res.status(403).json({ error: "Not available for your role" });
          return;
        }
        next();
      })
      .catch((error) => {
        req.log.error({ err: error }, "Staff role check failed");
        res.status(503).json({ error: "Authentication unavailable" });
      });
  });
}

export function requireCoordinator(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAdmin(req, res, () => {
    const interviewerId = (req as Request & { interviewerId?: string }).interviewerId;
    if (!interviewerId) {
      res.status(401).json({ error: "Interviewer session is invalid" });
      return;
    }
    db.select({ role: interviewerAccountsTable.role })
      .from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.id, interviewerId))
      .limit(1)
      .then(([account]) => {
        if (account?.role !== "coordinator") {
          res.status(403).json({ error: "Coordinators only" });
          return;
        }
        next();
      })
      .catch((error) => {
        req.log.error({ err: error }, "Coordinator role check failed");
        res.status(503).json({ error: "Authentication unavailable" });
      });
  });
}

/**
 * Gates a route on the admin-configured workspace visibility settings. Used by
 * the CAD workspace so that opening it up to more roles is a settings change
 * rather than a redeploy. Defaults keep CAD coordinator-only.
 */
export function requireWorkspaceAccess(
  workspace: WorkspaceKey,
  message = "This workspace is not available for your role",
) {
  return function requireWorkspace(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    requireAdmin(req, res, () => {
      const interviewerId = (req as Request & { interviewerId?: string }).interviewerId;
      if (!interviewerId) {
        res.status(401).json({ error: "Interviewer session is invalid" });
        return;
      }
      void (async () => {
        const [visibility, [account]] = await Promise.all([
          readWorkspaceVisibility(),
          db
            .select({ role: interviewerAccountsTable.role })
            .from(interviewerAccountsTable)
            .where(eq(interviewerAccountsTable.id, interviewerId))
            .limit(1),
        ]);
        if (!roleCanSeeWorkspace(visibility, account?.role, workspace)) {
          res.status(403).json({ error: message });
          return;
        }
        next();
      })().catch((error: unknown) => {
        req.log.error({ err: error }, "Workspace access check failed");
        res.status(503).json({ error: "Authentication unavailable" });
      });
    });
  };
}

/**
 * Grants access when the caller's role can open `workspace`, and always to
 * coordinators. Used for capabilities that predate the configurable workspaces
 * and are shared by several of them, so locking one workspace must never take
 * a coordinator's existing features away with it.
 */
export function requireWorkspaceAccessOrCoordinator(
  workspace: WorkspaceKey,
  message = "This workspace is not available for your role",
) {
  return function requireWorkspaceOrCoordinator(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    requireAdmin(req, res, () => {
      const interviewerId = (req as Request & { interviewerId?: string }).interviewerId;
      if (!interviewerId) {
        res.status(401).json({ error: "Interviewer session is invalid" });
        return;
      }
      void (async () => {
        const [[account], visibility] = await Promise.all([
          db
            .select({ role: interviewerAccountsTable.role })
            .from(interviewerAccountsTable)
            .where(eq(interviewerAccountsTable.id, interviewerId))
            .limit(1),
          readWorkspaceVisibility(),
        ]);
        const role = account?.role;
        if (role === "coordinator" || roleCanSeeWorkspace(visibility, role, workspace)) {
          next();
          return;
        }
        res.status(403).json({ error: message });
      })().catch((error: unknown) => {
        req.log.error({ err: error }, "Workspace access check failed");
        res.status(503).json({ error: "Authentication unavailable" });
      });
    });
  };
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