import { randomUUID } from "node:crypto";
import { asc, desc, eq } from "drizzle-orm";
import {
  applicantsTable,
  dashboardChartsTable,
  dataSnapshotsTable,
  db,
  interviewQueueTable,
  type Applicant,
} from "@workspace/db";
import { getInterviewSettings } from "./roboticsData";

const MAX_SNAPSHOTS = 50;

export type SnapshotPayload = {
  version: 1;
  applicants: Record<string, unknown>[];
  interviewLabels: string[];
  charts: { source: string; chart: string; position: number }[];
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

async function enforceRetention(): Promise<void> {
  const rows = await db
    .select({ id: dataSnapshotsTable.id })
    .from(dataSnapshotsTable)
    .orderBy(desc(dataSnapshotsTable.createdAt));
  const overflow = rows.slice(MAX_SNAPSHOTS);
  for (const row of overflow) {
    await db.delete(dataSnapshotsTable).where(eq(dataSnapshotsTable.id, row.id));
  }
}

export async function captureSnapshot(label: string, createdBy: string): Promise<SnapshotSummary> {
  const applicants = await db.select().from(applicantsTable);
  const interviewLabels = await getInterviewSettings();
  const charts = await db
    .select({
      source: dashboardChartsTable.source,
      chart: dashboardChartsTable.chart,
      position: dashboardChartsTable.position,
    })
    .from(dashboardChartsTable)
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
      label: cleanLabel,
      createdBy: createdBy === "assistant" ? "assistant" : "coordinator",
      applicantCount: applicants.length,
      payload: JSON.stringify(payload),
    })
    .returning();
  await enforceRetention();
  return summarize(row);
}

export async function listSnapshots(): Promise<SnapshotSummary[]> {
  const rows = await db
    .select()
    .from(dataSnapshotsTable)
    .orderBy(desc(dataSnapshotsTable.createdAt));
  return rows.map(summarize);
}

export async function diffSnapshot(id: string): Promise<{ summary: SnapshotSummary; diff: SnapshotDiff }> {
  const [row] = await db.select().from(dataSnapshotsTable).where(eq(dataSnapshotsTable.id, id));
  if (!row) throw new Error("Snapshot not found");
  const payload = parsePayload(row.payload);
  const current = await db.select().from(applicantsTable);
  const labelsNow = await getInterviewSettings();
  const labelsBefore = payload.interviewLabels;
  const chartsNow = (
    await db.select({ position: dashboardChartsTable.position }).from(dashboardChartsTable)
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
): Promise<{ restoredId: string; preRestoreId: string; applicantCount: number }> {
  const [row] = await db.select().from(dataSnapshotsTable).where(eq(dataSnapshotsTable.id, id));
  if (!row) throw new Error("Snapshot not found");
  const payload = parsePayload(row.payload);
  // Append-only history: the present is saved first, so restoring forward
  // and back is always possible.
  const pre = await captureSnapshot(`Before restoring "${row.label}"`, actor);
  await db.transaction(async (tx) => {
    await tx.delete(applicantsTable);
    for (const raw of payload.applicants) {
      const rec = raw as unknown as Record<string, unknown>;
      await tx.insert(applicantsTable).values({
        id: String(rec.id),
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
        category: String(rec.category ?? "unranked"),
        rank: typeof rec.rank === "number" ? rec.rank : 0,
        notes: String(rec.notes ?? ""),
        queuePosition: typeof rec.queuePosition === "number" ? rec.queuePosition : 0,
        createdAt: rec.createdAt ? new Date(String(rec.createdAt)) : new Date(),
        updatedAt: new Date(),
      });
    }
    await tx
      .insert(interviewQueueTable)
      .values({ id: 1, interviewerLabels: JSON.stringify(payload.interviewLabels) })
      .onConflictDoUpdate({
        target: interviewQueueTable.id,
        set: { interviewerLabels: JSON.stringify(payload.interviewLabels), updatedAt: new Date() },
      });
    await tx.delete(dashboardChartsTable);
    for (const chart of payload.charts) {
      await tx.insert(dashboardChartsTable).values({
        id: randomUUID(),
        source: chart.source,
        chart: chart.chart,
        position: chart.position,
      });
    }
  });
  return { restoredId: id, preRestoreId: pre.id, applicantCount: payload.applicants.length };
}
