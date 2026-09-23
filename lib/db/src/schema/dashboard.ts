import { createInsertSchema } from "drizzle-zod";
import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const displaySettingsTable = pgTable("display_settings", {
  id: integer("id").primaryKey().default(1),
  // Null = automatic text. Set = coordinator override shown on the big screen.
  customHeadline: text("custom_headline"),
  customSubheadline: text("custom_subheadline"),
  // Hide the applicant name pills (announcements keep calling names unless muted).
  showNames: boolean("show_names").notNull().default(true),
  // Master switch for spoken auto-announcements on the big screen.
  announce: boolean("announce").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type DisplaySettings = typeof displaySettingsTable.$inferSelect;

export const seatingSettingsTable = pgTable("seating_settings", {
  id: integer("id").primaryKey().default(1),
  rows: integer("rows").notNull().default(4),
  cols: integer("cols").notNull().default(6),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type SeatingSettings = typeof seatingSettingsTable.$inferSelect;

export const dashboardChartsTable = pgTable("dashboard_charts", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id"),
  source: text("source").notNull(),
  chart: text("chart").notNull(),
  xAxis: text("x_axis"),
  yAxis: text("y_axis"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertDashboardChartSchema = createInsertSchema(dashboardChartsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type DashboardChart = typeof dashboardChartsTable.$inferSelect;
export type InsertDashboardChart = z.infer<typeof insertDashboardChartSchema>;
