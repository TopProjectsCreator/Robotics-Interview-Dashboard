import { randomBytes, scryptSync, createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, interviewerAccountsTable, interviewChatMessagesTable, interviewQueueTable } from "@workspace/db";
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
  UpdateInterviewerPasswordBody,
  UpdateInterviewerPasswordParams,
  UpdateInterviewerPasswordResponse,
  ResetAllInterviewerPasswordsResponse,
  UpdateInterviewerRoleResponse,
  UpdateInterviewerNameResponse,
  ResetAllInterviewerPasswordsBody,
  VerifyEventPasscodeBody,
  VerifyEventPasscodeResponse,
} from "@workspace/api-zod";
import {
  clearAdminCookie,
  createInterviewerSession,
  interviewerIdFromSession,
  isValidAdminSession,
  requestAdminSession,
  requireAdmin,
  requireCoordinator,
  revokeAdminSession,
  setAdminCookie,
} from "../middlewares/adminAuth";
import { deletePresenceHeartbeat } from "./presence";
import { accountById, normalizeInterviewerName, syncInterviewerAccounts, updateQueueLabels } from "../lib/interviewerAccounts";
import { assessPasswordExposure } from "../lib/passwordExposurePolicy";
import { getInterviewSettings } from "../lib/roboticsData";
import { getPwnedPasswordCount } from "../lib/pwnedPasswords";

const router: IRouter = Router();
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();
const eventPasscodeFailures = new Map<string, { count: number; resetAt: number }>();

async function rejectUnsafePassword(
  req: Request,
  res: Response,
  password: string,
  confirmLowExposure = false,
): Promise<boolean> {
  let count: number;
  try {
    count = await getPwnedPasswordCount(password);
  } catch {
    req.log.warn("Pwned Passwords check failed; rejecting password change");
    res.status(503).json({
      error: "Password safety check is temporarily unavailable. Your password was not changed; try again shortly.",
      code: "PASSWORD_CHECK_UNAVAILABLE",
    });
    return true;
  }

  const exposure = assessPasswordExposure(count, confirmLowExposure);
  if (exposure.kind === "blocked") {
    res.status(422).json({
      error: `This password appears in known breach data ${count} times. Choose a different password.`,
      code: "PASSWORD_EXPOSURE_BLOCKED",
      count,
    });
    return true;
  }

  if (exposure.kind === "warning") {
    res.status(409).json({
      error: `This password appears in known breach data ${count} ${count === 1 ? "time" : "times"}. Confirm before using it.`,
      code: "PASSWORD_EXPOSURE_WARNING",
      count,
    });
    return true;
  }

  return false;
}

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

function eventPasscodeAllowed(ip: string): boolean {
  const now = Date.now();
  const entry = eventPasscodeFailures.get(ip);
  if (!entry || entry.resetAt <= now) {
    eventPasscodeFailures.delete(ip);
    return true;
  }
  return entry.count < LOGIN_MAX_FAILURES;
}

function recordEventPasscodeFailure(ip: string): void {
  const now = Date.now();
  const entry = eventPasscodeFailures.get(ip);
  if (!entry || entry.resetAt <= now) eventPasscodeFailures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
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

function publicAccount(account: { id: string; displayName: string; passwordHash: string | null; role: string }) {
  return {
    id: account.id,
    displayName: account.displayName,
    hasPassword: Boolean(account.passwordHash),
    role: account.role,
  };
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
  if (await rejectUnsafePassword(req, res, parsed.data.password, parsed.data.confirmLowExposure)) return;
  const [account] = await db.insert(interviewerAccountsTable).values({
    id: randomBytes(16).toString("hex"),
    displayName,
    normalizedName,
    passwordHash: hashPassword(parsed.data.password),
    role: "interviewer",
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
  if (await rejectUnsafePassword(req, res, parsed.data.password, parsed.data.confirmLowExposure)) return;
  const [updated] = await db.update(interviewerAccountsTable)
    .set({ passwordHash: hashPassword(parsed.data.password), updatedAt: new Date() })
    .where(eq(interviewerAccountsTable.id, account.id)).returning();
  if (!updated) {
    res.status(500).json({ error: "Could not set interviewer password." });
    return;
  }
  res.json(SetupInterviewerPasswordResponse.parse(publicAccount(updated)));
});

router.patch("/auth/interviewers/:interviewerId/password", requireCoordinator, async (req, res): Promise<void> => {
  const params = UpdateInterviewerPasswordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Interviewer is required." });
    return;
  }
  const parsed = UpdateInterviewerPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Event passcode and a password are required. Use null to reset the password." });
    return;
  }
  if (!eventPasswordMatches(parsed.data.eventPassword)) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const account = await accountById(params.data.interviewerId);
  if (!account) {
    res.status(404).json({ error: "Interviewer not found." });
    return;
  }
  if (
    parsed.data.password !== null &&
    await rejectUnsafePassword(req, res, parsed.data.password, parsed.data.confirmLowExposure)
  ) return;
  const [updated] = await db.update(interviewerAccountsTable)
    .set({ passwordHash: parsed.data.password === null ? null : hashPassword(parsed.data.password), updatedAt: new Date() })
    .where(eq(interviewerAccountsTable.id, account.id))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Could not update interviewer password." });
    return;
  }
  res.json(UpdateInterviewerPasswordResponse.parse(publicAccount(updated)));
});

router.post("/auth/interviewers/passwords/reset-all", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = ResetAllInterviewerPasswordsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The event passcode is required." });
    return;
  }
  if (!eventPasswordMatches(parsed.data.eventPassword)) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  await db.update(interviewerAccountsTable).set({ passwordHash: null, updatedAt: new Date() });
  res.json(ResetAllInterviewerPasswordsResponse.parse({ message: "All interviewer passwords were reset. Each interviewer must set up a new password." }));
});

router.delete("/auth/interviewers/:interviewerId", requireCoordinator, async (req, res): Promise<void> => {
  const interviewerId = typeof req.params.interviewerId === "string" ? req.params.interviewerId : "";
  if (!interviewerId) {
    res.status(400).json({ error: "Interviewer id required" });
    return;
  }
  const account = await accountById(interviewerId);
  if (!account) {
    res.status(404).json({ error: "Interviewer not found." });
    return;
  }
  await db.delete(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, interviewerId));
  const labels = await getInterviewSettings();
  await updateQueueLabels(labels.filter((label) => normalizeInterviewerName(label) !== account.normalizedName));
  res.status(204).end();
});

router.patch("/auth/interviewers/:interviewerId/role", requireCoordinator, async (req, res): Promise<void> => {
  const interviewerId = typeof req.params.interviewerId === "string" ? req.params.interviewerId : "";
  const role = (req.body as Record<string, unknown> | undefined)?.role;
  if (!interviewerId || (role !== "coordinator" && role !== "interviewer")) {
    res.status(400).json({ error: "Interviewer id and a valid role are required" });
    return;
  }
  const selfId = (req as Request & { interviewerId?: string }).interviewerId;
  if (selfId === interviewerId) {
    res.status(400).json({ error: "You cannot change your own role" });
    return;
  }
  const account = await accountById(interviewerId);
  if (!account) {
    res.status(404).json({ error: "Interviewer not found." });
    return;
  }
  const [updated] = await db.update(interviewerAccountsTable).set({ role, updatedAt: new Date() }).where(eq(interviewerAccountsTable.id, interviewerId)).returning();
  if (!updated) {
    res.status(500).json({ error: "Could not update role." });
    return;
  }
  res.json(UpdateInterviewerRoleResponse.parse(publicAccount(updated)));
});

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "23505";
}

/** Interviewer label separator used to build direct-message thread keys. */
const PEER_SEPARATOR = "\u001f";

/**
 * Renames an interviewer everywhere their name is stored: the account row,
 * the queue labels that drive interviewer selection, chat authorship, and the
 * direct-message thread keys (which embed both participant names, so leaving
 * them stale would orphan existing DM history).
 */
async function renameInterviewerReferences(previousName: string, nextName: string): Promise<void> {
  const [queue] = await db.select().from(interviewQueueTable).limit(1);
  try {
    const labels = JSON.parse(queue?.interviewerLabels ?? "[]") as unknown;
    if (Array.isArray(labels)) {
      const renamed = labels.map((label) =>
        typeof label === "string" && label.trim().toLowerCase() === previousName.toLowerCase()
          ? nextName
          : label,
      );
      await db
        .update(interviewQueueTable)
        .set({ interviewerLabels: JSON.stringify(renamed), updatedAt: new Date() })
        .where(eq(interviewQueueTable.id, queue?.id ?? 1));
    }
  } catch {
    // Leave labels untouched if the stored value is unreadable.
  }

  await db
    .update(interviewChatMessagesTable)
    .set({ author: nextName })
    .where(eq(interviewChatMessagesTable.author, previousName));

  // Thread keys are "<label><SEP><label>" with the pair sorted; replace only
  // the segment that matches this interviewer.
  const rows = await db
    .select({ id: interviewChatMessagesTable.id, peer: interviewChatMessagesTable.conversationPeer })
    .from(interviewChatMessagesTable);
  for (const row of rows) {
    if (!row.peer) continue;
    const parts = row.peer.split(PEER_SEPARATOR);
    if (!parts.some((part) => part.trim().toLowerCase() === previousName.toLowerCase())) continue;
    const swapped = parts.map((part) =>
      part.trim().toLowerCase() === previousName.toLowerCase() ? nextName : part,
    );
    const key = [...swapped]
      .sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()) || a.localeCompare(b))
      .join(PEER_SEPARATOR);
    await db
      .update(interviewChatMessagesTable)
      .set({ conversationPeer: key })
      .where(eq(interviewChatMessagesTable.id, row.id));
  }
}

router.patch("/auth/interviewers/:interviewerId/name", requireCoordinator, async (req, res): Promise<void> => {
  const interviewerId = typeof req.params.interviewerId === "string" ? req.params.interviewerId : "";
  const displayName = typeof (req.body as Record<string, unknown> | undefined)?.displayName === "string"
    ? String((req.body as Record<string, unknown>).displayName).trim().replace(/\s+/g, " ")
    : "";
  if (!interviewerId || !displayName) {
    res.status(400).json({ error: "Enter a name for this person." });
    return;
  }
  if (displayName.length > 80) {
    res.status(400).json({ error: "Names are limited to 80 characters." });
    return;
  }
  const account = await accountById(interviewerId);
  if (!account) {
    res.status(404).json({ error: "Interviewer not found." });
    return;
  }
  const normalizedName = normalizeInterviewerName(displayName);
  const previousName = account.displayName;
  if (normalizedName === account.normalizedName) {
    res.json(UpdateInterviewerNameResponse.parse(publicAccount(account)));
    return;
  }
  const clash = await db
    .select({ id: interviewerAccountsTable.id })
    .from(interviewerAccountsTable)
    .where(eq(interviewerAccountsTable.normalizedName, normalizedName))
    .limit(1);
  if (clash.length) {
    res.status(409).json({ error: "Someone already uses that name." });
    return;
  }
  try {
    const [updated] = await db
      .update(interviewerAccountsTable)
      .set({ displayName, normalizedName, updatedAt: new Date() })
      .where(eq(interviewerAccountsTable.id, interviewerId))
      .returning();
    if (!updated) {
      res.status(500).json({ error: "Could not rename this person." });
      return;
    }
    await renameInterviewerReferences(previousName, displayName);
    res.json(UpdateInterviewerNameResponse.parse(publicAccount(updated)));
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "Someone already uses that name." });
      return;
    }
    req.log.error({ err: error, interviewerId }, "Interviewer rename failed");
    res.status(500).json({ error: "Could not rename this person." });
  }
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

router.post("/auth/verify-event-passcode", (req, res): void => {
  const parsed = VerifyEventPasscodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "The team access code is required." });
    return;
  }
  const ip = req.ip ?? "unknown";
  if (!eventPasscodeAllowed(ip)) {
    res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
    return;
  }
  if (!eventPasswordMatches(parsed.data.eventPassword)) {
    recordEventPasscodeFailure(ip);
    res.status(401).json({ error: "The team access code is incorrect." });
    return;
  }
  eventPasscodeFailures.delete(ip);
  res.json(VerifyEventPasscodeResponse.parse({ message: "Team access code verified." }));
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
  res.json(GetSessionResponse.parse({ authenticated: true, label: account.displayName, interviewerId: account.id, role: account.role }));
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