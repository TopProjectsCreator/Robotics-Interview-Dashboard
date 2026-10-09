import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { db, applicantsTable, displaySettingsTable, interviewQueueTable, seatingSettingsTable, type Applicant } from "@workspace/db";
import { matchesApplicantSearch, normalizeApplicantGender, normalizeApplicantGrade, parseApplicantSearchQuery } from "./applicantSearch";

export const demoApplicants = [
  ["ef12e626-53cb-4da2-b4b9-298353c07a98", "TestUser", "6th", 0, "No", "Previous FLL experience but admitted to contributing nothing", "No", "No"],
  ["58054974-c229-4c14-9563-ed15b4e8969a", "Tester", "6th", 85, "Strong Yes", "Experience with mBot and Elegoo kits, including basic coding and physical assembly", "Yes", "Yes"],
  ["8e0cb896-6b25-4e0f-a493-bdd8a920320d", "Demo Applicant", "6th", -1, "No", "None provided; responses were nonsensical or antagonistic", "No", "Unclear"],
  ["d4ff3cbd-2cfe-4a68-b5af-6e90b32e9bf7", "Anonymous", "7th", 15, "No", "None", "No", "Yes"],
  ["4e3280c8-738e-47a8-a775-7c4229bd9d19", "hi", "7th", 5, "No", "None", "Unclear", "Unclear"],
  ["9b40960b-4edb-41dd-94db-d79dd8a246d5", "Demo Candidate", "6th", 15, "No", "Unknown; applicant refused to answer", "Unclear", "Unclear"],
  ["039cd7ed-0e18-46c4-9ded-ed276de59a53", "a", "7th", 20, "No", "No known experience", "Unclear", "Unclear"],
  ["3dfcf6f2-c91b-4d28-9035-3ee3acc619e7", "Demo Student", "7th", 95, "Strong Yes", "2 years of LEGO Mindstorms and VEX IQ with a focus on chassis and mechanical structures", "Yes", "Yes"],
] as const;

let demoChecked = false;

export async function ensureDemoData(): Promise<void> {
  if (demoChecked || process.env.DISABLE_DEMO_SEED === "true") return;
  const existing = await db.select({ id: applicantsTable.id }).from(applicantsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(applicantsTable).values(
      demoApplicants.map(([id, name, grade, aiScore, aiRecommendation, roboticsExperience, commit10Hours, parentVolunteer], index) => ({
        id,
        name,
        grade,
        aiScore,
        aiRecommendation,
        aiSummary: aiRecommendation === "Strong Yes" ? "A promising candidate with a clear learning mindset and evidence of practical robotics work." : "Review the application carefully during the interview.",
        aiStrengths: aiRecommendation === "Strong Yes" ? "hands-on building; problem-solving; commitment" : "Application review required",
        aiConcerns: aiScore < 0 ? "Invalid or bug score" : aiScore < 50 ? "Needs interview follow-up" : "",
        roboticsExperience,
        commit10Hours,
        parentVolunteer,
        category: aiRecommendation === "Strong Yes" ? "advance" : "hold",
        rank: index + 1,
        notes: "",
        queuePosition: index,
        interviewStatus: "queued",
         interviewer: "",
         interviewDecision: "Undecided",
         callbackRequested: false,
        transcript: null,
        email: null,
        attachments: null,
      })),
    ).onConflictDoNothing();
  }
  demoChecked = true;
}

export async function getApplicants(filters?: {
  search?: string;
  grade?: string;
  recommendation?: string;
  interviewStatus?: string;
  category?: string;
  invalidOnly?: boolean;
  sort?: string;
}): Promise<Applicant[]> {
  await ensureDemoData();
  const all = await db.select().from(applicantsTable).orderBy(asc(applicantsTable.queuePosition), asc(applicantsTable.rank));
  const searchQuery = parseApplicantSearchQuery(filters?.search?.trim() ?? "");
  const filtered = all.filter((applicant) => {
    if (!matchesApplicantSearch(applicant, searchQuery)) return false;
    if (filters?.grade && filters.grade !== "all" && normalizeApplicantGrade(applicant.grade) !== normalizeApplicantGrade(filters.grade)) return false;
    if (filters?.recommendation && filters.recommendation !== "all" && applicant.aiRecommendation !== filters.recommendation) return false;
    if (filters?.interviewStatus && filters.interviewStatus !== "all" && applicant.interviewStatus !== filters.interviewStatus) return false;
    if (filters?.category && filters.category !== "all" && applicant.category !== filters.category) return false;
    if (filters?.invalidOnly && applicant.aiScore !== -1) return false;
    return true;
  });
  const sort = filters?.sort ?? "queue";
  const gradeValue = (grade: string): number => {
    const parsed = Number.parseInt(grade, 10);
    return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
  };
  return filtered.sort((a, b) => {
    if (sort === "score") return b.aiScore - a.aiScore;
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "rank") return a.rank - b.rank;
    if (sort === "newest") return b.createdAt.getTime() - a.createdAt.getTime();
    if (sort === "oldest") return a.createdAt.getTime() - b.createdAt.getTime();
    if (sort === "grade") return gradeValue(a.grade) - gradeValue(b.grade) || a.name.localeCompare(b.name);
    return a.queuePosition - b.queuePosition;
  });
}

export function applicantResponse(applicant: Applicant) {
  return {
    id: applicant.id,
    name: applicant.name,
    grade: applicant.grade,
    age: applicant.age ?? null,
    gender: applicant.gender ?? null,
    email: applicant.email,
    photoUrl: applicant.photoUrl,
    transcript: applicant.transcript,
    aiScore: applicant.aiScore,
    aiRecommendation: applicant.aiRecommendation,
    aiSummary: applicant.aiSummary,
    aiStrengths: applicant.aiStrengths,
    aiConcerns: applicant.aiConcerns,
    roboticsExperience: applicant.roboticsExperience,
    commit10Hours: applicant.commit10Hours,
    parentVolunteer: applicant.parentVolunteer,
    interviewStatus: applicant.interviewStatus,
    interviewer: applicant.interviewer,
    interviewDecision: applicant.interviewDecision,
    callbackRequested: applicant.callbackRequested,
    flagged: applicant.flagged,
    attendance: applicant.attendance,
    lateArrivalTime: applicant.lateArrivalTime ?? null,
    makeupDate: applicant.makeupDate ?? null,
    attendanceExcused: applicant.attendanceExcused ?? null,
    seatRow: applicant.seatRow ?? null,
    seatCol: applicant.seatCol ?? null,
    category: applicant.category,
    rank: applicant.rank,
    notes: applicant.notes,
    queuePosition: applicant.queuePosition,
  };
}

export function queueApplicantResponse(applicant: Applicant) {
  return {
    id: applicant.id,
    name: applicant.name,
    grade: applicant.grade,
    aiScore: applicant.aiScore,
    category: applicant.category,
    queuePosition: applicant.queuePosition,
    interviewer: applicant.interviewer,
    notes: applicant.notes,
    interviewDecision: applicant.interviewDecision,
    callbackRequested: applicant.callbackRequested,
    flagged: applicant.flagged,
    attendance: applicant.attendance,
    lateArrivalTime: applicant.lateArrivalTime ?? null,
    makeupDate: applicant.makeupDate ?? null,
    attendanceExcused: applicant.attendanceExcused ?? null,
  };
}

function balancedCurrentApplicants(applicants: Applicant[], labels: string[]): Applicant[] {
  if (!labels.length) return applicants;
  const counts = new Map(labels.map((label) => [label, 0]));
  return applicants.map((applicant) => {
    const preferred = labels.includes(applicant.interviewer) && (counts.get(applicant.interviewer) ?? 0) === 0
      ? applicant.interviewer
      : [...counts.entries()].sort((a, b) => a[1] - b[1])[0][0];
    counts.set(preferred, (counts.get(preferred) ?? 0) + 1);
    return { ...applicant, interviewer: preferred };
  });
}

export type TransferPerson = { id: string; name: string; from: string };

export type TransferPreview = {
  ok: true;
  dryRun: boolean;
  from: string;
  to: string;
  moved: TransferPerson[];
};

export type TransferFailure = {
  ok: false;
  error: string;
  fromCanonical?: string;
  toCanonical?: string;
  matched?: TransferPerson[];
};

function normalizedLetters(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Anagram / typo-tolerant match for interviewer names: "Maksim" finds the
 * label "miskaM". Minimum length avoids trivial collisions on short names.
 */
function isNameVariant(a: string, b: string): boolean {
  const ka = normalizedLetters(a);
  const kb = normalizedLetters(b);
  if (!ka || !kb || ka === kb || ka.length < 3 || kb.length < 3) return false;
  if (ka.split("").sort().join("") === kb.split("").sort().join("")) return true;
  return editDistance(ka, kb) <= 2;
}

function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let curr = i;
    let rowMin = curr;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(prev[j] + 1, curr + 1, prev[j - 1] + cost);
      prev[j - 1] = curr;
      curr = next;
      if (next < rowMin) rowMin = next;
    }
    prev[b.length] = curr;
    if (rowMin > 2) return 3;
  }
  return prev[b.length];
}

/**
 * Move EVERY applicant currently carrying one interviewer value to another
 * label, atomically. `from` matches case-insensitively against both the
 * configured labels and the values actually stored on applicants (stale
 * free-text like "Maksim" still matches even when it is no longer a label),
 * and tolerates misspellings/anagrams ("Maksim" also finds label "miskaM") —
 * every spelling taken along is reported. `from` also accepts "everyone"
 * (every applicant holding any interviewer). `to` must match a configured
 * label — except "unassigned" (or empty), which clears the field — so
 * transfers can never recreate the stale-value mess; near-misses get a
 * did-you-mean instead of a silent guess. dryRun previews without writing.
 */
export async function transferInterviewers(
  fromRaw: string,
  toRaw: string,
  dryRun = false,
): Promise<TransferPreview | TransferFailure> {
  const from = fromRaw.trim();
  const to = toRaw.trim();
  if (!from) {
    return { ok: false, error: "A source interviewer is required." };
  }
  const labels = await getInterviewSettings();
  const byLabelLower = new Map(labels.map((label) => [label.toLowerCase(), label]));
  const applicants = await getApplicants({ sort: "queue" });
  const storedValues = new Map<string, string>();
  for (const applicant of applicants) {
    const value = (applicant.interviewer || "").trim();
    if (value && !storedValues.has(value.toLowerCase())) {
      storedValues.set(value.toLowerCase(), value);
    }
  }
  // "everyone" as a source means every applicant holding any interviewer.
  const matchAll = ["*", "all", "everyone", "everybody"].includes(from.toLowerCase());
  // "unassigned" (or an empty string) as a destination clears the field.
  const clearTo = ["", "unassigned", "none", "unassign", "clear", "cleared"].includes(to.toLowerCase());
  if (!matchAll && from.toLowerCase() === to.toLowerCase()) {
    return { ok: false, error: `"${from}" and "${to}" are the same interviewer — nothing to transfer.` };
  }
  const fromKey = from.toLowerCase();
  const fromCanonical = matchAll ? "everyone" : (byLabelLower.get(fromKey) ?? storedValues.get(fromKey) ?? from);
  const toCanonical = clearTo ? "" : byLabelLower.get(to.toLowerCase());
  if (toCanonical === undefined) {
    const suggestions = labels.filter(
      (label) => isNameVariant(label, to) || label.toLowerCase().startsWith(to.toLowerCase().slice(0, 3)),
    );
    const hint = suggestions.length > 0 ? ` Did you mean "${suggestions[0]}"?` : "";
    return { ok: false, error: `"${to}" is not a valid interviewer label (valid: ${labels.join(", ")}).${hint} Nothing was changed.` };
  }
  const toDisplay = clearTo ? "unassigned" : toCanonical;
  // Exact matches plus spelling variants (anagrams/typos like "miskaM" for
  // "Maksim"), deduped by applicant — the coordinator sees every spelling.
  const seen = new Set<string>();
  const matched: TransferPerson[] = [];
  for (const applicant of applicants) {
    const stored = (applicant.interviewer || "").trim();
    if (!stored || seen.has(applicant.id)) continue;
    const storedKey = stored.toLowerCase();
    if (matchAll || storedKey === fromKey || isNameVariant(stored, from) || isNameVariant(byLabelLower.get(storedKey) ?? stored, from)) {
      seen.add(applicant.id);
      matched.push({ id: applicant.id, name: applicant.name, from: stored });
    }
  }
  // A label that exists but currently holds nobody is still worth reporting.
  if (matched.length === 0) {
    const known = [...new Set([...labels, ...storedValues.values()])].join(", ");
    const knownMatch = byLabelLower.has(fromKey) || storedValues.has(fromKey);
    return {
      ok: false,
      error: knownMatch
        ? `Nobody is currently assigned to "${fromCanonical}" — nothing to transfer.`
        : `Nobody is assigned to "${from}". Known interviewer values: ${known || "none"}.`,
      fromCanonical,
      toCanonical,
      matched: [],
    };
  }
  if (!dryRun) {
    await db.transaction(async (tx) => {
      for (const person of matched) {
        await tx
          .update(applicantsTable)
          .set({ interviewer: toCanonical, updatedAt: new Date() })
          .where(eq(applicantsTable.id, person.id));
      }
    });
  }
  return { ok: true, dryRun, from: fromCanonical, to: toDisplay, moved: matched };
}

export function displayApplicantName(name: string): string {
  const trimmed = name.trim();
  return !trimmed || trimmed.length > 48 || /https?:\/\//i.test(trimmed) || /@/.test(trimmed) ? "Applicant" : trimmed;
}

/**
 * Spoken big-screen announcement: one "Name please go to Interviewer"
 * sentence per called applicant ("Dillan please go to Maksim"). This is the
 * single source of truth — both the server TTS endpoint and the display's
 * on-device fallback speak exactly this text.
 */
export function buildAnnouncementText(
  applicants: { name: string; interviewer: string; callbackRequested: boolean }[],
): string {
  const desk = (interviewer: string) => interviewer.trim().slice(0, 30) || "your interviewer";
  const firstName = (name: string) => displayApplicantName(name).split(/\s+/)[0] || "Applicant";
  const recalled = applicants.filter((applicant) => applicant.callbackRequested);
  if (recalled.length) {
    return recalled.map((a) => `${firstName(a.name)} please go back to ${desk(a.interviewer)}`).join(". ") + ".";
  }
  if (applicants.length) {
    return applicants.map((a) => `${firstName(a.name)} please go to ${desk(a.interviewer)}`).join(". ") + ".";
  }
  return "The interview block is complete. Thank you for coming to the robotics tryouts.";
}

export interface DisplaySettingsState {
  customHeadline: string | null;
  customSubheadline: string | null;
  showNames: boolean;
  announce: boolean;
}

const DEFAULT_DISPLAY_SETTINGS: DisplaySettingsState = {
  customHeadline: null,
  customSubheadline: null,
  showNames: true,
  announce: true,
};

export async function getDisplaySettings(): Promise<DisplaySettingsState> {
  const [row] = await db.select().from(displaySettingsTable).limit(1);
  if (!row) return { ...DEFAULT_DISPLAY_SETTINGS };
  return {
    customHeadline: row.customHeadline?.trim() ? row.customHeadline : null,
    customSubheadline: row.customSubheadline?.trim() ? row.customSubheadline : null,
    showNames: row.showNames,
    announce: row.announce,
  };
}

export function displaySettingsResponse(row: {
  customHeadline: string | null;
  customSubheadline: string | null;
  showNames: boolean;
  announce: boolean;
  updatedAt: Date;
}) {
  return {
    headline: row.customHeadline,
    subheadline: row.customSubheadline,
    showNames: row.showNames,
    announce: row.announce,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * What the big screen shows and says. Custom coordinator text wins when set
 * (and then the spoken announcement IS the custom text); otherwise the
 * automatic headline plus the per-applicant "Name please go to Interviewer"
 * call-out. Pills visibility never affects speech — the announce switch does.
 */
export function resolveDisplaySpeech(
  autoHeadline: string,
  autoSubheadline: string,
  queueApplicants: { name: string; interviewer: string; callbackRequested: boolean }[],
  settings: DisplaySettingsState,
): { headline: string; subheadline: string; announcement: string } {
  const headline = settings.customHeadline?.trim() || autoHeadline;
  const subheadline = settings.customSubheadline?.trim() || autoSubheadline;
  const custom = Boolean(settings.customHeadline?.trim() || settings.customSubheadline?.trim());
  return {
    headline,
    subheadline,
    announcement: custom ? `${headline}. ${subheadline}.` : buildAnnouncementText(queueApplicants),
  };
}

export function humanList(names: string[]): string {
  if (names.length > 2) return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
  return names.join(" and ");
}

export interface DisplayView {
  mode: string;
  headline: string;
  subheadline: string;
  announcement: string;
  currentApplicants: { id: string; name: string; grade: string; lane: string }[];
  updatedAt: string;
}

/** Everything the big screen shows and says, before pill visibility is applied. */
export async function getDisplayView(): Promise<DisplayView> {
  const queue = await getQueueState();
  const settings = await getDisplaySettings();
  const mapped = queue.currentApplicants.map((applicant, index) => ({
    id: applicant.id,
    name: displayApplicantName(applicant.name),
    grade: applicant.grade,
    lane: applicant.interviewer || queue.interviewerLabels[index % queue.interviewerLabels.length] || "Your interviewer",
  }));
  const recalled = queue.currentApplicants
    .filter((applicant) => applicant.callbackRequested)
    .map((applicant) => displayApplicantName(applicant.name));
  const isCallback = recalled.length > 0;
  const autoHeadline = isCallback
    ? "Please return to your interviewer"
    : mapped.length ? "Please come to your corresponding interviewer" : "Interview block complete";
  const autoSubheadline = isCallback
    ? `${humanList(recalled)} — we aren't done with you yet, please come back`
    : mapped.length ? "Your Wolverines interview team is ready for you" : "Thank you for showing up and building boldly";
  const speech = resolveDisplaySpeech(autoHeadline, autoSubheadline, queue.currentApplicants, settings);
  return {
    mode: isCallback ? "callback" : mapped.length ? "calling" : "complete",
    headline: speech.headline,
    subheadline: speech.subheadline,
    announcement: speech.announcement,
    currentApplicants: mapped,
    updatedAt: queue.updatedAt,
  };
}

export interface SeatingSettingsState {
  rows: number;
  cols: number;
}

export async function getSeatingSettings(): Promise<SeatingSettingsState> {
  const [row] = await db.select().from(seatingSettingsTable).limit(1);
  return {
    rows: Math.min(10, Math.max(1, row?.rows ?? 4)),
    cols: Math.min(10, Math.max(1, row?.cols ?? 6)),
  };
}

export function seatingSettingsResponse(row: { rows: number; cols: number; updatedAt: Date }) {
  return {
    rows: row.rows,
    cols: row.cols,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Seat an applicant. row/col < 0 unseats. When the target seat is taken the
 * occupant swaps into the moved applicant's old seat (or becomes unseated).
 * Returns the updated applicant row, or null when the id is unknown.
 */
export async function assignSeat(applicantId: string, row: number, col: number) {
  if (row < 0 || col < 0) {
    const [cleared] = await db
      .update(applicantsTable)
      .set({ seatRow: null, seatCol: null, updatedAt: new Date() })
      .where(eq(applicantsTable.id, applicantId))
      .returning();
    return cleared ?? null;
  }
  const [me] = await db.select().from(applicantsTable).where(eq(applicantsTable.id, applicantId));
  if (!me) return null;
  const [occupant] = await db
    .select({ id: applicantsTable.id })
    .from(applicantsTable)
    .where(and(eq(applicantsTable.seatRow, row), eq(applicantsTable.seatCol, col)));
  if (occupant && occupant.id !== applicantId) {
    await db
      .update(applicantsTable)
      .set({ seatRow: me.seatRow, seatCol: me.seatCol, updatedAt: new Date() })
      .where(eq(applicantsTable.id, occupant.id));
  }
  const [updated] = await db
    .update(applicantsTable)
    .set({ seatRow: row, seatCol: col, updatedAt: new Date() })
    .where(eq(applicantsTable.id, applicantId))
    .returning();
  return updated ?? null;
}

export async function getInterviewSettings(): Promise<string[]> {
  let [settings] = await db.select().from(interviewQueueTable);
  if (!settings) {
    await db.insert(interviewQueueTable).values({ id: 1 }).onConflictDoNothing();
    [settings] = await db.select().from(interviewQueueTable);
  }
  try {
    const labels = JSON.parse(settings?.interviewerLabels ?? "[]");
    if (Array.isArray(labels) && labels.every((label) => typeof label === "string") && labels.length > 0) {
      return labels.map((label) => label.trim()).filter(Boolean);
    }
  } catch {
    // Recover to the default labels if an old row contains malformed JSON.
  }
  return ["Interviewer 1", "Interviewer 2"];
}

export async function getQueueState() {
  const applicants = await getApplicants({ sort: "queue" });
  const remaining = applicants.filter((applicant) => applicant.interviewStatus !== "completed");
  const completedCount = applicants.filter((applicant) => applicant.interviewStatus === "completed").length;
  const interviewerLabels = await getInterviewSettings();
  // One active interview slot per interviewer label, plus an equal-sized bench.
  const slotCount = Math.max(1, interviewerLabels.length);
  const nextApplicants = remaining.slice(slotCount, slotCount * 2);
  const currentApplicants = balancedCurrentApplicants(remaining.slice(0, slotCount), interviewerLabels);
  // Sticky interviewers: the first label an applicant receives is persisted,
  // so nobody rotates through interviewers as the queue advances. Labels a
  // coordinator set by hand (or assigned on a previous poll) are never touched.
  const storedById = new Map(remaining.map((applicant) => [applicant.id, applicant.interviewer]));
  for (const applicant of currentApplicants) {
    if (!storedById.get(applicant.id) && applicant.interviewer) {
      await db.update(applicantsTable).set({
        interviewer: applicant.interviewer,
        updatedAt: new Date(),
      }).where(eq(applicantsTable.id, applicant.id));
    }
  }
  const latestUpdatedAt = applicants.reduce(
    (latest, applicant) => Math.max(latest, applicant.updatedAt.getTime()),
    0,
  );
  return {
    currentApplicants: currentApplicants.map(queueApplicantResponse),
    nextApplicants: nextApplicants.map(queueApplicantResponse),
    interviewerLabels,
    completedCount,
    remainingCount: remaining.length,
    updatedAt: new Date(latestUpdatedAt || Date.now()).toISOString(),
  };
}

function splitLogicalRecords(input: string): { records: string[]; unclosedQuote: boolean } {
  const records: string[] = [];
  let record = "";
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    const next = input[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        record += '""';
        index += 1;
      } else {
        quoted = !quoted;
        record += char;
      }
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      if (record.trim() !== "") records.push(record);
      record = "";
    } else {
      record += char;
    }
  }
  if (record.trim() !== "") records.push(record);
  return { records, unclosedQuote: quoted };
}

function parseRecord(record: string, delimiter: string): string[] {
  const values: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < record.length; index += 1) {
    const char = record[index];
    const next = record[index + 1];
    if (char === '"') {
      if (quoted && next === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      values.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  values.push(cell);
  return values;
}

function detectDelimiter(header: string): string {
  return [",", ";", "\t"]
    .map((delimiter) => ({ delimiter, count: parseRecord(header, delimiter).length }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

export function parseSemicolonCsv(input: string): { headers: string[]; rows: string[][]; warnings: string[]; delimiter: string } {
  const warnings: string[] = [];
  const { records, unclosedQuote } = splitLogicalRecords(input);
  if (unclosedQuote) warnings.push("The file ended with an open quote; the last row was recovered as best as possible.");
  const headerRecord = records.shift() ?? "";
  const delimiter = detectDelimiter(headerRecord);
  const normalizeHeader = (header: string) =>
    header.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
  const headers = parseRecord(headerRecord, delimiter).map(normalizeHeader);
  const candidates = [delimiter, ",", ";", "\t"].filter((value, index, array) => array.indexOf(value) === index);
  const rows = records.flatMap((record, index) => {
    const parsed = candidates
      .map((candidate) => ({ candidate, values: parseRecord(record, candidate) }))
      .sort((a, b) => Number(b.values.length === headers.length) - Number(a.values.length === headers.length) || Math.abs(a.values.length - headers.length) - Math.abs(b.values.length - headers.length))[0];
    if (!parsed || parsed.values.length !== headers.length) {
      warnings.push(`Row ${index + 2} has ${parsed?.values.length ?? 0} fields; expected ${headers.length}.`);
      return [];
    }
    return [parsed.values];
  });
  return { headers, rows, warnings, delimiter: delimiter === "\t" ? "tab" : delimiter };
}

export function importDiff(
  imported: ReturnType<typeof csvToApplicant>[],
  existing: Applicant[],
  importedFields: { age: boolean; gender: boolean } = { age: true, gender: true },
): { added: number; updated: number; unchanged: number; missingFromUpload: number } {
  const existingById = new Map(existing.map((applicant) => [applicant.id, applicant]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  for (const applicant of imported) {
    const previous = existingById.get(applicant.id);
    if (!previous) {
      added += 1;
      continue;
    }
    const fields = [
      "name",
      "grade",
      ...(importedFields.age ? ["age" as const] : []),
      ...(importedFields.gender ? ["gender" as const] : []),
      "email",
      "transcript",
      "aiScore",
      "aiRecommendation",
      "aiSummary",
      "aiStrengths",
      "aiConcerns",
      "roboticsExperience",
      "commit10Hours",
      "parentVolunteer",
    ] as const;
    if (fields.some((field) => previous[field] !== applicant[field])) updated += 1;
    else unchanged += 1;
  }
  return {
    added,
    updated,
    unchanged,
    missingFromUpload: existing.filter((applicant) => !imported.some((row) => row.id === applicant.id)).length,
  };
}

export function normalizeAiScore(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === -1) return -1;
    return Math.min(100, Math.max(0, Math.round(value)));
  }
  if (typeof value !== "string" || value.trim() === "") return -1;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return -1;
  if (parsed === -1) return -1;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function csvToApplicant(values: string[], headers: string[], queuePosition: number) {
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  const ageValue = record.age || record.applicant_age || record.student_age || "";
  const parsedAge = ageValue.trim() === "" ? null : Number.parseInt(ageValue.trim(), 10);
  const genderValue = record.gender || record.sex || record.applicant_gender || record.gender_identity || "";
  return {
    id: record.id || randomUUID(),
    name: record.name || "Unnamed applicant",
    grade: record.grade || "Unknown",
    age: parsedAge !== null && Number.isInteger(parsedAge) && parsedAge >= 0 ? parsedAge : null,
    gender: normalizeApplicantGender(genderValue),
    email: record.email || null,
    transcript: record.transcript || null,
    attachments: record.attachments || null,
    aiScore: normalizeAiScore(record.ai_score),
    aiRecommendation: record.ai_recommendation || "Review",
    aiSummary: record.ai_summary || "",
    aiStrengths: record.ai_strengths || "",
    aiConcerns: record.ai_concerns || "",
    roboticsExperience: record.robotics_experience || "",
    commit10Hours: record.commit_10_hours || "Unclear",
    parentVolunteer: record.parent_volunteer || "Unclear",
    interviewStatus: "queued",
    interviewer: "",
    interviewDecision: "Undecided",
    callbackRequested: false,
    attendance: ["unmarked", "here", "absent", "late"].includes((record.attendance || "").trim().toLowerCase())
      ? (record.attendance || "").trim().toLowerCase()
      : "unmarked",
    category: "unranked",
    rank: queuePosition + 1,
    notes: record.notes || "",
    queuePosition,
  };
}
