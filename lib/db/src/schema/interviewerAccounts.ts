import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const interviewerAccountsTable = pgTable("interviewer_accounts", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertInterviewerAccountSchema = createInsertSchema(interviewerAccountsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InterviewerAccount = typeof interviewerAccountsTable.$inferSelect;
export type InsertInterviewerAccount = z.infer<typeof insertInterviewerAccountSchema>;