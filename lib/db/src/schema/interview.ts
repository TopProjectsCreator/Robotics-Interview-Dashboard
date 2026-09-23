import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const interviewQueueTable = pgTable("interview_queue", {
  id: integer("id").primaryKey().default(1),
  interviewerLabels: text("interviewer_labels").notNull().default('["Interviewer 1","Interviewer 2"]'),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const interviewChatMessagesTable = pgTable("interview_chat_messages", {
  id: text("id").primaryKey(),
  author: text("author").notNull(),
  message: text("message").notNull(),
  activities: text("activities").notNull().default("[]"),
  parentMessageId: text("parent_message_id"),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessageReactionsTable = pgTable("chat_message_reactions", {
  id: text("id").primaryKey(),
  messageId: text("message_id")
    .notNull()
    .references(() => interviewChatMessagesTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  author: text("author").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const importsTable = pgTable("application_imports", {
  id: text("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  rowCount: integer("row_count").notNull(),
  importedCount: integer("imported_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  delimiter: text("delimiter").notNull().default(","),
  warnings: text("warnings").notNull().default("[]"),
  diffSummary: text("diff_summary").notNull().default("{}"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInterviewQueueSchema = createInsertSchema(interviewQueueTable).omit({
  updatedAt: true,
});
export const insertImportSchema = createInsertSchema(importsTable).omit({
  createdAt: true,
});

export type InterviewQueue = typeof interviewQueueTable.$inferSelect;
export type InsertInterviewQueue = z.infer<typeof insertInterviewQueueSchema>;
export const insertInterviewChatMessageSchema = createInsertSchema(interviewChatMessagesTable).omit({
  createdAt: true,
});
export type InterviewChatMessage = typeof interviewChatMessagesTable.$inferSelect;
export type InsertInterviewChatMessage = z.infer<typeof insertInterviewChatMessageSchema>;
export type ApplicationImport = typeof importsTable.$inferSelect;
export type InsertApplicationImport = z.infer<typeof insertImportSchema>;