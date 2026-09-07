import { randomUUID } from "node:crypto";
import { asc } from "drizzle-orm";
import { db, applicantsTable, type Applicant } from "@workspace/db";

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
  if (demoChecked) return;
  const existing = await db.select({ id: applicantsTable.id }).from(applicantsTable).limit(1);
  if (existing.length === 0) {
    await db.insert(applicantsTable).values(
      demoApplicants.map(([id, name, grade, aiScore, aiRecommendation, roboticsExperience, commit10Hours, parentVolunteer], index) => ({
        id,
        name,
        grade,
        aiScore,
        aiRecommendation,
        aiSummary: aiRecommendation === "Strong Yes" ? "A promising candidate with a clear learning mindset and evidence of practical robotics work." : "Review the application carefully during the coordinator interview.",
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
  const filtered = all.filter((applicant) => {
    const query = filters?.search?.trim().toLowerCase();
    if (query && !`${applicant.name} ${applicant.id}`.toLowerCase().includes(query)) return false;
    if (filters?.grade && filters.grade !== "all" && applicant.grade !== filters.grade) return false;
    if (filters?.recommendation && filters.recommendation !== "all" && applicant.aiRecommendation !== filters.recommendation) return false;
    if (filters?.interviewStatus && filters.interviewStatus !== "all" && applicant.interviewStatus !== filters.interviewStatus) return false;
    if (filters?.category && filters.category !== "all" && applicant.category !== filters.category) return false;
    if (filters?.invalidOnly && applicant.aiScore !== -1) return false;
    return true;
  });
  const sort = filters?.sort ?? "queue";
  return filtered.sort((a, b) => {
    if (sort === "score") return b.aiScore - a.aiScore;
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "rank") return a.rank - b.rank;
    return a.queuePosition - b.queuePosition;
  });
}

export function applicantResponse(applicant: Applicant) {
  return {
    id: applicant.id,
    name: applicant.name,
    grade: applicant.grade,
    email: applicant.email,
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
  };
}

export async function getQueueState() {
  const applicants = await getApplicants({ sort: "queue" });
  const remaining = applicants.filter((applicant) => applicant.interviewStatus !== "completed");
  const currentPair = remaining.slice(0, 2);
  const nextPair = remaining.slice(2, 4);
  const completedCount = applicants.filter((applicant) => applicant.interviewStatus === "completed").length;
  const latestUpdatedAt = applicants.reduce(
    (latest, applicant) => Math.max(latest, applicant.updatedAt.getTime()),
    0,
  );
  return {
    currentPair: currentPair.map(queueApplicantResponse),
    nextPair: nextPair.map(queueApplicantResponse),
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
  const headers = parseRecord(headerRecord, delimiter).map((header) => header.trim());
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
    const fields = ["name", "grade", "email", "transcript", "aiScore", "aiRecommendation", "aiSummary", "aiStrengths", "aiConcerns", "roboticsExperience", "commit10Hours", "parentVolunteer"] as const;
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

export function csvToApplicant(values: string[], headers: string[], queuePosition: number) {
  const record = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  const rawScore = Number(record.ai_score);
  return {
    id: record.id || randomUUID(),
    name: record.name || "Unnamed applicant",
    grade: record.grade || "Unknown",
    email: record.email || null,
    transcript: record.transcript || null,
    attachments: record.attachments || null,
    aiScore: Number.isFinite(rawScore) ? rawScore : -1,
    aiRecommendation: record.ai_recommendation || "Review",
    aiSummary: record.ai_summary || "",
    aiStrengths: record.ai_strengths || "",
    aiConcerns: record.ai_concerns || "",
    roboticsExperience: record.robotics_experience || "",
    commit10Hours: record.commit_10_hours || "Unclear",
    parentVolunteer: record.parent_volunteer || "Unclear",
    interviewStatus: "queued",
    category: "unranked",
    rank: queuePosition + 1,
    notes: "",
    queuePosition,
  };
}
