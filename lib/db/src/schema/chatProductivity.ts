import { createInsertSchema } from "drizzle-zod";
import { boolean, index, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export type ChatProductivityAssessment =
  | "productive"
  | "low_value"
  | "potentially_useful"
  | "no_recorded_progress";

export type ChatProductivityActivity = {
  activity: string;
  assessment: ChatProductivityAssessment;
};

export type ChatProductivityBreakdown = {
  projectProgress: number;
  planningCoordination: number;
  focusDiscipline: number;
};

export const chatProductivitySettingsTable = pgTable("chat_productivity_settings", {
  teamId: text("team_id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  customMessage: text("custom_message").notNull().default(""),
  enabledBy: text("enabled_by"),
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const chatProductivitySnapshotsTable = pgTable("chat_productivity_snapshots", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  conversationScope: text("conversation_scope").notNull(),
  // The shared team conversation uses the stable key "team"; channels use
  // their channel id. Keeping a non-null key makes the unique index portable.
  conversationKey: text("conversation_key").notNull(),
  conversationName: text("conversation_name").notNull(),
  score: integer("score").notNull(),
  summary: text("summary").notNull(),
  activities: jsonb("activities").$type<ChatProductivityActivity[]>().notNull().default([]),
  breakdown: jsonb("breakdown").$type<ChatProductivityBreakdown>().notNull(),
  periodStart: timestamp("period_start", { withTimezone: true }),
  periodEnd: timestamp("period_end", { withTimezone: true }),
  modelId: text("model_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  // Snapshots accumulate as retained history; the conversation-ordered
  // composite index backs the productivity history endpoint.
  index("chat_productivity_snapshots_conversation_created_idx")
    .on(table.teamId, table.conversationScope, table.conversationKey, table.createdAt),
  index("chat_productivity_snapshots_team_created_idx").on(table.teamId, table.createdAt),
]);

export const insertChatProductivitySettingsSchema = createInsertSchema(chatProductivitySettingsTable);
export type ChatProductivitySettings = typeof chatProductivitySettingsTable.$inferSelect;
export type ChatProductivitySnapshot = typeof chatProductivitySnapshotsTable.$inferSelect;
export type InsertChatProductivitySettings = z.infer<typeof insertChatProductivitySettingsSchema>;
