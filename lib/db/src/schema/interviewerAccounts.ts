import { createInsertSchema } from "drizzle-zod";
import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const interviewerAccountsTable = pgTable("interviewer_accounts", {
  id: text("id").primaryKey(),
  // NULL = legacy row belonging to the default team; never lost, always visible to it.
  teamId: text("team_id"),
  displayName: text("display_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("coordinator"),
  // True for the site owner (Ishaan Bansal): sees every team's feature
  // requests plus site-wide stats. Set once by boot migration.
  isSiteOwner: boolean("is_site_owner").notNull().default(false),
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