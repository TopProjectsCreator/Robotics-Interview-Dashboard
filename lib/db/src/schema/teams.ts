import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * A team is a completely isolated workspace: its own team access code,
 * its own interviewer accounts, applicants, queue, chat, and every other
 * record. `codeHash` is a scrypt hash of the team access code (same format
 * as interviewer password hashes: `saltHex:hashHex`). All tenant tables
 * carry a nullable `teamId` that references this table; NULL is treated as
 * the legacy default team ("default") so rows written before the multi-team
 * migration stay visible to the current team and are never lost.
 */
export const DEFAULT_TEAM_ID = "default";

export const teamsTable = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  codeHash: text("code_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type Team = typeof teamsTable.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export function normalizeTeamName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
