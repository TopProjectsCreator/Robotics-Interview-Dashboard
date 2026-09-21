import { Router, type IRouter } from "express";
import { GetSystemUsageResponse } from "@workspace/api-zod";
import { pool } from "@workspace/db";
import { requireAdmin } from "../middlewares/adminAuth";

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
router.get("/system/usage", requireAdmin, async (_req, res): Promise<void> => {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "app-uploads";
  const [databaseBytes, storageBytes, authUsers, applicantCount] = await Promise.all([
    queryInt("select pg_database_size(current_database())"),
    queryInt("select coalesce(sum((metadata->>'size')::bigint), 0) from storage.objects where bucket_id = $1", [bucket]),
    queryInt("select count(*) from auth.users"),
    queryInt("select count(*) from applicants"),
  ]);
  res.json(
    GetSystemUsageResponse.parse({
      databaseBytes: databaseBytes ?? 0,
      databaseQuotaBytes: quotaEnv("SUPABASE_DB_QUOTA_MB", 500),
      storageBytes,
      storageQuotaBytes: quotaEnv("SUPABASE_STORAGE_QUOTA_MB", 1024),
      authUsers,
      authUsersQuota: Math.round(Number(process.env.SUPABASE_MAU_QUOTA) || 50000),
      applicantCount: applicantCount ?? 0,
    }),
  );
});

export default router;
