import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const revokedSessionsTable = pgTable("revoked_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const insertRevokedSessionSchema = createInsertSchema(revokedSessionsTable);

export type RevokedSession = typeof revokedSessionsTable.$inferSelect;
export type InsertRevokedSession = z.infer<typeof insertRevokedSessionSchema>;
