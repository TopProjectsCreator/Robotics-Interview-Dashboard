import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { eq, lt } from "drizzle-orm";
import { db, DEFAULT_TEAM_ID, interviewerAccountsTable, revokedSessionsTable, runWithInstance, type DbInstance } from "@workspace/db";
import { userCanSeeWorkspace, type WorkspaceKey } from "../lib/workspaceVisibility";
import { readWorkspaceVisibility } from "../lib/workspaceAccess";
import { ADMIN_SESSION_TTL_MS, isAdminSessionExpired } from "../lib/adminSessionPolicy";

const SESSION_COOKIE = "robotics_admin_session";

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
    expiresAt: new Date(Date.now() + ADMIN_SESSION_TTL_MS),
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

export function createInterviewerSession(interviewerId: string, instance: DbInstance = "primary"): string {
  // Secondary-instance accounts carry a trailing "s" segment (covered by the
  // digest), so every later request routes to the right database with zero
  // extra lookups. Primary tokens keep the exact legacy 4-segment shape.
  const payload = instance === "secondary"
    ? `${Date.now()}.${randomBytes(24).toString("hex")}.${interviewerId}.s`
    : `${Date.now()}.${randomBytes(24).toString("hex")}.${interviewerId}`;
  return `${payload}.${sessionDigest(payload)}`;
}

function sessionParts(value: unknown): string[] | null {
  if (typeof value !== "string") return null;
  const parts = value.split(".");
  if (parts.length !== 4 && parts.length !== 5) return null;
  return parts;
}

export function isValidAdminSession(value: unknown): boolean {
  const parts = sessionParts(value);
  if (!parts) return false;
  let timestamp: string;
  let nonce: string;
  let interviewerId: string;
  let digest: string;
  let payload: string;
  if (parts.length === 5) {
    if (parts[3] !== "s") return false;
    [timestamp, nonce, interviewerId, , digest] = parts;
    payload = `${timestamp}.${nonce}.${interviewerId}.s`;
  } else {
    [timestamp, nonce, interviewerId, digest] = parts;
    payload = `${timestamp}.${nonce}.${interviewerId}`;
  }
  const createdAt = Number(timestamp);
  if (isAdminSessionExpired(createdAt)) return false;
  if (!nonce || !interviewerId || !digest) return false;
  const expected = sessionDigest(payload);
  const actualBuffer = Buffer.from(digest);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

/** Database instance for a session token. Legacy 4-segment tokens: primary. */
export function instanceFromSession(value: unknown): DbInstance {
  const parts = sessionParts(value);
  if (parts?.length === 5 && parts[3] === "s" && isValidAdminSession(value)) return "secondary";
  return "primary";
}

export function interviewerIdFromSession(value: unknown): string | undefined {
  if (!isValidAdminSession(value)) return undefined;
  const parts = (value as string).split(".");
  return parts.length === 4 || parts.length === 5 ? parts[2] : undefined;
}

export function authenticatedInterviewerId(req: Request): string | undefined {
  return interviewerIdFromSession(requestAdminSession(req));
}

/**
 * Team id for the signed-in account. Falls back to the default team when the
 * account is missing (pre-migration) or has a legacy NULL team_id, so the
 * current team's data stays reachable and is never lost.
 */
export async function requestTeamId(req: Request): Promise<string> {
  const { DEFAULT_TEAM_ID } = await import("@workspace/db");
  const interviewerId = authenticatedInterviewerId(req);
  if (!interviewerId) return DEFAULT_TEAM_ID;
  try {
    const { db, interviewerAccountsTable } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    const [account] = await db.select({ teamId: interviewerAccountsTable.teamId })
      .from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.id, interviewerId))
      .limit(1);
    return account?.teamId?.trim() ? account.teamId : DEFAULT_TEAM_ID;
  } catch {
    return DEFAULT_TEAM_ID;
  }
}

export function requestTeamIdSync(req: Request): string {
  const enriched = req as Request & { teamId?: string };
  return enriched.teamId?.trim() ? enriched.teamId : "default";
}

function bearerSession(req: Request): string | undefined {
  const authorization = req.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return undefined;
  return authorization.slice("Bearer ".length).trim() || undefined;
}

export function requestAdminSession(req: Request): string | undefined {
  const bearer = bearerSession(req);
  if (bearer && isValidAdminSession(bearer)) return bearer;
  // EventSource cannot set an Authorization header, so the SSE client
  // passes the stored session token as ?access_token= (same convention as
  // the whiteboard/document/code WebSocket upgrades). Accept it here so the
  // realtime stream works when cookies are blocked (embedded iframe, etc.).
  const queryToken = (req.query as Record<string, unknown> | undefined)?.["access_token"];
  if (typeof queryToken === "string" && queryToken.trim() && isValidAdminSession(queryToken.trim())) {
    return queryToken.trim();
  }
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
  // Route the whole request to the session's database instance. Primary
  // sessions (including all legacy tokens) behave exactly as before.
  runWithInstance(instanceFromSession(session), () => next());
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

/** True when the signed-in account is flagged as the site owner. */
export async function isSiteOwner(interviewerId: string | undefined): Promise<boolean> {
  if (!interviewerId) return false;
  try {
    const [account] = await db.select({ isSiteOwner: interviewerAccountsTable.isSiteOwner })
      .from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.id, interviewerId))
      .limit(1);
    return account?.isSiteOwner === true;
  } catch {
    return false;
  }
}

/**
 * Site-owner gate (Ishaan Bansal): the cross-team feature-request inbox and
 * site-wide stats. Every signed-in account can FILE a request; only the
 * owner reads all teams' requests and resolves them.
 */
export function requireSiteOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAdmin(req, res, () => {
    const interviewerId = (req as Request & { interviewerId?: string }).interviewerId;
    isSiteOwner(interviewerId).then((owner) => {
      if (!owner) {
        res.status(403).json({ error: "Site owner only" });
        return;
      }
      next();
    }).catch((error) => {
      req.log.error({ err: error }, "Site owner check failed");
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
          res.status(403).json({ error: "Admins only" });
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
 * Inbox configuration is limited to team Admins. Keep accepting the legacy
 * stored value while also recognizing accounts stored with the product label.
 */
export function requireInboxAdmin(
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
        if (account?.role !== "admin" && account?.role !== "coordinator") {
          res.status(403).json({ error: "Admins only" });
          return;
        }
        next();
      })
      .catch((error) => {
        req.log.error({ err: error }, "Team inbox admin role check failed");
        res.status(503).json({ error: "Authentication unavailable" });
      });
  });
}

/**
 * Restricts the CAD backup-storage status to Wolverines coordinators. Both
 * role and team are read from the account identified by the signed session;
 * request parameters and client-selected identity are never trusted here.
 */
export function requireWolverinesCoordinator(
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
    db.select({
      role: interviewerAccountsTable.role,
      teamId: interviewerAccountsTable.teamId,
    })
      .from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.id, interviewerId))
      .limit(1)
      .then(([account]) => {
        const teamId = account?.teamId?.trim() || DEFAULT_TEAM_ID;
        if (account?.role !== "coordinator" || teamId !== DEFAULT_TEAM_ID) {
          res.status(403).json({ error: "Wolverines coordinators only" });
          return;
        }
        next();
      })
      .catch((error) => {
        req.log.error({ err: error }, "CAD storage status access check failed");
        res.status(503).json({ error: "Authentication unavailable" });
      });
  });
}

/**
 * Gates a route on the per-user workspace access settings. Used by
 * workspaces such as CAD/Code so that opening one up to another person is a
 * settings change rather than a redeploy. Coordinators always pass.
 */
export function requireWorkspaceAccess(
  workspace: WorkspaceKey,
  message = "This workspace is not available for your account",
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
          readWorkspaceVisibility(await requestTeamId(req)),
          db
            .select({ role: interviewerAccountsTable.role })
            .from(interviewerAccountsTable)
            .where(eq(interviewerAccountsTable.id, interviewerId))
            .limit(1),
        ]);
        if (!userCanSeeWorkspace(visibility, interviewerId, account?.role, workspace)) {
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
 * Grants access when the caller's account can open `workspace`, and always to
 * coordinators. Used for capabilities that predate the configurable workspaces
 * and are shared by several of them, so locking one workspace must never take
 * a coordinator's existing features away with it.
 */
export function requireWorkspaceAccessOrCoordinator(
  workspace: WorkspaceKey,
  message = "This workspace is not available for your account",
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
          readWorkspaceVisibility(await requestTeamId(req)),
        ]);
        const role = account?.role;
        if (userCanSeeWorkspace(visibility, interviewerId, role, workspace)) {
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
    maxAge: ADMIN_SESSION_TTL_MS,
    path: "/",
  });
}

export function clearAdminCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}