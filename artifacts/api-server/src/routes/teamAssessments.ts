import { randomUUID } from "node:crypto";
import { and, asc, count, eq, notExists, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateTeamAssessmentBody,
  CreateTeamAssessmentResponse,
  GetRequiredTeamAssessmentsResponse,
  GetTeamAssessmentParams,
  GetTeamAssessmentResponse,
  GetTeamAssessmentResultsParams,
  GetTeamAssessmentResultsResponse,
  ListTeamAssessmentsResponse,
  PauseTeamAssessmentParams,
  PauseTeamAssessmentResponse,
  PublishTeamAssessmentParams,
  PublishTeamAssessmentResponse,
  RequestTeamAssessmentUploadUrlBody,
  RequestTeamAssessmentUploadUrlParams,
  RequestTeamAssessmentUploadUrlResponse,
  SubmitTeamAssessmentBody,
  SubmitTeamAssessmentParams,
  SubmitTeamAssessmentResponse,
  UpdateTeamAssessmentBody,
  UpdateTeamAssessmentParams,
  UpdateTeamAssessmentResponse,
} from "@workspace/api-zod";
import {
  db,
  interviewerAccountsTable,
  teamAssessmentAssignmentsTable,
  teamAssessmentsTable,
  teamAssessmentSubmissionsTable,
  type TeamAssessmentQuestion,
} from "@workspace/db";
import { teamFilter } from "../lib/teams";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  TEAM_ASSESSMENT_MAX_FILE_BYTES,
  TEAM_ASSESSMENT_MAX_TOTAL_FILE_BYTES,
  validateTeamAssessmentAnswers,
  validateTeamAssessmentQuestions,
} from "../lib/teamAssessmentRules";
import {
  authenticatedInterviewerId,
  requestTeamId,
  requireAdmin,
  requireCoordinator,
} from "../middlewares/adminAuth";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();
const allowedFileTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
  "application/csv",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function rowToAssessment(row: typeof teamAssessmentsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    kind: row.kind,
    status: row.status,
    required: row.required,
    stylePreset: row.stylePreset,
    questions: row.questions,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function memberAssessment(row: typeof teamAssessmentsTable.$inferSelect) {
  return {
    ...rowToAssessment(row),
    questions: row.questions.map(({ correctAnswers: _correctAnswers, ...question }) => question),
  };
}

function assessmentIdFromParams(params: Record<string, unknown>): string | null {
  const parsed = GetTeamAssessmentParams.safeParse(params);
  return parsed.success ? parsed.data.assessmentId : null;
}

async function assessmentForTeam(id: string, teamId: string) {
  const [row] = await db.select().from(teamAssessmentsTable)
    .where(and(eq(teamAssessmentsTable.id, id), eq(teamAssessmentsTable.teamId, teamId)))
    .limit(1);
  return row;
}

async function assignAssessmentToTeam(assessmentId: string, teamId: string): Promise<void> {
  await reconcileAssessmentAssignments(teamId, { assessmentId });
}

// One anti-joined insert also covers members who joined after publication.
async function reconcileAssessmentAssignments(
  teamId: string,
  options: { assessmentId?: string; interviewerId?: string } = {},
): Promise<void> {
  await db.execute(sql`
    insert into team_assessment_assignments (id, team_id, assessment_id, interviewer_id)
    select gen_random_uuid()::text, ${teamId}, a.id, m.id
    from team_assessments a
    join interviewer_accounts m on (m.team_id = ${teamId} or (${teamId} = 'default' and m.team_id is null))
    where a.team_id = ${teamId} and a.status = 'published'
      ${options.assessmentId ? sql`and a.id = ${options.assessmentId}` : sql``}
      ${options.interviewerId ? sql`and m.id = ${options.interviewerId} and a.required = true
        and not exists (select 1 from team_assessment_submissions s
          where s.team_id = ${teamId} and s.assessment_id = a.id and s.interviewer_id = m.id)` : sql``}
      and not exists (select 1 from team_assessment_assignments x
        where x.assessment_id = a.id and x.interviewer_id = m.id)
    on conflict do nothing
  `);
}

function summarizeAnswer(question: TeamAssessmentQuestion, rawValue: unknown): string[] {
  if (question.type === "long_answer") return ["Text response submitted"];
  if (question.type === "file_upload") return Array.isArray(rawValue) && rawValue.length ? ["File submitted"] : [];
  if (question.type === "ranking" && Array.isArray(rawValue)) {
    return rawValue.map((value, index) => `${index + 1}. ${String(value)}`);
  }
  if (Array.isArray(rawValue)) return rawValue.filter((value): value is string | number => typeof value === "string" || typeof value === "number").map(String);
  if (typeof rawValue === "string" || typeof rawValue === "number") return [String(rawValue)];
  return [];
}

router.get("/team-assessments/required", requireAdmin, async (req, res): Promise<void> => {
  const interviewerId = authenticatedInterviewerId(req);
  if (!interviewerId) {
    res.status(401).json({ error: "Interviewer session is invalid" });
    return;
  }
  const role = (req as typeof req & { interviewerRole?: string }).interviewerRole;
  if (role === "coordinator" || role === "admin") {
    res.json(GetRequiredTeamAssessmentsResponse.parse({ items: [] }));
    return;
  }
  const teamId = await requestTeamId(req);
  await reconcileAssessmentAssignments(teamId, { interviewerId });
  const assessments = await db.select().from(teamAssessmentsTable)
    .where(and(
      eq(teamAssessmentsTable.teamId, teamId),
      eq(teamAssessmentsTable.status, "published"),
      eq(teamAssessmentsTable.required, true),
      notExists(db.select({ id: teamAssessmentSubmissionsTable.id })
        .from(teamAssessmentSubmissionsTable).where(and(
          eq(teamAssessmentSubmissionsTable.teamId, teamId),
          eq(teamAssessmentSubmissionsTable.assessmentId, teamAssessmentsTable.id),
          eq(teamAssessmentSubmissionsTable.interviewerId, interviewerId),
        ))),
    )).orderBy(asc(teamAssessmentsTable.createdAt));
  res.json(GetRequiredTeamAssessmentsResponse.parse({
    items: assessments.map(memberAssessment),
  }));
});

router.get("/team-assessments", requireCoordinator, async (req, res): Promise<void> => {
  const teamId = await requestTeamId(req);
  await reconcileAssessmentAssignments(teamId);
  const assessments = await db.select().from(teamAssessmentsTable)
    .where(eq(teamAssessmentsTable.teamId, teamId))
    .orderBy(asc(teamAssessmentsTable.createdAt));
  const [assignments, submissions] = await Promise.all([
    db.select({ assessmentId: teamAssessmentAssignmentsTable.assessmentId, count: count() }).from(teamAssessmentAssignmentsTable)
      .where(eq(teamAssessmentAssignmentsTable.teamId, teamId)).groupBy(teamAssessmentAssignmentsTable.assessmentId),
    db.select({ assessmentId: teamAssessmentSubmissionsTable.assessmentId, count: count() }).from(teamAssessmentSubmissionsTable)
      .where(eq(teamAssessmentSubmissionsTable.teamId, teamId)).groupBy(teamAssessmentSubmissionsTable.assessmentId),
  ]);
  const assignedCounts = new Map<string, number>();
  const responseCounts = new Map<string, number>();
  for (const assignment of assignments) assignedCounts.set(assignment.assessmentId, assignment.count);
  for (const submission of submissions) responseCounts.set(submission.assessmentId, submission.count);
  res.json(ListTeamAssessmentsResponse.parse({
    items: assessments.map((assessment) => ({
      ...rowToAssessment(assessment),
      assignedCount: assignedCounts.get(assessment.id) ?? 0,
      responseCount: responseCounts.get(assessment.id) ?? 0,
    })),
  }));
});

router.post("/team-assessments", requireCoordinator, async (req, res): Promise<void> => {
  const parsed = CreateTeamAssessmentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Assessment details are invalid." });
    return;
  }
  const body = parsed.data;
  if (!body.required) {
    res.status(400).json({ error: "Team assessments must be required when published." });
    return;
  }
  try {
    validateTeamAssessmentQuestions(body.questions as TeamAssessmentQuestion[], body.kind);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Questions are invalid." });
    return;
  }
  const interviewerId = authenticatedInterviewerId(req);
  if (!interviewerId) {
    res.status(401).json({ error: "Interviewer session is invalid" });
    return;
  }
  const teamId = await requestTeamId(req);
  const [row] = await db.insert(teamAssessmentsTable).values({
    id: randomUUID(),
    teamId,
    title: body.title.trim(),
    description: body.description.trim(),
    kind: body.kind,
    status: "draft",
    required: true,
    stylePreset: body.stylePreset,
    questions: body.questions as TeamAssessmentQuestion[],
    createdBy: interviewerId,
  }).returning();
  if (!row) {
    res.status(500).json({ error: "Could not create the assessment." });
    return;
  }
  res.status(201).json(CreateTeamAssessmentResponse.parse(rowToAssessment(row)));
});

router.get("/team-assessments/:assessmentId", requireCoordinator, async (req, res): Promise<void> => {
  const id = assessmentIdFromParams(req.params);
  if (!id) {
    res.status(400).json({ error: "Assessment ID is invalid." });
    return;
  }
  const row = await assessmentForTeam(id, await requestTeamId(req));
  if (!row) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  res.json(GetTeamAssessmentResponse.parse(rowToAssessment(row)));
});

router.put("/team-assessments/:assessmentId", requireCoordinator, async (req, res): Promise<void> => {
  const params = UpdateTeamAssessmentParams.safeParse(req.params);
  const parsed = UpdateTeamAssessmentBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Assessment details are invalid." });
    return;
  }
  const body = parsed.data;
  if (!body.required) {
    res.status(400).json({ error: "Team assessments must remain required." });
    return;
  }
  try {
    validateTeamAssessmentQuestions(body.questions as TeamAssessmentQuestion[], body.kind);
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Questions are invalid." });
    return;
  }
  const teamId = await requestTeamId(req);
  const existing = await assessmentForTeam(params.data.assessmentId, teamId);
  if (!existing) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  if (existing.status === "published") {
    res.status(409).json({ error: "Pause the assessment before editing it." });
    return;
  }
  const [existingSubmission] = await db.select({ id: teamAssessmentSubmissionsTable.id })
    .from(teamAssessmentSubmissionsTable)
    .where(and(
      eq(teamAssessmentSubmissionsTable.assessmentId, existing.id),
      eq(teamAssessmentSubmissionsTable.teamId, teamId),
    )).limit(1);
  if (existingSubmission) {
    res.status(409).json({ error: "An assessment with submitted responses can no longer be edited." });
    return;
  }
  const [row] = await db.update(teamAssessmentsTable).set({
    title: body.title.trim(),
    description: body.description.trim(),
    kind: body.kind,
    required: true,
    stylePreset: body.stylePreset,
    questions: body.questions as TeamAssessmentQuestion[],
    updatedAt: new Date(),
  }).where(and(eq(teamAssessmentsTable.id, existing.id), eq(teamAssessmentsTable.teamId, teamId))).returning();
  if (!row) {
    res.status(500).json({ error: "Could not save the assessment." });
    return;
  }
  res.json(UpdateTeamAssessmentResponse.parse(rowToAssessment(row)));
});

router.post("/team-assessments/:assessmentId/publish", requireCoordinator, async (req, res): Promise<void> => {
  const params = PublishTeamAssessmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Assessment ID is invalid." });
    return;
  }
  const teamId = await requestTeamId(req);
  const existing = await assessmentForTeam(params.data.assessmentId, teamId);
  if (!existing) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  if (existing.status === "published") {
    res.status(409).json({ error: "This assessment is already published." });
    return;
  }
  try {
    validateTeamAssessmentQuestions(existing.questions, existing.kind as "quiz" | "survey");
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Questions are invalid." });
    return;
  }
  const [row] = await db.update(teamAssessmentsTable).set({
    status: "published",
    required: true,
    updatedAt: new Date(),
  }).where(and(eq(teamAssessmentsTable.id, existing.id), eq(teamAssessmentsTable.teamId, teamId))).returning();
  if (!row) {
    res.status(500).json({ error: "Could not publish the assessment." });
    return;
  }
  await assignAssessmentToTeam(row.id, teamId);
  res.json(PublishTeamAssessmentResponse.parse(rowToAssessment(row)));
});

router.post("/team-assessments/:assessmentId/pause", requireCoordinator, async (req, res): Promise<void> => {
  const params = PauseTeamAssessmentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Assessment ID is invalid." });
    return;
  }
  const teamId = await requestTeamId(req);
  const existing = await assessmentForTeam(params.data.assessmentId, teamId);
  if (!existing) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  if (existing.status !== "published") {
    res.status(409).json({ error: "Only published assessments can be paused." });
    return;
  }
  const [row] = await db.update(teamAssessmentsTable).set({
    status: "paused",
    updatedAt: new Date(),
  }).where(and(eq(teamAssessmentsTable.id, existing.id), eq(teamAssessmentsTable.teamId, teamId))).returning();
  if (!row) {
    res.status(500).json({ error: "Could not pause the assessment." });
    return;
  }
  res.json(PauseTeamAssessmentResponse.parse(rowToAssessment(row)));
});

router.get("/team-assessments/:assessmentId/results", requireCoordinator, async (req, res): Promise<void> => {
  const params = GetTeamAssessmentResultsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Assessment ID is invalid." });
    return;
  }
  const teamId = await requestTeamId(req);
  const assessment = await assessmentForTeam(params.data.assessmentId, teamId);
  if (!assessment) {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  if (assessment.status === "published") await assignAssessmentToTeam(assessment.id, teamId);
  const [members, assignments, submissions] = await Promise.all([
    db.select({ id: interviewerAccountsTable.id, displayName: interviewerAccountsTable.displayName })
      .from(interviewerAccountsTable).where(teamFilter(interviewerAccountsTable.teamId, teamId)),
    db.select({ interviewerId: teamAssessmentAssignmentsTable.interviewerId })
      .from(teamAssessmentAssignmentsTable)
      .where(and(eq(teamAssessmentAssignmentsTable.teamId, teamId), eq(teamAssessmentAssignmentsTable.assessmentId, assessment.id))),
    db.select().from(teamAssessmentSubmissionsTable)
      .where(and(eq(teamAssessmentSubmissionsTable.teamId, teamId), eq(teamAssessmentSubmissionsTable.assessmentId, assessment.id))),
  ]);
  const submissionsByMember = new Map(submissions.map((submission) => [submission.interviewerId, submission]));
  const memberNames = new Map(members.map((member) => [member.id, member.displayName]));
  const completions = assignments.map(({ interviewerId }) => {
    const submission = submissionsByMember.get(interviewerId);
    return {
      interviewerId,
      memberName: memberNames.get(interviewerId) ?? "Former team member",
      status: submission ? "submitted" : "pending",
      score: submission?.score ?? null,
      maxScore: submission?.maxScore ?? null,
      submittedAt: submission?.submittedAt ?? null,
      answers: submission?.answers ?? null,
    };
  });
  const summaryCounts = new Map<string, Map<string, number>>();
  const answeredCounts = new Map<string, number>();
  for (const submission of submissions) {
    for (const question of assessment.questions) {
      const raw = submission.answers[question.id];
      if (!raw || typeof raw !== "object") continue;
      const values = summarizeAnswer(question, raw.value);
      if (!values.length) continue;
      answeredCounts.set(question.id, (answeredCounts.get(question.id) ?? 0) + 1);
      const distribution = summaryCounts.get(question.id) ?? new Map<string, number>();
      for (const value of values) distribution.set(value, (distribution.get(value) ?? 0) + 1);
      summaryCounts.set(question.id, distribution);
    }
  }
  const summaries = assessment.questions.map((question) => ({
    questionId: question.id,
    answeredCount: answeredCounts.get(question.id) ?? 0,
    distribution: [...(summaryCounts.get(question.id) ?? new Map()).entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value)),
  }));
  res.json(GetTeamAssessmentResultsResponse.parse({
    assessment: rowToAssessment(assessment),
    assignedCount: assignments.length,
    responseCount: submissions.length,
    completions,
    summaries,
  }));
});

router.post("/team-assessments/:assessmentId/uploads/request-url", requireAdmin, async (req, res): Promise<void> => {
  const params = RequestTeamAssessmentUploadUrlParams.safeParse(req.params);
  const parsed = RequestTeamAssessmentUploadUrlBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "File details are invalid." });
    return;
  }
  const { name, size, contentType } = parsed.data;
  if (size > TEAM_ASSESSMENT_MAX_FILE_BYTES || !allowedFileTypes.has(contentType)) {
    res.status(400).json({ error: "Choose a supported image, PDF, Office document, or text file up to 5 MB." });
    return;
  }
  const interviewerId = authenticatedInterviewerId(req);
  if (!interviewerId) {
    res.status(401).json({ error: "Interviewer session is invalid" });
    return;
  }
  const teamId = await requestTeamId(req);
  const assessment = await assessmentForTeam(params.data.assessmentId, teamId);
  if (!assessment || assessment.status !== "published") {
    res.status(404).json({ error: "Assessment not found." });
    return;
  }
  const role = (req as typeof req & { interviewerRole?: string }).interviewerRole;
  if (role === "coordinator" || role === "admin") {
    res.status(403).json({ error: "Admins may preview assessments but do not submit files." });
    return;
  }
  if (!assessment.questions.some((question) => question.type === "file_upload")) {
    res.status(400).json({ error: "This assessment does not accept file uploads." });
    return;
  }
  const [existingSubmission] = await db.select({ id: teamAssessmentSubmissionsTable.id })
    .from(teamAssessmentSubmissionsTable)
    .where(and(
      eq(teamAssessmentSubmissionsTable.teamId, teamId),
      eq(teamAssessmentSubmissionsTable.assessmentId, assessment.id),
      eq(teamAssessmentSubmissionsTable.interviewerId, interviewerId),
    )).limit(1);
  if (existingSubmission) {
    res.status(409).json({ error: "This assessment has already been submitted." });
    return;
  }
  if (role !== "coordinator" && role !== "admin") {
    const [assignment] = await db.select({ id: teamAssessmentAssignmentsTable.id })
      .from(teamAssessmentAssignmentsTable)
      .where(and(
        eq(teamAssessmentAssignmentsTable.teamId, teamId),
        eq(teamAssessmentAssignmentsTable.assessmentId, assessment.id),
        eq(teamAssessmentAssignmentsTable.interviewerId, interviewerId),
      )).limit(1);
    if (!assignment) {
      res.status(403).json({ error: "This assessment is not assigned to your account." });
      return;
    }
  }
  if (!name.trim() || name.trim().length > 255) {
    res.status(400).json({ error: "File names must contain 1–255 non-space characters." });
    return;
  }
  const upload = await objectStorageService.mintTeamAssessmentUpload(teamId, interviewerId, assessment.id);
  res.json(RequestTeamAssessmentUploadUrlResponse.parse(upload));
});

router.post("/team-assessments/:assessmentId/submissions", requireAdmin, async (req, res): Promise<void> => {
  const params = SubmitTeamAssessmentParams.safeParse(req.params);
  const parsed = SubmitTeamAssessmentBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "Assessment answers are invalid." });
    return;
  }
  const interviewerId = authenticatedInterviewerId(req);
  if (!interviewerId) {
    res.status(401).json({ error: "Interviewer session is invalid" });
    return;
  }
  const teamId = await requestTeamId(req);
  const assessment = await assessmentForTeam(params.data.assessmentId, teamId);
  if (!assessment || assessment.status !== "published") {
    res.status(404).json({ error: "Assessment is not accepting responses." });
    return;
  }
  const role = (req as typeof req & { interviewerRole?: string }).interviewerRole;
  if (role === "coordinator" || role === "admin") {
    res.status(403).json({ error: "Admins do not need to submit team assessments." });
    return;
  }
  await db.insert(teamAssessmentAssignmentsTable).values({
    id: randomUUID(),
    teamId,
    assessmentId: assessment.id,
    interviewerId,
  }).onConflictDoNothing();
  const [existing] = await db.select({ id: teamAssessmentSubmissionsTable.id })
    .from(teamAssessmentSubmissionsTable)
    .where(and(
      eq(teamAssessmentSubmissionsTable.teamId, teamId),
      eq(teamAssessmentSubmissionsTable.assessmentId, assessment.id),
      eq(teamAssessmentSubmissionsTable.interviewerId, interviewerId),
    )).limit(1);
  if (existing) {
    res.status(409).json({ error: "This assessment has already been submitted." });
    return;
  }
  let result: ReturnType<typeof validateTeamAssessmentAnswers>;
  try {
    result = validateTeamAssessmentAnswers({
      questions: assessment.questions,
      answers: parsed.data.answers as Record<string, { value: unknown; comment?: unknown }>,
      kind: assessment.kind as "quiz" | "survey",
      teamId,
      interviewerId,
      assessmentId: assessment.id,
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Answers are invalid." });
    return;
  }
  let totalFileBytes = 0;
  try {
    for (const file of result.files) {
      totalFileBytes += file.size;
      if (totalFileBytes > TEAM_ASSESSMENT_MAX_TOTAL_FILE_BYTES) {
        res.status(400).json({ error: "Response files together must be 10 MB or smaller." });
        return;
      }
      const stored = await objectStorageService.downloadObject(file.objectPath);
      if (stored.data.byteLength !== file.size || stored.data.byteLength > TEAM_ASSESSMENT_MAX_FILE_BYTES ||
        stored.contentType !== file.contentType) {
        res.status(400).json({ error: "An uploaded file does not match its saved details." });
        return;
      }
    }
  } catch (error) {
    req.log.warn({ err: error }, "Assessment response file could not be verified");
    res.status(400).json({ error: "An uploaded file is missing or could not be verified. Upload it again." });
    return;
  }
  const submittedAt = new Date();
  try {
    await db.insert(teamAssessmentSubmissionsTable).values({
      id: randomUUID(),
      teamId,
      assessmentId: assessment.id,
      interviewerId,
      answers: parsed.data.answers as Record<string, { value: unknown; comment?: string }>,
      score: result.score,
      maxScore: result.maxScore,
      submittedAt,
    });
  } catch (error) {
    req.log.warn({ err: error }, "Assessment submission save failed");
    res.status(409).json({ error: "This assessment was submitted already or could not be saved." });
    return;
  }
  res.status(201).json(SubmitTeamAssessmentResponse.parse({
    assessmentId: assessment.id,
    submittedAt,
    score: result.score,
    maxScore: result.maxScore,
  }));
});

export default router;
