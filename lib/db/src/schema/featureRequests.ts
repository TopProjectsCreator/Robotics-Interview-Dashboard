import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * Feature requests from any team, all visible to the site owner (Ishaan
 * Bansal). `teamId` scopes each request to its team (NULL = legacy default
 * team); the owner inbox lists every team's requests. `status` is
 * "open" or "done".
 */
export const featureRequestsTable = pgTable("feature_requests", {
  id: text("id").primaryKey(),
  // NULL = legacy row belonging to the default team.
  teamId: text("team_id"),
  authorId: text("author_id"),
  authorName: text("author_name").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertFeatureRequestSchema = createInsertSchema(featureRequestsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type FeatureRequest = typeof featureRequestsTable.$inferSelect;
export type InsertFeatureRequest = z.infer<typeof insertFeatureRequestSchema>;
