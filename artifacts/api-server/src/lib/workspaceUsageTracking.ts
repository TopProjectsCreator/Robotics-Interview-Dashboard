import { pool } from "@workspace/db";
import { teamSqlCondition } from "./teamSqlCondition.ts";
import {
  BUILT_IN_WORKSPACE_KEYS,
  newWorkspaceUsageId,
  splitForegroundInterval,
  type WorkspaceIdentity,
} from "./workspaceUsage.ts";

const MAX_HEARTBEAT_INTERVAL_SECONDS = 45;
const STALE_AFTER_SECONDS = 90;

type UsageClient = {
  query<T = unknown>(text: string, values?: unknown[]): Promise<{ rows: T[] }>;
  release(): void;
};

type OpenVisit = {
  id: string;
  workspaceKey: string;
  customWorkspaceId: string | null;
  lastHeartbeatAt: Date;
  isForeground: boolean;
};

function identityForVisit(visit: OpenVisit): WorkspaceIdentity | null {
  if (visit.workspaceKey === "custom" && visit.customWorkspaceId) {
    return { workspaceKey: "custom", customWorkspaceId: visit.customWorkspaceId };
  }
  if ((BUILT_IN_WORKSPACE_KEYS as readonly string[]).includes(visit.workspaceKey)) {
    return {
      workspaceKey: visit.workspaceKey as (typeof BUILT_IN_WORKSPACE_KEYS)[number],
      customWorkspaceId: null,
    };
  }
  return null;
}

function sameWorkspace(visit: OpenVisit, identity: WorkspaceIdentity): boolean {
  return visit.workspaceKey === identity.workspaceKey &&
    visit.customWorkspaceId === identity.customWorkspaceId;
}

async function saveActivityInterval(
  client: UsageClient,
  values: {
    teamId: string;
    sessionHash: string;
    identity: WorkspaceIdentity;
    startAt: Date;
    endAt: Date;
  },
): Promise<number> {
  const intervals = splitForegroundInterval(
    values.startAt,
    values.endAt,
    MAX_HEARTBEAT_INTERVAL_SECONDS,
  );
  let totalSeconds = 0;
  for (const interval of intervals) {
    totalSeconds += interval.activeSeconds;
    await client.query(
      `insert into "workspace_usage_activity"
        ("id", "team_id", "session_hash", "workspace_key", "custom_workspace_id", "activity_date", "active_seconds")
       values ($1, $2, $3, $4, $5, $6::date, $7)`,
      [
        newWorkspaceUsageId(),
        values.teamId,
        values.sessionHash,
        values.identity.workspaceKey,
        values.identity.customWorkspaceId,
        interval.activityDate,
        interval.activeSeconds,
      ],
    );
  }
  return totalSeconds;
}

async function finalizeVisit(
  client: UsageClient,
  visit: OpenVisit,
  sessionHash: string,
  teamId: string,
  now: Date,
): Promise<void> {
  const endAt = visit.isForeground
    ? new Date(Math.min(
        now.getTime(),
        visit.lastHeartbeatAt.getTime() + MAX_HEARTBEAT_INTERVAL_SECONDS * 1000,
      ))
    : visit.lastHeartbeatAt;
  const identity = identityForVisit(visit);
  const activeSeconds = visit.isForeground && identity
    ? await saveActivityInterval(client, {
        teamId,
        sessionHash,
        identity,
        startAt: visit.lastHeartbeatAt,
        endAt: new Date(Math.min(now.getTime(), endAt.getTime())),
      })
    : 0;
  await client.query(
    `update "workspace_usage_visits"
        set "active_seconds" = "active_seconds" + $2,
            "exited_at" = $3,
            "is_foreground" = false
      where "id" = $1 and "exited_at" is null`,
    [visit.id, activeSeconds, endAt],
  );
}

/** End a session's open workspace visit during logout or an admin kick. */
export async function closeWorkspaceUsageVisit(sessionHash: string, now = new Date()): Promise<void> {
  const client = await pool.connect() as unknown as UsageClient;
  try {
    await client.query("BEGIN");
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [sessionHash]);
    const result = await client.query<OpenVisit & { teamId: string }>(
      `select "id", "team_id" as "teamId", "workspace_key" as "workspaceKey",
              "custom_workspace_id" as "customWorkspaceId",
              "last_heartbeat_at" as "lastHeartbeatAt", "is_foreground" as "isForeground"
         from "workspace_usage_visits"
        where "session_hash" = $1 and "exited_at" is null
        order by "entered_at" desc
        limit 1
        for update`,
      [sessionHash],
    );
    const visit = result.rows[0];
    if (visit) await finalizeVisit(client, visit, sessionHash, visit.teamId, now);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Close stale records so abandoned tabs can never accrue unlimited time. */
export async function finalizeStaleWorkspaceVisits(teamId: string, now = new Date()): Promise<void> {
  const client = await pool.connect() as unknown as UsageClient;
  try {
    await client.query("BEGIN");
    const stale = await client.query<OpenVisit & { sessionHash: string }>(
      `select "id", "session_hash" as "sessionHash", "workspace_key" as "workspaceKey",
              "custom_workspace_id" as "customWorkspaceId",
              "last_heartbeat_at" as "lastHeartbeatAt", "is_foreground" as "isForeground"
         from "workspace_usage_visits"
        where ${teamSqlCondition('"team_id"', "$1")}
          and "exited_at" is null
          and "last_heartbeat_at" < $2::timestamptz - make_interval(secs => ${STALE_AFTER_SECONDS})
        order by "last_heartbeat_at"
        limit 5000
        for update skip locked`,
      [teamId, now],
    );
    for (const visit of stale.rows) {
      await finalizeVisit(client, visit, visit.sessionHash, teamId, now);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function recordWorkspaceActivity(input: {
  sessionHash: string;
  teamId: string;
  identity: WorkspaceIdentity | null;
  visible: boolean;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? new Date();
  const client = await pool.connect() as unknown as UsageClient;
  try {
    await client.query("BEGIN");
    // Serialize heartbeat requests from one signed session before selecting
    // its open visit. A partial unique index is a second line of defense.
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [input.sessionHash]);
    const result = await client.query<OpenVisit>(
      `select "id", "workspace_key" as "workspaceKey",
              "custom_workspace_id" as "customWorkspaceId",
              "last_heartbeat_at" as "lastHeartbeatAt", "is_foreground" as "isForeground"
         from "workspace_usage_visits"
        where "session_hash" = $1 and "exited_at" is null
        order by "entered_at" desc
        limit 1
        for update`,
      [input.sessionHash],
    );
    let openVisit: OpenVisit | undefined = result.rows[0];
    if (
      openVisit &&
      now.getTime() - openVisit.lastHeartbeatAt.getTime() > STALE_AFTER_SECONDS * 1000
    ) {
      await finalizeVisit(client, openVisit, input.sessionHash, input.teamId, now);
      openVisit = undefined;
    }

    if (openVisit) {
      const identity = identityForVisit(openVisit);
      const intervalSeconds = openVisit.isForeground && identity
        ? await saveActivityInterval(client, {
            teamId: input.teamId,
            sessionHash: input.sessionHash,
            identity,
            startAt: openVisit.lastHeartbeatAt,
            endAt: now,
          })
        : 0;
      const remainsHere = input.identity !== null && sameWorkspace(openVisit, input.identity);
      await client.query(
        `update "workspace_usage_visits"
            set "active_seconds" = "active_seconds" + $2,
                "last_heartbeat_at" = $3,
                "is_foreground" = $4,
                "exited_at" = case when $5 then null else $3 end
          where "id" = $1 and "exited_at" is null`,
        [
          openVisit.id,
          intervalSeconds,
          now,
          remainsHere && input.visible,
          remainsHere,
        ],
      );
      if (remainsHere) {
        await client.query("COMMIT");
        return;
      }
    }

    if (input.identity && input.visible) {
      await client.query(
        `insert into "workspace_usage_visits"
          ("id", "team_id", "session_hash", "workspace_key", "custom_workspace_id",
           "entered_at", "last_heartbeat_at", "is_foreground")
         values ($1, $2, $3, $4, $5, $6, $6, true)`,
        [
          newWorkspaceUsageId(),
          input.teamId,
          input.sessionHash,
          input.identity.workspaceKey,
          input.identity.customWorkspaceId,
          now,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
