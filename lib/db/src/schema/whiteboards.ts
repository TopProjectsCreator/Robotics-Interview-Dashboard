import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const interviewWhiteboardsTable = pgTable("interview_whiteboards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  data: text("data").notNull(),
  createdBy: text("created_by").notNull(),
  conversationScope: text("conversation_scope").notNull().default("shared"),
  // Shared whiteboards use null. Direct whiteboards store a stable, sorted label pair.
  conversationPeer: text("conversation_peer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInterviewWhiteboardSchema = createInsertSchema(interviewWhiteboardsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InterviewWhiteboard = typeof interviewWhiteboardsTable.$inferSelect;
export type InsertInterviewWhiteboard = z.infer<typeof insertInterviewWhiteboardSchema>;