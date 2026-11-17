import { createInsertSchema } from "drizzle-zod";
import { index, integer, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

/**
 * Team-created short links that redirect under `/t/<alias>` on this
 * deployment's own domain (e.g. `team.example.com/t/tryouts`). Aliases are
 * stored lowercase and unique across the whole deployment because the public
 * redirect has no team context. Managed from Settings → Operations; clicks
 * are counted so teams can see which links get used.
 */
export const tinyUrlsTable = pgTable("tiny_urls", {
  id: text("id").primaryKey(),
  // NULL = legacy row belonging to the default team.
  teamId: text("team_id"),
  alias: text("alias").notNull(),
  targetUrl: text("target_url").notNull(),
  createdBy: text("created_by"),
  clickCount: integer("click_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => ({
  aliasUnique: uniqueIndex("tiny_urls_alias_unique").on(table.alias),
  teamCreatedIdx: index("tiny_urls_team_created_idx").on(table.teamId, table.createdAt),
}));

export const insertTinyUrlSchema = createInsertSchema(tinyUrlsTable).omit({
  createdAt: true,
  updatedAt: true,
  clickCount: true,
});

export type TinyUrl = typeof tinyUrlsTable.$inferSelect;
export type InsertTinyUrl = z.infer<typeof insertTinyUrlSchema>;
