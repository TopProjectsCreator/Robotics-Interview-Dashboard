import { createInsertSchema } from "drizzle-zod";
import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const teamRolesTable = pgTable(
  "team_roles",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id").notNull(),
    name: text("name").notNull(),
    permissions: jsonb("permissions").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    uniqueName: uniqueIndex("team_roles_name_unique").on(table.teamId, sql`lower(${table.name})`),
    byTeam: index("team_roles_team_idx").on(table.teamId),
  }),
);

export const insertTeamRoleSchema = createInsertSchema(teamRolesTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type TeamRole = typeof teamRolesTable.$inferSelect;
export type InsertTeamRole = z.infer<typeof insertTeamRoleSchema>;
