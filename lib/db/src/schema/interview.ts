import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const interviewQueueTable = pgTable("interview_queue", {
  id: integer("id").primaryKey().default(1),
  // NULL = legacy singleton row belonging to the default team.
  teamId: text("team_id"),
  interviewerLabels: text("interviewer_labels").notNull().default('["Interviewer 1","Interviewer 2"]'),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const interviewChatMessagesTable = pgTable("interview_chat_messages", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  author: text("author").notNull(),
  message: text("message").notNull(),
  conversationScope: text("conversation_scope").notNull().default("shared"),
  // Shared messages use null. Direct messages store a stable, sorted label pair.
  conversationPeer: text("conversation_peer"),
  activities: text("activities").notNull().default("[]"),
  parentMessageId: text("parent_message_id"),
  pinnedAt: timestamp("pinned_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessageReactionsTable = pgTable("chat_message_reactions", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  messageId: text("message_id")
    .notNull()
    .references(() => interviewChatMessagesTable.id, { onDelete: "cascade" }),
  emoji: text("emoji").notNull(),
  author: text("author").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});


export const chatSettingsTable = pgTable("chat_settings", {
  id: text("id").primaryKey().default("1"),
  teamId: text("team_id"),
  slowmodeSeconds: integer("slowmode_seconds").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
    .$onUpdate(() => new Date()),
});

export const chunkedUploadsTable = pgTable("chunked_uploads", {
  uploadId: text("upload_id").primaryKey(),
  teamId: text("team_id"),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  totalParts: integer("total_parts").notNull(),
  partSizeBytes: integer("part_size_bytes").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatPollsTable = pgTable("chat_polls", {
  messageId: text("message_id")
    .primaryKey()
    .references(() => interviewChatMessagesTable.id, { onDelete: "cascade" }),
  teamId: text("team_id"),
  question: text("question").notNull(),
  options: text("options").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatPollVotesTable = pgTable("chat_poll_votes", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  messageId: text("message_id")
    .notNull()
    .references(() => interviewChatMessagesTable.id, { onDelete: "cascade" }),
  optionIndex: integer("option_index").notNull(),
  voter: text("voter").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatCustomEmojisTable = pgTable("chat_custom_emojis", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  name: text("name").notNull(),
  imagePath: text("image_path").notNull().unique(),
  contentType: text("content_type").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// A chat message composed now but delivered later by the server, so it sends
// even when every browser is closed. Attachments are uploaded at schedule
// time and embedded in `message`, exactly like an immediate send.
export const scheduledChatMessagesTable = pgTable("scheduled_chat_messages", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  // Display label the message is posted as.
  author: text("author").notNull(),
  // Interviewer account that scheduled it (owns cancel rights).
  createdBy: text("created_by").notNull(),
  conversationScope: text("conversation_scope").notNull().default("shared"),
  // Stable sorted label pair for direct messages, null when shared.
  conversationPeer: text("conversation_peer"),
  // Direct recipient label (null when shared), re-validated at delivery time.
  recipient: text("recipient"),
  message: text("message").notNull(),
  parentMessageId: text("parent_message_id"),
  pollQuestion: text("poll_question"),
  // JSON.stringify(string[]) when a poll was scheduled with the message.
  pollOptions: text("poll_options"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
  // pending -> sending -> sent | failed | cancelled (cancel deletes the row).
  status: text("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentMessageId: text("sent_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const importsTable = pgTable("application_imports", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
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
export const insertChatCustomEmojiSchema = createInsertSchema(chatCustomEmojisTable).omit({
  createdAt: true,
});
export type InsertChatCustomEmoji = z.infer<typeof insertChatCustomEmojiSchema>;
export type ChatCustomEmoji = typeof chatCustomEmojisTable.$inferSelect;
export const insertScheduledChatMessageSchema = createInsertSchema(scheduledChatMessagesTable).omit({
  createdAt: true,
});
export type ScheduledChatMessage = typeof scheduledChatMessagesTable.$inferSelect;
export type InsertScheduledChatMessage = z.infer<typeof insertScheduledChatMessageSchema>;
export type ApplicationImport = typeof importsTable.$inferSelect;
export type InsertApplicationImport = z.infer<typeof insertImportSchema>;