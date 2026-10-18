import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { interviewerAccountsTable } from "./interviewerAccounts";

export const personalNotepadTable = pgTable("personal_notepad", {
  accountId: text("account_id").primaryKey().references(() => interviewerAccountsTable.id, { onDelete: "cascade" }),
  teamId: text("team_id").notNull(),
  content: text("content").notNull().default("<p></p>"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPersonalNotepadSchema = createInsertSchema(personalNotepadTable).omit({ updatedAt: true });
export type PersonalNotepad = typeof personalNotepadTable.$inferSelect;
export type InsertPersonalNotepad = z.infer<typeof insertPersonalNotepadSchema>;
