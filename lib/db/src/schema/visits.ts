import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const pageVisitsTable = pgTable("page_visits", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  sessionHash: text("session_hash").notNull(),
  ip: text("ip").notNull().default(""),
  page: text("page").notNull().default(""),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  exitedAt: timestamp("exited_at", { withTimezone: true }),
});

export const insertPageVisitSchema = createInsertSchema(pageVisitsTable);

export type PageVisit = typeof pageVisitsTable.$inferSelect;
export type InsertPageVisit = z.infer<typeof insertPageVisitSchema>;
