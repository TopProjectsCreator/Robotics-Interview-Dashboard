import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const dashboardChartsTable = pgTable("dashboard_charts", {
  id: text("id").primaryKey(),
  source: text("source").notNull(),
  chart: text("chart").notNull(),
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
