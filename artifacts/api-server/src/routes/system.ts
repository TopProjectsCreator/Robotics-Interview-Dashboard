import { Router, type IRouter } from "express";
import {
  GetSystemUsageResponse,
  GetTeamMailboxSettingsResponse,
  UpdateTeamMailboxSettingsBody,
} from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { requestTeamId, requireAdmin, requireCoordinator, requireInboxAdmin } from "../middlewares/adminAuth";
import {
  forwardingAddress,
  getTeamMailboxSettings,
  ingestMailboxIntoChat,
  saveTeamMailboxSettings,
} from "../lib/maildrop";
import {
  normalizeWorkspaceVisibility,
  readWorkspaceVisibility,
  writeWorkspaceVisibility,
} from "../lib/workspaceAccess";

const MB = 1024 * 1024;

function quotaEnv(name: string, fallbackMb: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * MB) : fallbackMb * MB;
}

async function queryInt(sql: string, params: unknown[] = []): Promise<number | null> {
  try {
    const { rows } = await pool.query(sql, params);
    const value = Number(rows[0] ? Object.values(rows[0])[0] : NaN);
    return Number.isFinite(value) ? Math.round(value) : null;
  } catch {
    return null;
  }
}

const router: IRouter = Router();

const diagHits = new Map<string, number[]>();

// Client-side failure reports (admin-only, rate-limited). The chat client
// posts these when an operation fails so the exact failing stage lands in
// the server logs without anyone opening devtools.
router.post("/diagnostics", requireAdmin, (req, res): void => {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const recent = (diagHits.get(ip) ?? []).filter((at) => now - at < 60000);
  if (recent.length >= 30) {
    res.status(429).json({ error: "Slow down" });
    return;
  }
  recent.push(now);
  diagHits.set(ip, recent);
  const body = (req.body ?? {}) as Record<string, unknown>;
  const message = typeof body.message === "string" ? body.message.slice(0, 500) : "n/a";
  const context = typeof body.context === "string" ? body.context.slice(0, 500) : "";
  req.log.warn({ diag: true, message, context }, "Client diagnostic");
  res.status(202).json({ ok: true });
});

// Supabase usage measured straight from the database, compared against the
// plan quotas configured in env (Free-tier defaults). Storage and auth
// reads return null when the role cannot see those schemas.
router.get("/system/usage", requireAdmin, async (req, res): Promise<void> => {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "app-uploads";
  // Infra-level gauges (database/storage/auth) are global; the applicant
  // count is scoped to the requester's team so teams only see their roster.
  const teamId = await requestTeamId(req);
  const [databaseBytes, storageBytes, authUsers, applicantCount] = await Promise.all([
    queryInt("select pg_database_size(current_database())"),
    queryInt("select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = $1", [bucket]),
    queryInt("select count(*) from auth.users"),
    queryInt("select count(*) from applicants where (team_id = $1 or ($1 = 'default' and team_id is null))", [teamId]),
  ]);
  res.json(
    GetSystemUsageResponse.parse({
      databaseBytes: databaseBytes ?? 0,
      // Plan/tier numbers are deliberately not reported: they describe the
      // hosting account, not this team's workspace, and showing them to
      // every team invites the wrong impression (and helps nobody).
      databaseQuotaBytes: 0,
      storageBytes,
      storageQuotaBytes: 0,
      authUsers,
      authUsersQuota: 0,
      applicantCount: applicantCount ?? 0,
    }),
  );
});

function mailboxSettingsResponse(settings: Awaited<ReturnType<typeof getTeamMailboxSettings>>) {
  return GetTeamMailboxSettingsResponse.parse({
    ...settings,
    forwardingAddress: settings.mailbox ? forwardingAddress(settings.mailbox) : null,
    configured: settings.enabled && settings.allowedSenders.length > 0,
  });
}

// Inbox configuration belongs to the signed-in team's Admins. The team ID is
// always derived from the authenticated account, never from request data.
router.get("/system/mailbox", requireInboxAdmin, async (req, res): Promise<void> => {
  try {
    res.json(mailboxSettingsResponse(await getTeamMailboxSettings(await requestTeamId(req))));
  } catch (error) {
    req.log.error({ err: error }, "Team inbox settings read failed");
    res.status(500).json({ error: "Unable to read team inbox settings." });
  }
});

router.put("/system/mailbox", requireInboxAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateTeamMailboxSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter valid approved sender email addresses." });
    return;
  }
  try {
    const settings = await saveTeamMailboxSettings(
      await requestTeamId(req),
      parsed.data.enabled,
      parsed.data.allowedSenders,
    );
    res.json(mailboxSettingsResponse(settings));
  } catch (error) {
    if (error instanceof TypeError) {
      res.status(400).json({ error: error.message });
      return;
    }
    req.log.error({ err: error }, "Team inbox settings update failed");
    res.status(500).json({ error: "Unable to update team inbox settings." });
  }
});

// Check only the signed-in team's inbox, without accepting a client-selected ID.
router.post("/system/mailbox/sync", requireInboxAdmin, async (req, res): Promise<void> => {
  try {
    const teamId = await requestTeamId(req);
    res.json(await ingestMailboxIntoChat(teamId));
  } catch (error) {
    req.log.error({ err: error }, "Manual team inbox check failed");
    res.status(500).json({ error: "Unable to check the team inbox." });
  }
});

// Which users can open each workspace (per interviewer account ID, with legacy
// role names still accepted). Readable by any signed-in account so the shell
// can hide links the viewer cannot use; only coordinators can change it.
router.get("/workspaces/visibility", requireAdmin, async (req, res): Promise<void> => {
  try {
    res.json(normalizeWorkspaceVisibility(await readWorkspaceVisibility(await requestTeamId(req))));
  } catch (error) {
    req.log.error({ err: error }, "Workspace visibility read failed");
    res.status(500).json({ error: "Unable to read workspace settings." });
  }
});

router.put("/workspaces/visibility", requireCoordinator, async (req, res): Promise<void> => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    res.status(400).json({ error: "The workspace settings are invalid." });
    return;
  }
  try {
    // Unknown workspaces are discarded server side rather than trusted, so a
    // stale client cannot grant access it should not. Entries are account IDs
    // (plus legacy role names, which keep working until re-saved).
    res.json(normalizeWorkspaceVisibility(await writeWorkspaceVisibility(req.body, await requestTeamId(req))));
  } catch (error) {
    req.log.error({ err: error }, "Workspace visibility update failed");
    res.status(500).json({ error: "Unable to update workspace settings." });
  }
});

export default router;
