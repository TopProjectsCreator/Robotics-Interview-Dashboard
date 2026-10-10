import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  applicantsTable,
  dashboardChartsTable,
  dataSnapshotsTable,
  db,
  DEFAULT_TEAM_ID,
  interviewQueueTable,
  type Applicant,
} from "@workspace/db";
import { getInterviewSettings } from "./roboticsData";
import { teamFilter } from "./teams";

function tid(teamId?: string | null): string {
  return teamId?.trim() ? teamId : DEFAULT_TEAM_ID;
}

const MAX_SNAPSHOTS = 50;

export type SnapshotPayload = {
  version: 1;
  applicants: Record<string, unknown>[];
  interviewLabels: string[];
  charts: { source: string; chart: string; position: number; xAxis?: string | null; yAxis?: string | null }[];
};

export type SnapshotSummary = {
  id: string;
  label: string;
  createdBy: string;
  applicantCount: number;
  createdAt: string;
};

export type SnapshotDiff = {
  added: number;
  removed: number;
  changed: number;
  unchanged: number;
  addedNames: string[];
  removedNames: string[];
  labelsChanged: boolean;
  labelsBefore: string[];
  labelsNow: string[];
  chartsChanged: boolean;
  chartsBefore: number;
  chartsNow: number;
};

function serializeApplicants(rows: Applicant[]): Record<string, unknown>[] {
  return rows.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));
}

function summarize(row: typeof dataSnapshotsTable.$inferSelect): SnapshotSummary {
  return {
    id: row.id,
    label: row.label,
    createdBy: row.createdBy,
    applicantCount: row.applicantCount,
    createdAt: row.createdAt.toISOString(),
  };
}

function parsePayload(raw: string): SnapshotPayload {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("Corrupt snapshot payload");
  const payload = parsed as Partial<SnapshotPayload>;
  if (payload.version !== 1 || !Array.isArray(payload.applicants) || !Array.isArray(payload.interviewLabels) || !Array.isArray(payload.charts)) {
    throw new Error("Unsupported snapshot payload");
  }
  return payload as SnapshotPayload;
}

async function enforceRetention(team: string): Promise<void> {
  const rows = await db
    .select({ id: dataSnapshotsTable.id })
    .from(dataSnapshotsTable)
    .where(teamFilter(dataSnapshotsTable.teamId, team))
    .orderBy(desc(dataSnapshotsTable.createdAt));
  const overflow = rows.slice(MAX_SNAPSHOTS);
  for (const row of overflow) {
    await db.delete(dataSnapshotsTable).where(eq(dataSnapshotsTable.id, row.id));
  }
}

export async function captureSnapshot(label: string, createdBy: string, teamId?: string | null): Promise<SnapshotSummary> {
  const team = tid(teamId);
  const applicants = await db.select().from(applicantsTable).where(teamFilter(applicantsTable.teamId, team));
  const interviewLabels = await getInterviewSettings(team);
  const charts = await db
    .select({
      source: dashboardChartsTable.source,
      chart: dashboardChartsTable.chart,
      xAxis: dashboardChartsTable.xAxis,
      yAxis: dashboardChartsTable.yAxis,
      position: dashboardChartsTable.position,
    })
    .from(dashboardChartsTable)
    .where(teamFilter(dashboardChartsTable.teamId, team))
    .orderBy(asc(dashboardChartsTable.position));
  const payload: SnapshotPayload = {
    version: 1,
    applicants: serializeApplicants(applicants),
    interviewLabels,
    charts,
  };
  const cleanLabel = label.trim().slice(0, 120) || "Snapshot";
  const [row] = await db
    .insert(dataSnapshotsTable)
    .values({
      id: randomUUID(),
      teamId: team,
      label: cleanLabel,
      createdBy: createdBy === "assistant" ? "assistant" : "coordinator",
      applicantCount: applicants.length,
      payload: JSON.stringify(payload),
    })
    .returning();
  await enforceRetention(team);
  return summarize(row);
}

export async function listSnapshots(teamId?: string | null): Promise<SnapshotSummary[]> {
  const team = tid(teamId);
  const rows = await db
    .select()
    .from(dataSnapshotsTable)
    .where(teamFilter(dataSnapshotsTable.teamId, team))
    .orderBy(desc(dataSnapshotsTable.createdAt));
  return rows.map(summarize);
}

export async function diffSnapshot(id: string, teamId?: string | null): Promise<{ summary: SnapshotSummary; diff: SnapshotDiff }> {
  const team = tid(teamId);
  const [row] = await db.select().from(dataSnapshotsTable).where(and(eq(dataSnapshotsTable.id, id), teamFilter(dataSnapshotsTable.teamId, team)));
  if (!row) throw new Error("Snapshot not found");
  const payload = parsePayload(row.payload);
  const current = await db.select().from(applicantsTable).where(teamFilter(applicantsTable.teamId, team));
  const labelsNow = await getInterviewSettings(team);
  const labelsBefore = payload.interviewLabels;
  const chartsNow = (
    await db.select({ position: dashboardChartsTable.position }).from(dashboardChartsTable).where(teamFilter(dashboardChartsTable.teamId, team))
  ).length;
  const before = new Map(payload.applicants.map((a) => [String((a as Record<string, unknown>).id), a]));
  const now = new Map(current.map((a) => [a.id, a]));
  // Restore-relative naming: addedNames = rows the restore will bring back
  // (in snapshot, missing now); removedNames = rows it will take away.
  const addedNames: string[] = [];
  const removedNames: string[] = [];
  let changed = 0;
  let unchanged = 0;
  for (const [aid, a] of now) {
    const old = before.get(aid);
    if (!old) {
      if (removedNames.length < 5) removedNames.push(a.name);
    } else {
      const { updatedAt: _u1, ...restNow } = a as unknown as Record<string, unknown>;
      const { updatedAt: _u2, ...restOld } = old as Record<string, unknown>;
      // createdAt serializes to ISO on both sides; normalize for comparison.
      const norm = (v: unknown) => (v instanceof Date ? (v as Date).toISOString() : v);
      const keys = new Set([...Object.keys(restNow), ...Object.keys(restOld)]);
      let same = true;
      for (const key of keys) {
        if (JSON.stringify(norm((restNow as Record<string, unknown>)[key])) !== JSON.stringify(norm((restOld as Record<string, unknown>)[key]))) {
          same = false;
          break;
        }
      }
      if (same) unchanged += 1;
      else changed += 1;
    }
  }
  for (const [aid, a] of before) {
    if (!now.has(aid)) {
      const rec = a as unknown as Record<string, unknown>;
      if (addedNames.length < 5) addedNames.push(String(rec.name ?? aid));
    }
  }
  // Direction is restore-relative: added = rows the restore will bring back,
  // removed = rows the restore will take away.
  const addedIds = [...before.keys()].filter((k) => !now.has(k));
  const removedIds = [...now.keys()].filter((k) => !before.has(k));
  return {
    summary: summarize(row),
    diff: {
      added: addedIds.length,
      removed: removedIds.length,
      changed,
      unchanged,
      addedNames,
      removedNames,
      labelsChanged: JSON.stringify([...labelsBefore].sort()) !== JSON.stringify([...labelsNow].sort()),
      labelsBefore,
      labelsNow,
      chartsChanged: chartsNow !== payload.charts.length,
      chartsBefore: payload.charts.length,
      chartsNow,
    },
  };
}

export async function restoreSnapshot(
  id: string,
  actor: string,
  teamId?: string | null,
): Promise<{ restoredId: string; preRestoreId: string; applicantCount: number }> {
  const team = tid(teamId);
  const [row] = await db.select().from(dataSnapshotsTable).where(and(eq(dataSnapshotsTable.id, id), teamFilter(dataSnapshotsTable.teamId, team)));
  if (!row) throw new Error("Snapshot not found");
  const payload = parsePayload(row.payload);
  // Append-only history: the present is saved first, so restoring forward
  // and back is always possible.
  const pre = await captureSnapshot(`Before restoring "${row.label}"`, actor, team);
  await db.transaction(async (tx) => {
    await tx.delete(applicantsTable).where(teamFilter(applicantsTable.teamId, team));
    for (const raw of payload.applicants) {
      const rec = raw as unknown as Record<string, unknown>;
      await tx.insert(applicantsTable).values({
        id: String(rec.id),
        teamId: team,
        name: String(rec.name ?? "Unnamed applicant"),
        grade: String(rec.grade ?? "Unknown"),
        email: (rec.email as string | null) ?? null,
        photoUrl: (rec.photoUrl as string | null) ?? null,
        transcript: (rec.transcript as string | null) ?? null,
        attachments: (rec.attachments as string | null) ?? null,
        aiScore: typeof rec.aiScore === "number" ? rec.aiScore : -1,
        aiRecommendation: String(rec.aiRecommendation ?? "Review"),
        aiSummary: String(rec.aiSummary ?? ""),
        aiStrengths: String(rec.aiStrengths ?? ""),
        aiConcerns: String(rec.aiConcerns ?? ""),
        roboticsExperience: String(rec.roboticsExperience ?? ""),
        commit10Hours: String(rec.commit10Hours ?? "Unclear"),
        parentVolunteer: String(rec.parentVolunteer ?? "Unclear"),
        interviewStatus: String(rec.interviewStatus ?? "queued"),
        interviewer: String(rec.interviewer ?? ""),
        interviewDecision: String(rec.interviewDecision ?? "Undecided"),
        callbackRequested: Boolean(rec.callbackRequested ?? false),
        flagged: Boolean(rec.flagged ?? false),
        category: String(rec.category ?? "unranked"),
        rank: typeof rec.rank === "number" ? rec.rank : 0,
        notes: String(rec.notes ?? ""),
        queuePosition: typeof rec.queuePosition === "number" ? rec.queuePosition : 0,
        createdAt: rec.createdAt ? new Date(String(rec.createdAt)) : new Date(),
        updatedAt: new Date(),
      });
    }
    const [queueRow] = await tx
      .select({ id: interviewQueueTable.id })
      .from(interviewQueueTable)
      .where(teamFilter(interviewQueueTable.teamId, team))
      .limit(1);
    if (queueRow) {
      await tx
        .update(interviewQueueTable)
        .set({ interviewerLabels: JSON.stringify(payload.interviewLabels), updatedAt: new Date() })
        .where(eq(interviewQueueTable.id, queueRow.id));
    } else {
      // New teams get their own queue row; id auto-increments past the legacy id=1.
      await tx
        .insert(interviewQueueTable)
        .values({ teamId: team, interviewerLabels: JSON.stringify(payload.interviewLabels) });
    }
    await tx.delete(dashboardChartsTable).where(teamFilter(dashboardChartsTable.teamId, team));
    for (const chart of payload.charts) {
      await tx.insert(dashboardChartsTable).values({
        id: randomUUID(),
        teamId: team,
        source: chart.source,
        chart: chart.chart,
        xAxis: chart.xAxis ?? null,
        yAxis: chart.yAxis ?? null,
        position: chart.position,
      });
    }
  });
  return { restoredId: id, preRestoreId: pre.id, applicantCount: payload.applicants.length };
}
