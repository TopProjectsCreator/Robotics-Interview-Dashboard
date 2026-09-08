import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const assistantConversationsTable = pgTable("assistant_conversations", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const assistantMessagesTable = pgTable("assistant_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id"),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  applicantIds: text("applicant_ids").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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