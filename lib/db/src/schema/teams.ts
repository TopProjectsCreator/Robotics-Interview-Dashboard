import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/** How the team's custom app background is fitted to the viewport. */
export const TEAM_BACKGROUND_MODES = ["cover", "tile"] as const;
export type TeamBackgroundMode = (typeof TEAM_BACKGROUND_MODES)[number];

export const TEAM_BACKGROUND_OVERLAY_MIN = 0;
export const TEAM_BACKGROUND_OVERLAY_MAX = 80;
export const TEAM_BACKGROUND_ROTATION_MAX_SECONDS = 86_400;
export const TEAM_BACKGROUNDS_MAX = 10;

/** Team-default color theme. */
export const TEAM_THEMES = ["light", "dark"] as const;
export type TeamTheme = (typeof TEAM_THEMES)[number];

/**
 * How strictly the team default theme is applied:
 * - `recommended`: members land on the team default but may switch for themselves.
 * - `locked`: members cannot switch; every session renders the team default.
 */
export const TEAM_THEME_POLICIES = ["recommended", "locked"] as const;
export type TeamThemePolicy = (typeof TEAM_THEME_POLICIES)[number];

/**
 * A team is a completely isolated workspace: its own team access code,
 * its own interviewer accounts, applicants, queue, chat, and every other
 * record. `codeHash` is a scrypt hash of the team access code (same format
 * as interviewer password hashes: `saltHex:hashHex`). All tenant tables
 * carry a nullable `teamId` that references this table; NULL is treated as
 * the legacy default team ("default") so rows written before the multi-team
 * migration stay visible to the current team and are never lost.
 */
export const DEFAULT_TEAM_ID = "default";

export const teamsTable = pgTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  normalizedName: text("normalized_name").notNull().unique(),
  codeHash: text("code_hash").notNull(),
  logoPath: text("logo_path"),
  primaryColor: text("primary_color"),
  // Legacy single background; superseded by backgroundPaths but kept so the
  // startup migration can fold existing values into the array. Writers sync
  // it to the first entry of backgroundPaths. Nothing reads it directly.
  backgroundPath: text("background_path"),
  /** Private object paths for the team's app backgrounds, in rotation order. */
  backgroundPaths: jsonb("background_paths").$type<string[]>().notNull().default([]),
  /** Seconds between app background switches when two or more are set. 0 keeps the first. */
  backgroundRotationSeconds: integer("background_rotation_seconds").notNull().default(0),
  backgroundMode: text("background_mode"),
  backgroundOverlay: integer("background_overlay").notNull().default(35),
  backgroundAudience: text("background_audience").notNull().default("everyone"),
  backgroundMemberIds: jsonb("background_member_ids").$type<string[]>().notNull().default([]),
  defaultTheme: text("default_theme"),
  themePolicy: text("theme_policy").notNull().default("recommended"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type Team = typeof teamsTable.$inferSelect;
export type InsertTeam = z.infer<typeof insertTeamSchema>;

export function normalizeTeamName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
