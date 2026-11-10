import { pgTable, text, timestamp, integer, date, index, boolean } from "drizzle-orm/pg-core";

export const workspaceUsageVisitsTable = pgTable("workspace_usage_visits", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  sessionHash: text("session_hash").notNull(),
  workspaceKey: text("workspace_key").notNull(),
  customWorkspaceId: text("custom_workspace_id"),
  enteredAt: timestamp("entered_at", { withTimezone: true }).notNull().defaultNow(),
  exitedAt: timestamp("exited_at", { withTimezone: true }),
  lastHeartbeatAt: timestamp("last_heartbeat_at", { withTimezone: true }).notNull().defaultNow(),
  isForeground: boolean("is_foreground").notNull().default(false),
  activeSeconds: integer("active_seconds").notNull().default(0),
}, (table) => [
  index("workspace_usage_visits_team_entered_idx").on(table.teamId, table.enteredAt),
  index("workspace_usage_visits_session_open_idx").on(table.sessionHash, table.exitedAt),
]);

export const workspaceUsageActivityTable = pgTable("workspace_usage_activity", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  sessionHash: text("session_hash").notNull(),
  workspaceKey: text("workspace_key").notNull(),
  customWorkspaceId: text("custom_workspace_id"),
  activityDate: date("activity_date", { mode: "string" }).notNull(),
  activeSeconds: integer("active_seconds").notNull(),
}, (table) => [
  index("workspace_usage_activity_team_date_idx").on(table.teamId, table.activityDate),
]);

export type WorkspaceUsageVisit = typeof workspaceUsageVisitsTable.$inferSelect;
export type WorkspaceUsageActivity = typeof workspaceUsageActivityTable.$inferSelect;
