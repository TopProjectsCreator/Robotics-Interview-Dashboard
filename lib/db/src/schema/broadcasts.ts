import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const broadcastsTable = pgTable("broadcasts", {
  id: text("id").primaryKey(),
  teamId: text("team_id"),
  message: text("message").notNull(),
  // message = popup for coordinators; audio-test / audio-engine / audio-reset
  // are silent commands the big screen executes (payload: engine id).
  kind: text("kind").notNull().default("message"),
  targetIp: text("target_ip").notNull().default(""),
  createdBy: text("created_by").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull().defaultNow(),
});

export const broadcastAcksTable = pgTable("broadcast_acks", {
  broadcastId: text("broadcast_id").notNull(),
  sessionHash: text("session_hash").notNull(),
  ackedAt: timestamp("acked_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // One ack per (broadcast, session). Without this the ack insert below
  // never conflicts, every poll adds a row, and the "my broadcasts" join
  // returns the same broadcast once per row it accumulated.
  broadcastSession: uniqueIndex("broadcast_acks_broadcast_session_unique").on(table.broadcastId, table.sessionHash),
}));

export const insertBroadcastSchema = createInsertSchema(broadcastsTable).omit({
  createdAt: true,
});

export type Broadcast = typeof broadcastsTable.$inferSelect;
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
