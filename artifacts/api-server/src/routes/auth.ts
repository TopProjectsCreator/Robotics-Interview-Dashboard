import { randomBytes, scryptSync, createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, interviewerAccountsTable } from "@workspace/db";
import {
  CreateInterviewerBody,
  CreateInterviewerResponse,
  GetSessionResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  ListInterviewersResponse,
  SetupInterviewerPasswordBody,
  SetupInterviewerPasswordResponse,
} from "@workspace/api-zod";
import {
  clearAdminCookie,
  createInterviewerSession,
  interviewerIdFromSession,
  isValidAdminSession,
  requestAdminSession,
  revokeAdminSession,
  setAdminCookie,
} from "../middlewares/adminAuth";
import { deletePresenceHeartbeat } from "./presence";
import { accountById, normalizeInterviewerName, syncInterviewerAccounts, updateQueueLabels } from "../lib/interviewerAccounts";
import { getInterviewSettings } from "../lib/roboticsData";

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
  if (!entry || entry.resetAt <= now) loginFailures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  else entry.count += 1;
}

function passwordsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return a.length === b.length && timingSafeEqual(a, b);
}

function eventPasswordMatches(value: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  return Boolean(expected && passwordsMatch(value.trim(), expected.trim()));
}

function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`;
}

function passwordHashMatches(password: string, encoded: string | null): boolean {
  if (!encoded) return false;
  const [saltHex, hashHex] = encoded.split(":");
  if (!saltHex || !hashHex) return false;
  try {
    const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
    const expected = Buffer.from(hashHex, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

function publicAccount(account: { id: string; displayName: string; passwordHash: string | null }) {
  return { id: account.id, displayName: account.displayName, hasPassword: Boolean(account.passwordHash) };
}

router.get("/auth/interviewers", async (_req, res): Promise<void> => {
  const accounts = await syncInterviewerAccounts(await getInterviewSettings());
  res.json(ListInterviewersResponse.parse({ items: accounts.map(publicAccount) }));
});

router.post("/auth/interviewers", async (req, res): Promise<void> => {
  const parsed = CreateInterviewerBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.displayName.trim()) {
    res.status(400).json({ error: "Name and password are required." });
    return;
  }
  if (!eventPasswordMatches(parsed.data.eventPassword)) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const displayName = parsed.data.displayName.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeInterviewerName(displayName);
  const existing = await db.select({ id: interviewerAccountsTable.id })
    .from(interviewerAccountsTable).where(eq(interviewerAccountsTable.normalizedName, normalizedName)).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "That interviewer already exists." });
    return;
  }
  const [account] = await db.insert(interviewerAccountsTable).values({
    id: randomBytes(16).toString("hex"),
    displayName,
    normalizedName,
    passwordHash: hashPassword(parsed.data.password),
  }).returning();
  if (!account) {
    res.status(500).json({ error: "Could not create interviewer." });
    return;
  }
  await updateQueueLabels([...(await getInterviewSettings()), account.displayName]);
  res.status(201).json(CreateInterviewerResponse.parse(publicAccount(account)));
});

router.post("/auth/interviewers/setup", async (req, res): Promise<void> => {
  const parsed = SetupInterviewerPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Interviewer and password are required." });
    return;
  }
  if (!eventPasswordMatches(parsed.data.eventPassword)) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const account = await accountById(parsed.data.interviewerId);
  if (!account) {
    res.status(404).json({ error: "Interviewer not found." });
    return;
  }
  if (account.passwordHash) {
    res.status(409).json({ error: "That interviewer already has a password." });
    return;
  }
  const [updated] = await db.update(interviewerAccountsTable)
    .set({ passwordHash: hashPassword(parsed.data.password), updatedAt: new Date() })
    .where(eq(interviewerAccountsTable.id, account.id)).returning();
  if (!updated) {
    res.status(500).json({ error: "Could not set interviewer password." });
    return;
  }
  res.json(SetupInterviewerPasswordResponse.parse(publicAccount(updated)));
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Event passcode, interviewer, and password are required" });
    return;
  }
  if (!eventPasswordMatches(parsed.data.eventPassword)) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const ip = req.ip ?? "unknown";
  if (!loginAllowed(ip)) {
    res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
    return;
  }
  const account = await accountById(parsed.data.interviewerId);
  if (!account || !passwordHashMatches(parsed.data.password, account.passwordHash)) {
    recordLoginFailure(ip);
    res.status(401).json({ error: "Incorrect interviewer or password" });
    return;
  }
  loginFailures.delete(ip);
  const session = createInterviewerSession(account.id);
  setAdminCookie(res, session);
  res.json(LoginResponse.parse({ authenticated: true, label: account.displayName, interviewerId: account.id, token: session }));
});

router.get("/auth/session", async (req, res): Promise<void> => {
  const session = requestAdminSession(req);
  const authenticated = isValidAdminSession(session);
  const interviewerId = interviewerIdFromSession(session);
  if (!authenticated || !interviewerId) {
    res.json(GetSessionResponse.parse({ authenticated: false }));
    return;
  }
  const account = await accountById(interviewerId);
  if (!account?.passwordHash) {
    res.json(GetSessionResponse.parse({ authenticated: false }));
    return;
  }
  res.json(GetSessionResponse.parse({ authenticated: true, label: account.displayName, interviewerId: account.id }));
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