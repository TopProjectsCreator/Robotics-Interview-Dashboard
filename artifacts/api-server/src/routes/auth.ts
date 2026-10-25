import { randomBytes, scryptSync, createHash, timingSafeEqual } from "node:crypto";
import express from "express";
import { Router, type IRouter, type Request, type Response } from "express";
import { and, count, eq, inArray, isNull, or } from "drizzle-orm";
import { db, primaryDb, secondaryDb, secondaryPool, enterInstance, currentInstance, interviewerAccountsTable, interviewChatMessagesTable, interviewQueueTable, teamNameRulesTable, webauthnCredentialsTable, teamsTable, personalNotepadTable, DEFAULT_TEAM_ID, normalizeTeamName, type DbInstance } from "@workspace/db";
import { ensureDefaultTeam, findTeamByCode, hashTeamCode, teamIdForAccount, teamFilter, randomTeamCode, type ResolvedTeam } from "../lib/teams";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import {
  base64urlToBytes,
  credentialIdFromResponse,
  bytesToBase64url,
  clearPasskeyChallenge,
  readPasskeyChallenge,
  setPasskeyChallenge,
  webauthnOrigin,
  webauthnRPID,
} from "../lib/passkey";
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
  RegisterPasskeyBody,
  RegisterPasskeyResponse,
  ListPasskeysResponse,
  GetPasskeyLoginOptionsBody,
  LoginWithPasskeyBody,
  LoginWithPasskeyResponse,
  UpdateInterviewerNameResponse,
  ResetAllInterviewerPasswordsBody,
  VerifyEventPasscodeBody,
  VerifyEventPasscodeResponse,
} from "@workspace/api-zod";
import {
  clearAdminCookie,
  createInterviewerSession,
  interviewerIdFromSession,
  isRevokedAdminSession,
  isValidAdminSession,
  requestAdminSession,
  requireAdmin,
  requireCoordinator,
  requireSiteOwner,
  revokeAdminSession,
  setAdminCookie,
} from "../middlewares/adminAuth";
import { deletePresenceHeartbeat } from "./presence";
import { checkAccountCreationAllowed, validateDisplayName } from "../lib/spamGuard";
import { validateTeamNameRules } from "../lib/nameRules";
import { accountById, normalizeInterviewerName, syncInterviewerAccounts, updateQueueLabels } from "../lib/interviewerAccounts";
import { assessPasswordExposure } from "../lib/passwordExposurePolicy";
import { interviewerRosterAccess } from "../lib/interviewerRosterAccess";
import { getInterviewSettings } from "../lib/roboticsData";
import { getPwnedPasswordCount } from "../lib/pwnedPasswords";
import {
  canFallbackNewTeamToPrimary,
  isTransientDatabaseAvailabilityError,
} from "../lib/databaseAvailability";
import { ObjectStorageService } from "../lib/objectStorage";
import { requestTeamId } from "../middlewares/adminAuth";
import {
  GetTeamBrandingResponse,
  UpdateTeamBrandingBody,
  UploadTeamLogoResponse,
  GetPersonalNotepadResponse,
  UpdatePersonalNotepadBody,
  UpdatePersonalNotepadResponse,
  GetTeamNameRulesResponse,
  UpdateTeamNameRulesBody,
  UpdateTeamNameRulesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

router.get("/auth/name-rules", requireCoordinator, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const [record] = await db.select({ rules: teamNameRulesTable.rules })
    .from(teamNameRulesTable)
    .where(eq(teamNameRulesTable.teamId, teamId))
    .limit(1);
  res.json(GetTeamNameRulesResponse.parse({ rules: record?.rules ?? [] }));
});

router.put("/auth/name-rules", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = UpdateTeamNameRulesBody.safeParse(req.body);
  if (!parsed.success || parsed.data.rules.some((rule) => !rule.text.trim())) {
    res.status(400).json({ error: "Each rule needs text between 1 and 40 characters, with no more than 50 rules." });
    return;
  }
  const teamId = await requestTeamId(req);
  const rules = parsed.data.rules.map((rule) => ({
    matchType: rule.matchType,
    text: rule.text.trim().replace(/\s+/g, " "),
  }));
  const [record] = await db.insert(teamNameRulesTable)
    .values({ teamId, rules })
    .onConflictDoUpdate({
      target: teamNameRulesTable.teamId,
      set: { rules, updatedAt: new Date() },
    })
    .returning({ rules: teamNameRulesTable.rules });
  res.json(UpdateTeamNameRulesResponse.parse({ rules: record?.rules ?? rules }));
});

router.get("/auth/personal-notepad", requireAdmin, async (req, res): Promise<void> => {
  const accountId = interviewerIdFromSession(requestAdminSession(req));
  if (!accountId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const teamId = await requestTeamId(req);
  const [note] = await db.select({
    content: personalNotepadTable.content,
    updatedAt: personalNotepadTable.updatedAt,
  }).from(personalNotepadTable).where(and(
    eq(personalNotepadTable.accountId, accountId),
    eq(personalNotepadTable.teamId, teamId),
  )).limit(1);
  res.json(GetPersonalNotepadResponse.parse({
    content: note?.content ?? "",
    updatedAt: note?.updatedAt.toISOString() ?? null,
  }));
});

router.put("/auth/personal-notepad", requireAdmin, async (req, res): Promise<void> => {
  const accountId = interviewerIdFromSession(requestAdminSession(req));
  if (!accountId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const body = UpdatePersonalNotepadBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Notepad content must be text and no longer than 200,000 characters." });
    return;
  }
  const teamId = await requestTeamId(req);
  const [note] = await db.insert(personalNotepadTable).values({
    accountId,
    teamId,
    content: body.data.content,
  }).onConflictDoUpdate({
    target: personalNotepadTable.accountId,
    set: { teamId, content: body.data.content, updatedAt: new Date() },
  }).returning({
    content: personalNotepadTable.content,
    updatedAt: personalNotepadTable.updatedAt,
  });
  res.json(UpdatePersonalNotepadResponse.parse({
    content: note.content,
    updatedAt: note.updatedAt.toISOString(),
  }));
});
const LOGIN_WINDOW_MS = 60 * 1000;
const LOGIN_MAX_FAILURES = 10;
const loginFailures = new Map<string, { count: number; resetAt: number }>();
const eventPasscodeFailures = new Map<string, { count: number; resetAt: number }>();

// IP-based limits alone are NOT enough here: Render passes a client's
// X-Forwarded-For straight through, so req.ip is whatever the caller claims.
// An attacker can rotate that header for a fresh attempt budget every time.
// These counters are keyed on the SECRET being guessed instead, so they
// hold even when the caller spoofs its address.
const credentialFailures = new Map<string, { count: number; resetAt: number }>();
const CREDENTIAL_WINDOW_MS = 15 * 60 * 1000;
const CREDENTIAL_MAX_FAILURES = 10;

function credentialKey(kind: string, value: string): string {
  return `${kind}:${value.trim().toLowerCase()}`;
}

function credentialAllowed(kind: string, value: string): boolean {
  const entry = credentialFailures.get(credentialKey(kind, value));
  if (!entry || entry.resetAt <= Date.now()) {
    credentialFailures.delete(credentialKey(kind, value));
    return true;
  }
  return entry.count < CREDENTIAL_MAX_FAILURES;
}

function recordCredentialFailure(kind: string, value: string): void {
  const key = credentialKey(kind, value);
  const entry = credentialFailures.get(key);
  if (!entry || entry.resetAt <= Date.now()) {
    credentialFailures.set(key, { count: 1, resetAt: Date.now() + CREDENTIAL_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

function clearCredentialFailures(kind: string, value: string): void {
  credentialFailures.delete(credentialKey(kind, value));
}

router.get("/auth/team-branding", requireAdmin, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const [team] = await db.select({
    logoPath: teamsTable.logoPath,
    primaryColor: teamsTable.primaryColor,
  }).from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  res.json(GetTeamBrandingResponse.parse({
    logoPath: team?.logoPath ?? null,
    primaryColor: team?.primaryColor ?? null,
  }));
});

router.patch("/auth/team-branding", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = UpdateTeamBrandingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const teamId = await requestTeamId(req);
  const [team] = await db.update(teamsTable)
    .set({ primaryColor: parsed.data.primaryColor })
    .where(eq(teamsTable.id, teamId))
    .returning({ primaryColor: teamsTable.primaryColor });
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  res.json(GetTeamBrandingResponse.parse({
    logoPath: (await db.select({ logoPath: teamsTable.logoPath }).from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1))[0]?.logoPath ?? null,
    primaryColor: team.primaryColor ?? null,
  }));
});

const TEAM_LOGO_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const TEAM_LOGO_MAX_BYTES = 2 * 1024 * 1024;

function isValidTeamLogo(data: Buffer, contentType: string): boolean {
  if (contentType === "image/png") {
    return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (contentType === "image/jpeg") {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }
  if (contentType === "image/webp") {
    return data.length >= 12 && data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

router.post(
  "/auth/team-branding/logo",
  requireCoordinator,
  express.raw({ type: [...TEAM_LOGO_TYPES], limit: TEAM_LOGO_MAX_BYTES }),
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body as Buffer | undefined;
    const contentType = req.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    if (!Buffer.isBuffer(data) || data.length === 0 || data.length > TEAM_LOGO_MAX_BYTES || !TEAM_LOGO_TYPES.has(contentType) || !isValidTeamLogo(data, contentType)) {
      res.status(400).json({ error: "Choose a valid PNG, JPEG, or WebP image up to 2 MB." });
      return;
    }
    const teamId = await requestTeamId(req);
    const [existing] = await db.select({ logoPath: teamsTable.logoPath }).from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
    if (!existing) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    let logoPath: string;
    try {
      logoPath = await objectStorageService.uploadTeamLogo(data, contentType, teamId);
    } catch (error) {
      req.log.error({ err: error }, "Could not store team logo");
      res.status(503).json({ error: "Logo storage is temporarily unavailable. Try again shortly." });
      return;
    }
    try {
      await db.update(teamsTable).set({ logoPath }).where(eq(teamsTable.id, teamId));
    } catch (error) {
      await objectStorageService.deleteObject(logoPath).catch(() => undefined);
      throw error;
    }
    if (existing.logoPath) await objectStorageService.deleteObject(existing.logoPath).catch((error) => {
      req.log.warn({ err: error }, "Could not remove the replaced team logo");
    });
    res.status(201).json(UploadTeamLogoResponse.parse({ logoPath }));
  },
);

router.delete("/auth/team-branding/logo", requireCoordinator, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  const [existing] = await db.select({ logoPath: teamsTable.logoPath })
    .from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
  const [team] = await db.update(teamsTable)
    .set({ logoPath: null })
    .where(eq(teamsTable.id, teamId))
    .returning({ id: teamsTable.id });
  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  if (existing?.logoPath) await objectStorageService.deleteObject(existing.logoPath).catch((error) => {
    req.log.warn({ err: error }, "Could not remove the reset team logo");
  });
  res.status(204).end();
});

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

/**
 * Resolve the team for an event passcode. Tries DB teams first (each team has
 * its own code), then falls back to the legacy ADMIN_PASSWORD for the default
 * team so the current team's data stays reachable through the migration.
 */
async function resolveEventTeam(eventPassword: string): Promise<ResolvedTeam | null> {
  const team = await findTeamByCode(eventPassword);
  if (team) return team;
  if (eventPasswordMatches(eventPassword)) {
    return { ...(await ensureDefaultTeam()), instance: "primary" as const };
  }
  return null;
}

function accountTeamId(account: { teamId?: string | null } | null | undefined): string {
  return teamIdForAccount(account);
}

async function requesterTeamId(req: Request): Promise<string> {
  const requesterId = (req as Request & { interviewerId?: string }).interviewerId;
  if (!requesterId) return DEFAULT_TEAM_ID;
  const requester = await accountById(requesterId);
  return accountTeamId(requester);
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

router.get("/auth/interviewers", async (req, res): Promise<void> => {
  // Private roster: signed-in callers get their own team, the login screen
  // gets one team by presenting its access code, and everyone else is turned
  // away. See interviewerRosterAccess for why there is no default-team
  // fallback.
  const session = requestAdminSession(req);
  const access = interviewerRosterAccess({
    hasSession: isValidAdminSession(session) && !(await isRevokedAdminSession(session)),
    eventPassword: typeof req.query.eventPassword === "string" ? req.query.eventPassword : "",
  });
  if (access.kind === "denied") {
    res.status(access.status).json({ error: access.error });
    return;
  }
  let teamId: string;
  if (access.kind === "session") {
    // attachAdminSession already pinned this request to the session's
    // database instance, so the account lookup reads the right cluster.
    const [account] = await db.select({ teamId: interviewerAccountsTable.teamId })
      .from(interviewerAccountsTable)
      .where(eq(interviewerAccountsTable.id, interviewerIdFromSession(session) ?? ""))
      .limit(1);
    if (!account) {
      res.status(401).json({ error: "Interviewer session is invalid" });
      return;
    }
    teamId = account.teamId?.trim() ? account.teamId : DEFAULT_TEAM_ID;
  } else {
    const team = await resolveEventTeam(access.eventPassword);
    if (!team) {
      res.status(401).json({ error: "The team access code is incorrect." });
      return;
    }
    teamId = team.id;
    enterInstance(team.instance);
  }
  const accounts = await syncInterviewerAccounts(await getInterviewSettings(teamId), teamId);
  // One query for all credential counts so the login screen can offer a
  // passkey instead of a password where one exists.
  const passkeyCounts = accounts.length
    ? await db
        .select({ interviewerId: webauthnCredentialsTable.interviewerId, n: count() })
        .from(webauthnCredentialsTable)
        .where(inArray(webauthnCredentialsTable.interviewerId, accounts.map((account) => account.id)))
        .groupBy(webauthnCredentialsTable.interviewerId)
    : [];
  const withPasskey = new Map(passkeyCounts.map((row) => [row.interviewerId, row.n > 0]));
  res.json(ListInterviewersResponse.parse({
    items: accounts.map((account) => ({ ...publicAccount(account), hasPasskey: withPasskey.get(account.id) ?? false })),
  }));
});

router.post("/auth/interviewers", async (req, res): Promise<void> => {
  const parsed = CreateInterviewerBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.displayName.trim()) {
    res.status(400).json({ error: "Name and password are required." });
    return;
  }
  const team = await resolveEventTeam(parsed.data.eventPassword);
  if (!team) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  enterInstance(team.instance);
  const displayName = parsed.data.displayName.trim().replace(/\s+/g, " ");
  // A display name must look like a person, not an email address or a link.
  const nameProblem = validateDisplayName(displayName);
  if (nameProblem) {
    res.status(400).json({ error: nameProblem });
    return;
  }
  const [nameRulesRecord] = await db.select({ rules: teamNameRulesTable.rules })
    .from(teamNameRulesTable)
    .where(eq(teamNameRulesTable.teamId, team.id))
    .limit(1);
  const configuredNameProblem = validateTeamNameRules(displayName, nameRulesRecord?.rules ?? []);
  if (configuredNameProblem) {
    res.status(400).json({ error: configuredNameProblem });
    return;
  }
  // Cap how many accounts one network can create per hour.
  const creationVerdict = checkAccountCreationAllowed(req.ip ?? "unknown");
  if (!creationVerdict.allowed) {
    res.status(429).json({ error: creationVerdict.error, retryAfter: creationVerdict.retryAfter });
    return;
  }
  const normalizedName = normalizeInterviewerName(displayName);
  const existing = await db.select({ id: interviewerAccountsTable.id })
    .from(interviewerAccountsTable).where(and(eq(interviewerAccountsTable.normalizedName, normalizedName), teamFilter(interviewerAccountsTable.teamId, team.id))).limit(1);
  if (existing.length) {
    res.status(409).json({ error: "That interviewer already exists." });
    return;
  }
  if (await rejectUnsafePassword(req, res, parsed.data.password, parsed.data.confirmLowExposure)) return;
  const [account] = await db.insert(interviewerAccountsTable).values({
    id: randomBytes(16).toString("hex"),
    teamId: team.id,
    displayName,
    normalizedName,
    passwordHash: hashPassword(parsed.data.password),
    role: "interviewer",
  }).returning();
  if (!account) {
    res.status(500).json({ error: "Could not create interviewer." });
    return;
  }
  // New people start with the same workspaces the interviewer role had: chat
  // and parts. Admins can adjust per person afterwards in Settings.
  try {
    const { readWorkspaceVisibility, writeWorkspaceVisibility } = await import("../lib/workspaceAccess");
    const current = await readWorkspaceVisibility(team.id);
    const next = { ...current } as Record<string, string[]>;
    for (const key of ["chat", "parts"] as const) {
      const list = Array.isArray(next[key]) ? [...next[key]] : [];
      if (!list.includes(account.id)) list.push(account.id);
      next[key] = list;
    }
    await writeWorkspaceVisibility(next, team.id);
  } catch {
    // Account creation already succeeded; access can be fixed in Settings.
  }
  await updateQueueLabels([...(await getInterviewSettings(team.id)), account.displayName], team.id);
  res.status(201).json(CreateInterviewerResponse.parse(publicAccount(account)));
});

router.post("/auth/interviewers/setup", async (req, res): Promise<void> => {
  const parsed = SetupInterviewerPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Interviewer and password are required." });
    return;
  }
  const team = await resolveEventTeam(parsed.data.eventPassword);
  if (!team) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  enterInstance(team.instance);
  const account = await accountById(parsed.data.interviewerId);
  if (!account || accountTeamId(account) !== team.id) {
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
  const team = await resolveEventTeam(parsed.data.eventPassword);
  if (!team) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const account = await accountById(params.data.interviewerId);
  if (!account || accountTeamId(account) !== team.id) {
    res.status(404).json({ error: "Interviewer not found." });
    return;
  }
  // Coordinators can only manage their own team.
  const ownTeam = await requesterTeamId(req);
  if (ownTeam !== team.id || ownTeam !== accountTeamId(account)) {
    res.status(403).json({ error: "Not available for your team" });
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
  const team = await resolveEventTeam(parsed.data.eventPassword);
  if (!team) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const ownTeam = await requesterTeamId(req);
  if (ownTeam !== team.id) {
    res.status(403).json({ error: "Not available for your team" });
    return;
  }
  // Scoped to this team only — other teams are never touched.
  await db.update(interviewerAccountsTable).set({ passwordHash: null, updatedAt: new Date() }).where(teamFilter(interviewerAccountsTable.teamId, team.id));
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
  const ownTeam = await requesterTeamId(req);
  if (accountTeamId(account) !== ownTeam) {
    res.status(404).json({ error: "Interviewer not found." });
    return;
  }
  await db.delete(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, interviewerId));
  const labels = await getInterviewSettings(ownTeam);
  await updateQueueLabels(labels.filter((label) => normalizeInterviewerName(label) !== account.normalizedName), ownTeam);
  res.status(204).end();
});

router.patch("/auth/interviewers/:interviewerId/role", requireCoordinator, async (req, res): Promise<void> => {
  const interviewerId = typeof req.params.interviewerId === "string" ? req.params.interviewerId : "";
  const role = (req.body as Record<string, unknown> | undefined)?.role;
  if (!interviewerId || (role !== "coordinator" && role !== "interviewer" && role !== "treasurer")) {
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
  const ownTeam = await requesterTeamId(req);
  if (accountTeamId(account) !== ownTeam) {
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
async function renameInterviewerReferences(previousName: string, nextName: string, teamId: string): Promise<void> {
  const teamCondQueue = teamFilter(interviewQueueTable.teamId, teamId);
  const [queue] = await db.select().from(interviewQueueTable).where(teamCondQueue).limit(1);
  try {
    const labels = JSON.parse(queue?.interviewerLabels ?? "[]") as unknown;
    if (Array.isArray(labels)) {
      const renamed = labels.map((label) =>
        typeof label === "string" && label.trim().toLowerCase() === previousName.toLowerCase()
          ? nextName
          : label,
      );
      if (queue) {
        await db
          .update(interviewQueueTable)
          .set({ interviewerLabels: JSON.stringify(renamed), updatedAt: new Date() })
          .where(eq(interviewQueueTable.id, queue.id));
      }
    }
  } catch {
    // Leave labels untouched if the stored value is unreadable.
  }

  const teamCondChat = teamFilter(interviewChatMessagesTable.teamId, teamId);
  await db
    .update(interviewChatMessagesTable)
    .set({ author: nextName })
    .where(and(eq(interviewChatMessagesTable.author, previousName), teamCondChat));

  // Thread keys are "<label><SEP><label>" with the pair sorted; replace only
  // the segment that matches this interviewer.
  const rows = await db
    .select({ id: interviewChatMessagesTable.id, peer: interviewChatMessagesTable.conversationPeer })
    .from(interviewChatMessagesTable).where(teamCondChat);
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
  const ownTeam = await requesterTeamId(req);
  if (accountTeamId(account) !== ownTeam) {
    res.status(404).json({ error: "Interviewer not found." });
    return;
  }
  const renameProblem = validateDisplayName(displayName);
  if (renameProblem) {
    res.status(400).json({ error: renameProblem });
    return;
  }
  const normalizedName = normalizeInterviewerName(displayName);
  if (normalizedName !== account.normalizedName) {
    const [nameRulesRecord] = await db.select({ rules: teamNameRulesTable.rules })
      .from(teamNameRulesTable)
      .where(eq(teamNameRulesTable.teamId, ownTeam))
      .limit(1);
    const configuredNameProblem = validateTeamNameRules(displayName, nameRulesRecord?.rules ?? []);
    if (configuredNameProblem) {
      res.status(400).json({ error: configuredNameProblem });
      return;
    }
  }
  const previousName = account.displayName;
  if (normalizedName === account.normalizedName) {
    res.json(UpdateInterviewerNameResponse.parse(publicAccount(account)));
    return;
  }
  const clash = await db
    .select({ id: interviewerAccountsTable.id })
    .from(interviewerAccountsTable)
    .where(and(eq(interviewerAccountsTable.normalizedName, normalizedName), teamFilter(interviewerAccountsTable.teamId, ownTeam)))
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
    await renameInterviewerReferences(previousName, displayName, ownTeam);
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


// ---------------------------------------------------------------------------
// Passkeys: an optional, additive sign-in method. Password auth is unchanged;
// a passkey simply skips typing the personal password after the event passcode.
// ---------------------------------------------------------------------------

const RP_NAME = "Robotics Interview Dashboard";

function passkeySessionResponse(res: Response, account: { id: string; displayName: string }) {
  const session = createInterviewerSession(account.id, currentInstance());
  setAdminCookie(res, session);
  return LoginWithPasskeyResponse.parse({
    authenticated: true,
    label: account.displayName,
    interviewerId: account.id,
    token: session,
  });
}

router.post("/auth/passkey/register/options", requireAdmin, async (req, res): Promise<void> => {
  const interviewerId = interviewerIdFromSession(requestAdminSession(req));
  const account = interviewerId ? await accountById(interviewerId) : undefined;
  if (!account) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const origin = webauthnOrigin(req);
  try {
    const existing = await db
      .select({ credentialId: webauthnCredentialsTable.credentialId, transports: webauthnCredentialsTable.transports })
      .from(webauthnCredentialsTable)
      .where(eq(webauthnCredentialsTable.interviewerId, account.id));
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: webauthnRPID(origin),
      userName: account.displayName,
      userID: new TextEncoder().encode(account.id),
      userDisplayName: account.displayName,
      attestationType: "none",
      authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
      excludeCredentials: existing.map((row) => ({
        id: row.credentialId,
        transports: JSON.parse(row.transports || "[]") as string[],
      })),
    });
    setPasskeyChallenge(res, { mode: "register", challenge: options.challenge, interviewerId: account.id });
    res.json({ publicKey: options });
  } catch (error) {
    req.log.error({ err: error }, "Passkey registration options failed");
    res.status(500).json({ error: "Could not prepare passkey registration" });
  }
});

router.post("/auth/passkey/register", requireAdmin, async (req, res): Promise<void> => {
  const interviewerId = interviewerIdFromSession(requestAdminSession(req));
  const account = interviewerId ? await accountById(interviewerId) : undefined;
  if (!account) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const parsed = RegisterPasskeyBody.safeParse(req.body);
  const challenge = readPasskeyChallenge(req);
  if (!parsed.success || !challenge || challenge.mode !== "register" || challenge.interviewerId !== account.id) {
    clearPasskeyChallenge(res);
    res.status(400).json({ error: "Passkey registration expired. Try again." });
    return;
  }
  const origin = webauthnOrigin(req);
  try {
    const verification = await verifyRegistrationResponse({
      response: parsed.data.response as never,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: webauthnRPID(origin),
      requireUserVerification: false,
    });
    clearPasskeyChallenge(res);
    if (!verification.verified || !verification.registrationInfo) {
      res.status(400).json({ error: "This passkey could not be verified." });
      return;
    }
    const credential = verification.registrationInfo.credential;
    const label = parsed.data.label?.trim().slice(0, 60) || "Passkey";
    const [row] = await db
      .insert(webauthnCredentialsTable)
      .values({
        id: randomBytes(16).toString("hex"),
        interviewerId: account.id,
        credentialId: credential.id,
        publicKey: bytesToBase64url(credential.publicKey),
        counter: credential.counter ?? 0,
        transports: JSON.stringify(credential.transports ?? []),
        label,
      })
      .returning();
    res.status(201).json(RegisterPasskeyResponse.parse({
      id: row.credentialId,
      label: row.label ?? "Passkey",
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: null,
      transports: JSON.parse(row.transports || "[]") as string[],
    }));
  } catch (error) {
    clearPasskeyChallenge(res);
    req.log.error({ err: error }, "Passkey registration verification failed");
    res.status(400).json({ error: "This passkey could not be verified." });
  }
});

router.get("/auth/passkey/list", requireAdmin, async (req, res): Promise<void> => {
  const interviewerId = interviewerIdFromSession(requestAdminSession(req));
  if (!interviewerId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const rows = await db
    .select().from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.interviewerId, interviewerId))
    .orderBy(webauthnCredentialsTable.createdAt);
  res.json(ListPasskeysResponse.parse({
    items: rows.map((row) => ({
      id: row.credentialId,
      label: row.label ?? "Passkey",
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
      transports: JSON.parse(row.transports || "[]") as string[],
    })),
  }));
});

router.delete("/auth/passkey/:credentialId", requireAdmin, async (req, res): Promise<void> => {
  const credentialId = typeof req.params.credentialId === "string" ? req.params.credentialId : "";
  const interviewerId = interviewerIdFromSession(requestAdminSession(req));
  if (!credentialId || !interviewerId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const [target] = await db
    .select({ id: webauthnCredentialsTable.id, interviewerId: webauthnCredentialsTable.interviewerId, role: interviewerAccountsTable.role })
    .from(webauthnCredentialsTable)
    .innerJoin(interviewerAccountsTable, eq(webauthnCredentialsTable.interviewerId, interviewerAccountsTable.id))
    .where(eq(webauthnCredentialsTable.credentialId, credentialId))
    .limit(1);
  if (!target) {
    res.status(404).json({ error: "Passkey not found" });
    return;
  }
  // Owners can remove their own passkey; coordinators may clean up any.
  if (target.interviewerId !== interviewerId && target.role !== "coordinator") {
    res.status(403).json({ error: "You can only remove your own passkeys." });
    return;
  }
  await db.delete(webauthnCredentialsTable).where(eq(webauthnCredentialsTable.credentialId, credentialId));
  res.status(204).end();
});

router.post("/auth/passkey/login/options", async (req, res): Promise<void> => {
  const parsed = GetPasskeyLoginOptionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const team = await resolveEventTeam(parsed.data.eventPassword);
  if (!team) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const ip = req.ip ?? "unknown";
  if (!loginAllowed(ip)) {
    res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
    return;
  }
  enterInstance(team.instance);
  const account = await accountById(parsed.data.interviewerId);
  if (account && accountTeamId(account) !== team.id) {
    res.status(401).json({ error: "Incorrect event passcode or person." });
    return;
  }
  const credentials = account
    ? await db.select({ credentialId: webauthnCredentialsTable.credentialId, transports: webauthnCredentialsTable.transports })
        .from(webauthnCredentialsTable)
        .where(eq(webauthnCredentialsTable.interviewerId, account.id))
    : [];
  if (!account || !account.passwordHash && !credentials.length) {
    // keep the error generic; the passcode already gated this request
    res.status(401).json({ error: "This person has not been set up yet." });
    return;
  }
  if (!credentials.length) {
    res.status(404).json({ error: "This person has no passkey yet. Use their password instead." });
    return;
  }
  const origin = webauthnOrigin(req);
  try {
    const options = await generateAuthenticationOptions({
      rpID: webauthnRPID(origin),
      allowCredentials: credentials.map((row) => ({
        id: row.credentialId,
        transports: JSON.parse(row.transports || "[]") as string[],
      })),
      userVerification: "preferred",
    });
    setPasskeyChallenge(res, { mode: "login", challenge: options.challenge, interviewerId: account.id });
    res.json({ publicKey: options });
  } catch (error) {
    req.log.error({ err: error }, error instanceof Error ? error.message : "unknown");
    res.status(500).json({ error: "Could not prepare passkey sign-in" });
  }
});

router.post("/auth/passkey/login", async (req, res): Promise<void> => {
  const parsed = LoginWithPasskeyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const team = await resolveEventTeam(parsed.data.eventPassword);
  if (!team) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const ip = req.ip ?? "unknown";
  if (!loginAllowed(ip)) {
    res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
    return;
  }
  const challenge = readPasskeyChallenge(req);
  if (!challenge || challenge.mode !== "login" || challenge.interviewerId !== parsed.data.interviewerId) {
    clearPasskeyChallenge(res);
    res.status(400).json({ error: "Passkey sign-in expired. Try again." });
    return;
  }
  enterInstance(team.instance);
  const account = await accountById(parsed.data.interviewerId);
  if (!account || accountTeamId(account) !== team.id) {
    clearPasskeyChallenge(res);
    res.status(401).json({ error: "Incorrect event passcode or person." });
    return;
  }
  const [stored] = await db
    .select().from(webauthnCredentialsTable)
    .where(eq(webauthnCredentialsTable.credentialId, credentialIdFromResponse(parsed.data.response)))
    .limit(1);
  if (!stored || stored.interviewerId !== account.id) {
    clearPasskeyChallenge(res);
    recordLoginFailure(ip);
    res.status(401).json({ error: "This passkey does not belong to that person." });
    return;
  }
  const origin = webauthnOrigin(req);
  try {
    const verification = await verifyAuthenticationResponse({
      response: parsed.data.response as never,
      expectedChallenge: challenge.challenge,
      expectedOrigin: origin,
      expectedRPID: webauthnRPID(origin),
      requireUserVerification: false,
      credential: {
        id: stored.credentialId,
        publicKey: base64urlToBytes(stored.publicKey),
        counter: stored.counter,
        transports: JSON.parse(stored.transports || "[]") as string[],
      },
    });
    clearPasskeyChallenge(res);
    if (!verification.verified) {
      recordLoginFailure(ip);
      res.status(401).json({ error: "This passkey was rejected. Use the password instead." });
      return;
    }
    loginFailures.delete(ip);
    await db
      .update(webauthnCredentialsTable)
      .set({ counter: verification.authenticationInfo.newCounter, lastUsedAt: new Date() })
      .where(eq(webauthnCredentialsTable.credentialId, stored.credentialId));
    res.json(passkeySessionResponse(res, account));
  } catch (error) {
    clearPasskeyChallenge(res);
    recordLoginFailure(ip);
    req.log.error({ err: error }, "Passkey login verification failed");
    res.status(401).json({ error: "This passkey was rejected. Use the password instead." });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Event passcode, interviewer, and password are required" });
    return;
  }
  const team = await resolveEventTeam(parsed.data.eventPassword);
  if (!team) {
    res.status(401).json({ error: "The event passcode is incorrect." });
    return;
  }
  const ip = req.ip ?? "unknown";
  if (!loginAllowed(ip)) {
    res.status(429).json({ error: "Too many attempts. Wait a minute and try again." });
    return;
  }
  enterInstance(team.instance);
  const account = await accountById(parsed.data.interviewerId);
  if (!account || accountTeamId(account) !== team.id || !passwordHashMatches(parsed.data.password, account.passwordHash)) {
    recordLoginFailure(ip);
    res.status(401).json({ error: "Incorrect interviewer or password" });
    return;
  }
  loginFailures.delete(ip);
  const session = createInterviewerSession(account.id, team.instance);
  setAdminCookie(res, session);
  const base = LoginResponse.parse({ authenticated: true, label: account.displayName, interviewerId: account.id, token: session });
  res.json({ ...base, role: account.role, teamId: team.id, teamName: team.name });
});

router.post("/auth/verify-event-passcode", async (req, res): Promise<void> => {
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
  const team = await resolveEventTeam(parsed.data.eventPassword);
  if (!team) {
    recordEventPasscodeFailure(ip);
    res.status(401).json({ error: "The team access code is incorrect." });
    return;
  }
  eventPasscodeFailures.delete(ip);
  // Extra teamId/teamName fields are ignored by older clients but let the new
  // login flow show which team was unlocked and scope the account list.
  res.json({ message: "Team access code verified.", teamId: team.id, teamName: team.name });
});

const teamCreateFailures = new Map<string, { count: number; resetAt: number }>();

function teamCreateAllowed(ip: string): boolean {
  const now = Date.now();
  const entry = teamCreateFailures.get(ip);
  if (!entry || entry.resetAt <= now) {
    teamCreateFailures.delete(ip);
    return true;
  }
  return entry.count < 5;
}

function recordTeamCreateFailure(ip: string): void {
  const now = Date.now();
  const entry = teamCreateFailures.get(ip);
  if (!entry || entry.resetAt <= now) teamCreateFailures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  else entry.count += 1;
}

/**
 * Create a brand-new team with its own access code, plus its first
 * coordinator account, and sign that account in. The new team starts empty
 * and is completely separate from every other team. The legacy default team's
 * rows (team_id NULL or 'default') are never touched.
 */
router.post("/auth/teams", async (req, res): Promise<void> => {
  const ip = req.ip ?? "unknown";
  if (!teamCreateAllowed(ip)) {
    res.status(429).json({ error: "Too many teams created. Wait a minute and try again." });
    return;
  }
  const body = req.body as Record<string, unknown> | undefined;
  const teamName = typeof body?.teamName === "string" ? body.teamName.trim().replace(/\s+/g, " ") : "";
  const teamCode = typeof body?.teamCode === "string" ? body.teamCode.trim() : "";
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().replace(/\s+/g, " ") : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const confirmLowExposure = body?.confirmLowExposure === true;
  if (!teamName || teamName.length > 80) {
    res.status(400).json({ error: "Give your team a name (1–80 characters)." });
    return;
  }
  if (!teamCode || teamCode.length < 4 || teamCode.length > 128) {
    res.status(400).json({ error: "Choose a team access code with at least 4 characters." });
    return;
  }
  if (!displayName || displayName.length > 80) {
    res.status(400).json({ error: "Add your name so your team can recognize you (1–80 characters)." });
    return;
  }
  if (!password) {
    res.status(400).json({ error: "Choose a personal password for your coordinator account." });
    return;
  }
  const normalizedTeam = normalizeTeamName(teamName);
  let secondaryTeamListWasRead = false;
  try {
    const primaryTeams = await primaryDb.select().from(teamsTable);
    let secondaryTeams: typeof primaryTeams = [];
    try {
      const secondary = secondaryDb();
      if (secondary) {
        secondaryTeams = await secondary.select().from(teamsTable);
        secondaryTeamListWasRead = true;
      } else {
        secondaryTeamListWasRead = true;
      }
    } catch {
      // Secondary unreachable: creation below will surface the real error.
    }
    const existingTeams = [...primaryTeams, ...secondaryTeams];
    if (existingTeams.some((t) => t.normalizedName === normalizedTeam)) {
      res.status(409).json({ error: "A team with that name already exists. Pick another name." });
      return;
    }
    // Team codes must be unique across teams so each code opens exactly one team.
    for (const t of existingTeams) {
      const { verifyTeamCodeHash } = await import("../lib/teams");
      if (verifyTeamCodeHash(teamCode, t.codeHash)) {
        res.status(409).json({ error: "That team access code is already in use. Pick another one." });
        return;
      }
    }
    if (eventPasswordMatches(teamCode)) {
      res.status(409).json({ error: "That team access code is already in use. Pick another one." });
      return;
    }
  } catch {
    // Teams table missing (pre-migration): allow creation; push will create it.
  }
  if (await rejectUnsafePassword(req, res, password, confirmLowExposure)) return;
  const teamId = randomBytes(16).toString("hex");
  let teamInstance: DbInstance = "primary";
  try {
    // Only choose secondary after proving it is reachable, before any team
    // writes begin. If it is temporarily unavailable, a new team can safely
    // start on primary and its session will be pinned there. Existing teams
    // remain on their owning database; their data is never silently redirected.
    const secondary = secondaryPool();
    if (secondary) {
      try {
        await secondary.query("select 1");
        if (!secondaryTeamListWasRead) {
          res.status(503).json({
            error: "Could not verify existing teams on the secondary database. Try again shortly.",
          });
          return;
        }
        teamInstance = "secondary";
      } catch (error) {
        if (!isTransientDatabaseAvailabilityError(error)) throw error;
        if (!canFallbackNewTeamToPrimary(error, secondaryTeamListWasRead)) {
          res.status(503).json({
            error: "The secondary database is unavailable, so this team cannot be safely placed yet. Try again shortly.",
          });
          return;
        }
        req.log.warn(
          { placement: "primary" },
          "Secondary unavailable; creating new team on primary",
        );
      }
    }
    enterInstance(teamInstance);
    await ensureDefaultTeam();
    const [team] = await db.insert(teamsTable).values({
      id: teamId,
      name: teamName,
      normalizedName: normalizedTeam,
      codeHash: hashTeamCode(teamCode),
    }).returning();
    if (!team) {
      res.status(500).json({ error: "Could not create that team. Try again." });
      return;
    }
    const normalizedName = normalizeInterviewerName(displayName);
    const [account] = await db.insert(interviewerAccountsTable).values({
      id: randomBytes(16).toString("hex"),
      teamId: team.id,
      displayName,
      normalizedName,
      passwordHash: hashPassword(password),
      role: "coordinator",
    }).returning();
    if (!account) {
      await db.delete(teamsTable).where(eq(teamsTable.id, team.id));
      res.status(500).json({ error: "Could not create that team. Try again." });
      return;
    }
    // Fresh team gets fresh singleton rows so it never inherits another team's queue/settings.
    try {
      const { interviewQueueTable: qTable, displaySettingsTable: dTable, seatingSettingsTable: sTable, chatSettingsTable: cTable, workspaceSettingsTable: wTable } = await import("@workspace/db");
      const { DEFAULT_WORKSPACE_VISIBILITY } = await import("../lib/workspaceVisibility");
      await db.insert(qTable).values({ teamId: team.id, interviewerLabels: JSON.stringify([displayName]) }).onConflictDoNothing();
      await db.insert(dTable).values({ teamId: team.id }).onConflictDoNothing();
      await db.insert(sTable).values({ teamId: team.id }).onConflictDoNothing();
      await db.insert(cTable).values({ id: `chat-${team.id}`, teamId: team.id, slowmodeSeconds: 0 }).onConflictDoNothing();
      await db.insert(wTable).values({ teamId: team.id, visibility: DEFAULT_WORKSPACE_VISIBILITY }).onConflictDoNothing();
      const { readWorkspaceVisibility, writeWorkspaceVisibility } = await import("../lib/workspaceAccess");
      const current = await readWorkspaceVisibility(team.id);
      const next = { ...current } as Record<string, string[]>;
      for (const key of Object.keys(next)) {
        const list = Array.isArray(next[key]) ? [...next[key]] : [];
        if (!list.includes(account.id)) list.push(account.id);
        next[key] = list;
      }
      await writeWorkspaceVisibility(next, team.id);
      await updateQueueLabels([displayName], team.id);
    } catch {
      // Team + account already exist; per-team settings can be repaired on next sign-in.
    }
    teamCreateFailures.delete(ip);
    const session = createInterviewerSession(account.id, teamInstance);
    setAdminCookie(res, session);
    res.status(201).json({
      message: "Team created.",
      teamId: team.id,
      teamName: team.name,
      authenticated: true,
      label: account.displayName,
      interviewerId: account.id,
      role: account.role,
      token: session,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      res.status(409).json({ error: "A team with that name already exists. Pick another name." });
      return;
    }
    req.log.error({ err: error }, "Team creation failed");
    recordTeamCreateFailure(ip);
    res.status(500).json({ error: "Could not create that team. Try again." });
  }
});

/**
 * Delete a team and every row it owns (accounts, applicants, queue, chat,
 * boards, files metadata, requests, settings). Site owner only, and never
 * the default team. Passkeys cascade with their accounts; revoked sessions
 * expire on their own. Orphaned storage objects (if any) are harmless.
 */
router.delete("/auth/teams/:teamId", requireSiteOwner, async (req, res): Promise<void> => {
  const teamId = typeof req.params.teamId === "string" ? req.params.teamId.trim() : "";
  if (!teamId) {
    res.status(400).json({ error: "Team id is required." });
    return;
  }
  if (teamId === DEFAULT_TEAM_ID) {
    res.status(400).json({ error: "The default team cannot be deleted." });
    return;
  }
  const { pool } = await import("@workspace/db");
  const { getTeamById } = await import("../lib/teams");
  try {
    const team = await getTeamById(teamId);
    if (!team || !("instance" in team)) {
      res.status(404).json({ error: "Team not found." });
      return;
    }
    enterInstance((team as { instance: "primary" | "secondary" }).instance);
    const tables = [
      "applicants", "application_imports", "assistant_conversations",
      "assistant_messages", "broadcasts", "cad_bots", "cad_folders",
      "cad_models", "chat_custom_emojis", "chat_message_reactions",
      "chat_poll_votes", "chat_polls", "chat_settings", "team_name_rules", "chunked_uploads",
      "code_files", "code_presence", "code_projects", "code_revisions",
      "dashboard_charts", "data_snapshots", "display_settings",
      "feature_requests", "interview_chat_messages", "interview_queue",
      "interview_whiteboards", "page_visits", "parts_catalog_items",
      "parts_inventory", "parts_robots", "parts_supplier_sync_states",
      "presence_heartbeats", "seating_settings", "workspace_settings",
    ];
    const removed: Record<string, number> = {};
    // A Pool hands out a different client per query, so BEGIN/COMMIT around
    // pool.query() would land on different connections: the deletes would
    // autocommit one by one and the COMMIT would have nothing to commit.
    // Check out a single client and run the whole deletion on it.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      try {
        for (const table of tables) {
          const result = await client.query(`delete from "${table}" where team_id = $1`, [team.id]);
          removed[table] = result.rowCount ?? 0;
        }
        const accounts = await client.query(`delete from "interviewer_accounts" where team_id = $1 returning id`, [team.id]);
        removed["interviewer_accounts"] = accounts.rowCount ?? 0;
        await client.query(`delete from "teams" where id = $1`, [team.id]);
        await client.query("COMMIT");
      } catch (txError) {
        await client.query("ROLLBACK");
        throw txError;
      }
    } finally {
      client.release();
    }
    req.log.info({ team: team.name, removed }, "Team deleted by site owner");
    res.json({ deletedTeamId: team.id, deletedTeamName: team.name, removed });
  } catch (error) {
    req.log.error({ err: error }, "Team deletion failed");
    res.status(500).json({ error: "Could not delete that team." });
  }
});

router.get("/auth/teams/random-code", (_req, res): void => {
  res.json({ code: randomTeamCode() });
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
  const teamId = accountTeamId(account);
  let teamName: string | undefined;
  try {
    const { getTeamById } = await import("../lib/teams");
    teamName = (await getTeamById(teamId))?.name;
  } catch {
    teamName = undefined;
  }
  const base = GetSessionResponse.parse({ authenticated: true, label: account.displayName, interviewerId: account.id, role: account.role, isSiteOwner: account.isSiteOwner === true });
  res.json({ ...base, teamId, ...(teamName ? { teamName } : {}) });
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