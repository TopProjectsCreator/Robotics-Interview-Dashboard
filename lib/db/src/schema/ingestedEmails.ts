import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * Emails that have already been forwarded into the team inbox and posted to
 * the chat. The row is the dedupe record: the maildrop mailbox only holds a
 * handful of messages and forgets them, so the same email would otherwise be
 * posted again on every poll.
 */
export const ingestedEmailsTable = pgTable("ingested_emails", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  mailbox: text("mailbox").notNull(),
  messageId: text("message_id").notNull(),
  sender: text("sender").notNull().default(""),
  subject: text("subject").notNull().default(""),
  postedMessageId: text("posted_message_id"),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIngestedEmailSchema = createInsertSchema(ingestedEmailsTable).omit({
  ingestedAt: true,
});

export type IngestedEmail = typeof ingestedEmailsTable.$inferSelect;
export type InsertIngestedEmail = z.infer<typeof insertIngestedEmailSchema>;
