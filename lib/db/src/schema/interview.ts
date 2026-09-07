import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const interviewQueueTable = pgTable("interview_queue", {
  id: integer("id").primaryKey().default(1),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const importsTable = pgTable("application_imports", {
  id: text("id").primaryKey(),
  objectPath: text("object_path").notNull(),
  fileName: text("file_name").notNull(),
  rowCount: integer("row_count").notNull(),
  importedCount: integer("imported_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  warnings: text("warnings").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInterviewQueueSchema = createInsertSchema(interviewQueueTable).omit({
  updatedAt: true,
});
export const insertImportSchema = createInsertSchema(importsTable).omit({
  createdAt: true,
});

export type InterviewQueue = typeof interviewQueueTable.$inferSelect;
export type InsertInterviewQueue = z.infer<typeof insertInterviewQueueSchema>;
export type ApplicationImport = typeof importsTable.$inferSelect;
export type InsertApplicationImport = z.infer<typeof insertImportSchema>;