import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export type TeamAssessmentQuestion = {
  id: string;
  type: "single_choice" | "multiple_choice" | "long_answer" | "likert" | "ranking" | "file_upload" | "slider" | "style_picker";
  prompt: string;
  required: boolean;
  options?: string[];
  correctAnswers?: string[];
  min?: number;
  max?: number;
  step?: number;
  minLabel?: string;
  maxLabel?: string;
  fileLimit?: number;
};

export type TeamAssessmentAnswer = {
  value: unknown;
  comment?: string;
};

export const teamAssessmentsTable = pgTable("team_assessments", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  kind: text("kind").notNull(),
  status: text("status").notNull().default("draft"),
  required: boolean("required").notNull().default(true),
  stylePreset: text("style_preset").notNull().default("robotics"),
  questions: jsonb("questions").$type<TeamAssessmentQuestion[]>().notNull().default([]),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("team_assessments_team_status_idx").on(table.teamId, table.status, table.updatedAt),
]);

export const teamAssessmentAssignmentsTable = pgTable("team_assessment_assignments", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  assessmentId: text("assessment_id").notNull().references(() => teamAssessmentsTable.id, { onDelete: "cascade" }),
  interviewerId: text("interviewer_id").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("team_assessment_assignments_assessment_member_unique").on(table.assessmentId, table.interviewerId),
  index("team_assessment_assignments_team_member_idx").on(table.teamId, table.interviewerId),
]);

export const teamAssessmentSubmissionsTable = pgTable("team_assessment_submissions", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  assessmentId: text("assessment_id").notNull().references(() => teamAssessmentsTable.id, { onDelete: "cascade" }),
  interviewerId: text("interviewer_id").notNull(),
  answers: jsonb("answers").$type<Record<string, TeamAssessmentAnswer>>().notNull(),
  score: integer("score"),
  maxScore: integer("max_score"),
  submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("team_assessment_submissions_assessment_member_unique").on(table.assessmentId, table.interviewerId),
  index("team_assessment_submissions_team_assessment_idx").on(table.teamId, table.assessmentId, table.submittedAt),
]);

export type TeamAssessment = typeof teamAssessmentsTable.$inferSelect;
export type TeamAssessmentAssignment = typeof teamAssessmentAssignmentsTable.$inferSelect;
export type TeamAssessmentSubmission = typeof teamAssessmentSubmissionsTable.$inferSelect;
