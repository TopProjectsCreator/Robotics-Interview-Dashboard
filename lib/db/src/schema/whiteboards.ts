import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const whiteboardsTable = pgTable("whiteboards", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  // Serialized Excalidraw scene ({ type, version, elements, appState, files }).
  data: text("data").notNull().default("{}"),
  createdBy: text("created_by").notNull().default("Interviewer"),
  updatedBy: text("updated_by").notNull().default("Interviewer"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertWhiteboardSchema = createInsertSchema(whiteboardsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type Whiteboard = typeof whiteboardsTable.$inferSelect;
export type InsertWhiteboard = z.infer<typeof insertWhiteboardSchema>;