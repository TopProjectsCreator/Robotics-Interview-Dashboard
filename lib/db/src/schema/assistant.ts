import { createInsertSchema } from "drizzle-zod";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { z } from "zod/v4";

export const assistantConversationsTable = pgTable("assistant_conversations", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  ownerId: text("owner_id"),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistantMessagesTable = pgTable("assistant_messages", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  conversationId: text("conversation_id"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  applicantIds: text("applicant_ids").notNull().default("[]"),
  activities: text("activities").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistantPromptRunsTable = pgTable("assistant_prompt_runs", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  ownerId: text("owner_id"),
  accountId: text("account_id").notNull(),
  prompt: text("prompt").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  status: text("status").notNull(),
  answer: text("answer"),
  error: text("error"),
  activities: text("activities").notNull().default("[]"),
  cancelRequested: boolean("cancel_requested").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("assistant_prompt_runs_conversation_created_idx").on(table.teamId, table.conversationId, table.createdAt),
  uniqueIndex("assistant_prompt_runs_one_running_per_conversation")
    .on(table.teamId, table.conversationId)
    .where(sql`${table.status} = 'running'`),
]);

export const assistantBuilderRunsTable = pgTable("assistant_builder_runs", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  coordinatorId: text("coordinator_id").notNull(),
  conversationId: text("conversation_id").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull(),
  questionId: text("question_id"),
  questions: jsonb("questions").$type<{ id: string; type: string; title: string; required?: boolean; options?: string[] }[] | null>(),
  answers: jsonb("answers").$type<Record<string, unknown>>().notNull().default({}),
  activities: text("activities").notNull().default("[]"),
  result: text("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("assistant_builder_runs_owner_created_idx").on(table.teamId, table.coordinatorId, table.createdAt),
  index("assistant_builder_runs_question_idx").on(table.teamId, table.coordinatorId, table.questionId),
]);

export const assistantSkillsTable = pgTable("assistant_skills", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  instructions: text("instructions").notNull(),
  actions: jsonb("actions").$type<string[]>().notNull().default([]),
  enabled: boolean("enabled").notNull().default(true),
  githubRepositoryUrl: text("github_repository_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistantScheduledTasksTable = pgTable("assistant_scheduled_tasks", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  ownerId: text("owner_id").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("draft"),
  recurrence: jsonb("recurrence").$type<{ frequency: "daily" | "weekly"; hour: number; minute: number; daysOfWeek: number[] }>().notNull(),
  timeZone: text("time_zone").notNull(),
  destinationChannel: text("destination_channel"),
  activationCode: text("activation_code"),
  allowedTools: jsonb("allowed_tools").$type<string[]>().notNull().default([]),
  disabledTools: jsonb("disabled_tools").$type<string[]>().notNull().default([]),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastError: text("last_error"),
  claimedUntil: timestamp("claimed_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("assistant_scheduled_tasks_due_idx").on(table.status, table.nextRunAt),
  index("assistant_scheduled_tasks_owner_idx").on(table.teamId, table.ownerId, table.createdAt),
]);

export const assistantScheduledTaskRunsTable = pgTable("assistant_scheduled_task_runs", {
  id: text("id").primaryKey(),
  taskId: text("task_id").notNull().references(() => assistantScheduledTasksTable.id, { onDelete: "cascade" }),
  teamId: text("team_id").notNull(),
  ownerId: text("owner_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status: text("status").notNull(),
  attempt: integer("attempt").notNull().default(1),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  result: text("result"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("assistant_scheduled_task_runs_idempotency_unique").on(table.idempotencyKey),
  index("assistant_scheduled_task_runs_task_created_idx").on(table.teamId, table.taskId, table.createdAt),
]);

export const insertAssistantMessageSchema = createInsertSchema(assistantMessagesTable).omit({
  createdAt: true,
});

export const insertAssistantConversationSchema = createInsertSchema(assistantConversationsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type AssistantMessage = typeof assistantMessagesTable.$inferSelect;
export type InsertAssistantMessage = z.infer<typeof insertAssistantMessageSchema>;
export type AssistantConversation = typeof assistantConversationsTable.$inferSelect;
export type InsertAssistantConversation = z.infer<typeof insertAssistantConversationSchema>;
export type AssistantSkill = typeof assistantSkillsTable.$inferSelect;