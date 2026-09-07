import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const applicantsTable = pgTable("applicants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  grade: text("grade").notNull().default("Unknown"),
  email: text("email"),
  transcript: text("transcript"),
  attachments: text("attachments"),
  aiScore: integer("ai_score").notNull().default(-1),
  aiRecommendation: text("ai_recommendation").notNull().default("Review"),
  aiSummary: text("ai_summary").notNull().default(""),
  aiStrengths: text("ai_strengths").notNull().default(""),
  aiConcerns: text("ai_concerns").notNull().default(""),
  roboticsExperience: text("robotics_experience").notNull().default(""),
  commit10Hours: text("commit_10_hours").notNull().default("Unclear"),
  parentVolunteer: text("parent_volunteer").notNull().default("Unclear"),
  interviewStatus: text("interview_status").notNull().default("queued"),
  interviewer: text("interviewer").notNull().default(""),
  category: text("category").notNull().default("Unsorted"),
  rank: integer("rank").notNull().default(0),
  notes: text("notes").notNull().default(""),
  queuePosition: integer("queue_position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertApplicantSchema = createInsertSchema(applicantsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertApplicant = z.infer<typeof insertApplicantSchema>;
export type Applicant = typeof applicantsTable.$inferSelect;