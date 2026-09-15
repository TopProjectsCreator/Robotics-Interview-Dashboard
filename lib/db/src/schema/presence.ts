import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const presenceHeartbeatsTable = pgTable("presence_heartbeats", {
  sessionHash: text("session_hash").primaryKey(),
  ip: text("ip").notNull().default("unknown"),
  userAgent: text("user_agent").notNull().default(""),
  city: text("city").notNull().default(""),
  region: text("region").notNull().default(""),
  country: text("country").notNull().default(""),
  page: text("page").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertPresenceHeartbeatSchema = createInsertSchema(presenceHeartbeatsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type PresenceHeartbeat = typeof presenceHeartbeatsTable.$inferSelect;
export type InsertPresenceHeartbeat = z.infer<typeof insertPresenceHeartbeatSchema>;
