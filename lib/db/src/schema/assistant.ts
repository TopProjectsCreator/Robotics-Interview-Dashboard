import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const assistantMessagesTable = pgTable("assistant_messages", {
  id: text("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  applicantIds: text("applicant_ids").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAssistantMessageSchema = createInsertSchema(assistantMessagesTable).omit({
  createdAt: true,
});

export type AssistantMessage = typeof assistantMessagesTable.$inferSelect;
export type InsertAssistantMessage = z.infer<typeof insertAssistantMessageSchema>;