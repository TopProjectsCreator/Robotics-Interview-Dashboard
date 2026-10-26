import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * CAD preview jobs.
 *
 * The conversion of a very large model can take many minutes, and a free
 * instance is restarted by the platform from time to time. Keeping the job in
 * process memory meant a restart silently threw the work away: the browser
 * polled, found nothing, and the conversion could start over forever. The
 * job therefore lives in the database, so it survives a restart and is
 * resumed on the next boot.
 */
export const cadPreviewJobsTable = pgTable("cad_preview_jobs", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  objectPath: text("object_path").notNull(),
  format: text("format").notNull(),
  status: text("status").notNull().default("preparing"),
  previewId: text("preview_id"),
  error: text("error"),
  manifest: jsonb("manifest"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCadPreviewJobSchema = createInsertSchema(cadPreviewJobsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type CadPreviewJob = typeof cadPreviewJobsTable.$inferSelect;
export type InsertCadPreviewJob = z.infer<typeof insertCadPreviewJobSchema>;
