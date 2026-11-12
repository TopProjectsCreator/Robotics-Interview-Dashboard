import assert from "node:assert/strict";
import test, { mock } from "node:test";

const ledger = { visits: [], activity: [] };
let nextId = 0;

const pool = {
  async connect() {
    return {
      async query(sql, values = []) {
        const statement = sql.replace(/\s+/g, " ").trim().toLowerCase();
        if (["begin", "commit", "rollback"].includes(statement)) return { rows: [] };
        if (statement.startsWith("select pg_advisory_xact_lock")) return { rows: [] };
        if (statement.startsWith("select") && statement.includes('from "workspace_usage_visits"')) {
          if (statement.includes('"last_heartbeat_at" <')) {
            assert.ok(
              statement.includes('where ("team_id" = $1 or ($1 = \'default\' and "team_id" is null))'),
              "stale-visit cleanup keeps the team column correctly quoted",
            );
            const [teamId, now] = values;
            const staleBefore = now.getTime() - 90_000;
            return {
              rows: ledger.visits
                .filter((visit) => visit.teamId === teamId && !visit.exitedAt &&
                  visit.lastHeartbeatAt.getTime() < staleBefore)
                .map((visit) => ({ ...visit, sessionHash: "session-hash" })),
            };
          }
          const [sessionHash] = values;
          return {
            rows: ledger.visits
              .filter((visit) => visit.sessionHash === sessionHash && !visit.exitedAt)
              .sort((left, right) => right.enteredAt - left.enteredAt)
              .slice(0, 1)
              .map((visit) => ({ ...visit })),
          };
        }
        if (statement.startsWith('insert into "workspace_usage_activity"')) {
          ledger.activity.push({
            workspaceKey: values[3],
            customWorkspaceId: values[4],
            activityDate: values[5],
            activeSeconds: values[6],
          });
          return { rows: [] };
        }
        if (statement.startsWith('insert into "workspace_usage_visits"')) {
          ledger.visits.push({
            id: values[0] ?? `visit-${++nextId}`,
            teamId: values[1],
            sessionHash: values[2],
            workspaceKey: values[3],
            customWorkspaceId: values[4],
            enteredAt: values[5],
            exitedAt: null,
            lastHeartbeatAt: values[5],
            isForeground: true,
            activeSeconds: 0,
          });
          return { rows: [] };
        }
        if (statement.startsWith('update "workspace_usage_visits"')) {
          const visit = ledger.visits.find((row) => row.id === values[0]);
          if (!visit) return { rows: [] };
          visit.activeSeconds += values[1];
          if (statement.includes('"last_heartbeat_at" = $3')) {
            assert.ok(statement.includes('"last_heartbeat_at" = $3::timestamptz'));
            assert.ok(statement.includes('"exited_at" = case when $5 then null else $6 end'));
            assert.ok(values[2] instanceof Date && values[5] instanceof Date);
            visit.lastHeartbeatAt = values[2];
            visit.isForeground = values[3];
            visit.exitedAt = values[4] ? null : values[2];
          } else {
            visit.exitedAt = values[2];
            visit.isForeground = false;
          }
          return { rows: [] };
        }
        throw new Error(`Unexpected usage query: ${statement}`);
      },
      release() {},
    };
  },
};

mock.module("@workspace/db", {
  namedExports: {
    pool,
    primaryDb: {},
    secondaryDb: () => null,
    teamsTable: {},
    interviewerAccountsTable: {},
    DEFAULT_TEAM_ID: "default",
    normalizeTeamName: (name) => String(name).toLowerCase(),
  },
});
const {
  finalizeStaleWorkspaceVisits,
  recordWorkspaceActivity,
} = await import("./workspaceUsageTracking.ts");

const start = Date.parse("2026-11-09T10:00:00.000Z");
const at = (seconds) => new Date(start + seconds * 1000);
const session = "session-hash";
const team = "team-a";
const chat = { workspaceKey: "chat", customWorkspaceId: null };
const custom = { workspaceKey: "custom", customWorkspaceId: "custom-one" };

test("visible heartbeats accrue time, hidden tabs pause, navigation switches workspaces, and stale visits cap at 45 seconds", async () => {
  await recordWorkspaceActivity({ sessionHash: session, teamId: team, identity: chat, visible: true, now: at(0) });
  await recordWorkspaceActivity({ sessionHash: session, teamId: team, identity: chat, visible: true, now: at(30) });
  await recordWorkspaceActivity({ sessionHash: session, teamId: team, identity: chat, visible: false, now: at(35) });
  await recordWorkspaceActivity({ sessionHash: session, teamId: team, identity: chat, visible: true, now: at(320) });
  await recordWorkspaceActivity({ sessionHash: session, teamId: team, identity: custom, visible: true, now: at(350) });
  await recordWorkspaceActivity({ sessionHash: session, teamId: team, identity: custom, visible: true, now: at(380) });

  const chatSeconds = ledger.activity
    .filter((entry) => entry.workspaceKey === "chat")
    .reduce((sum, entry) => sum + entry.activeSeconds, 0);
  assert.equal(chatSeconds, 65);
  assert.equal(ledger.visits[0].exitedAt.getTime(), at(35).getTime());
  assert.equal(ledger.visits[1].exitedAt.getTime(), at(350).getTime());
  assert.equal(ledger.activity.some((entry) => entry.activityDate !== "2026-11-09"), false);

  await finalizeStaleWorkspaceVisits(team, at(481));
  const customSecondsBeforeResume = ledger.activity
    .filter((entry) => entry.workspaceKey === "custom")
    .reduce((sum, entry) => sum + entry.activeSeconds, 0);
  assert.equal(customSecondsBeforeResume, 75);
  assert.equal(ledger.visits[2].exitedAt.getTime(), at(425).getTime());

  await recordWorkspaceActivity({ sessionHash: session, teamId: team, identity: custom, visible: true, now: at(500) });
  assert.equal(ledger.visits.length, 4);
  assert.equal(ledger.visits[3].enteredAt.getTime(), at(500).getTime());
  assert.equal(ledger.visits[3].activeSeconds, 0);
});
