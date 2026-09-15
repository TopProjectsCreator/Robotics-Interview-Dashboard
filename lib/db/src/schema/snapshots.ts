import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const dataSnapshotsTable = pgTable("data_snapshots", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  createdBy: text("created_by").notNull().default("coordinator"),
  applicantCount: integer("applicant_count").notNull().default(0),
  payload: text("payload").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDataSnapshotSchema = createInsertSchema(dataSnapshotsTable).omit({
  createdAt: true,
});

export type DataSnapshot = typeof dataSnapshotsTable.$inferSelect;
export type InsertDataSnapshot = z.infer<typeof insertDataSnapshotSchema>;
