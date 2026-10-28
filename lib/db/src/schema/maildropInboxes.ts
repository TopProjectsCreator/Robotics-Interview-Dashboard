import { createInsertSchema } from "drizzle-zod";
import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * Per-team Maildrop forwarding configuration. Team settings live in the same
 * database instance as the team's other private data.
 */
export const maildropInboxesTable = pgTable("maildrop_inboxes", {
  teamId: text("team_id").primaryKey(),
  mailbox: text("mailbox").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  allowedSenders: jsonb("allowed_senders").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMaildropInboxSchema = createInsertSchema(maildropInboxesTable).omit({
  updatedAt: true,
});

export type MaildropInbox = typeof maildropInboxesTable.$inferSelect;
export type InsertMaildropInbox = z.infer<typeof insertMaildropInboxSchema>;
