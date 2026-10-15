import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * The CAD workspace library. Three levels of nesting:
 *   bot -> folder -> folder -> ... -> model
 * Folders are an adjacency list (`parentId`) so subfolders nest arbitrarily
 * deep; a null `parentId` makes a folder a direct child of its bot, and a null
 * `botId` on a model files it under "Unfiled" until somebody organises it.
 */
export const cadBotsTable = pgTable(
  "cad_bots",
  {
    id: text("id").primaryKey(),
    // NULL = legacy row belonging to the default team; never lost.
    teamId: text("team_id"),
    name: text("name").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueName: uniqueIndex("cad_bots_normalized_name_unique").on(table.teamId, sql`lower(${table.name})`),
    nameLength: check(
      "cad_bots_name_length_valid",
      sql`length(${table.name}) between 1 and 120`,
    ),
  }),
);

export const cadFoldersTable = pgTable(
  "cad_folders",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id"),
    botId: text("bot_id")
      .notNull()
      .references(() => cadBotsTable.id, { onDelete: "cascade" }),
    // Null = top level inside the bot. Self-reference cascades so deleting a
    // folder never orphans its descendants.
    parentId: text("parent_id").references((): AnyPgColumn => cadFoldersTable.id, {
      onDelete: "cascade",
    }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // COALESCE lets NULL (top level) participate in a unique index, so the same
    // folder name cannot appear twice side by side at any depth.
    uniqueSiblingName: uniqueIndex("cad_folders_sibling_name_unique").on(
      table.botId,
      sql`coalesce(${table.parentId}, '')`,
      sql`lower(${table.name})`,
    ),
    byParent: index("cad_folders_parent_idx").on(table.botId, table.parentId),
    nameLength: check(
      "cad_folders_name_length_valid",
      sql`length(${table.name}) between 1 and 120`,
    ),
  }),
);

export const cadModelsTable = pgTable(
  "cad_models",
  {
    id: text("id").primaryKey(),
    teamId: text("team_id"),
    // Display name, which users are free to rename without touching the file.
    name: text("name").notNull(),
    // Original upload name, used for the download and to pick a renderer.
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    objectPath: text("object_path").notNull(),
    sizeBytes: integer("size_bytes").notNull().default(0),
    // Null botId means the model sits in the workspace-level "Unfiled" pile.
    botId: text("bot_id").references(() => cadBotsTable.id, { onDelete: "set null" }),
    folderId: text("folder_id").references(() => cadFoldersTable.id, { onDelete: "set null" }),
    notes: text("notes"),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byLocation: index("cad_models_folder_idx").on(table.botId, table.folderId),
    validObjectPath: check(
      "cad_models_object_path_valid",
      sql`${table.objectPath} ~ '^/objects/[A-Za-z0-9/-]{8,160}$'`,
    ),
    validSize: check("cad_models_size_valid", sql`${table.sizeBytes} >= 0`),
    nameLength: check("cad_models_name_length_valid", sql`length(${table.name}) between 1 and 255`),
    fileNameLength: check(
      "cad_models_file_name_length_valid",
      sql`length(${table.fileName}) between 1 and 255`,
    ),
  }),
);

/**
 * Which roles may open each workspace. Single-row table (id 1) following the
 * `display_settings` convention. Stored as JSON because the workspace list is
 * fixed by the app and the role set is tiny; adding a workspace means adding an
 * entry here rather than a migration.
 */
export const workspaceSettingsTable = pgTable("workspace_settings", {
  id: integer("id").primaryKey().default(1),
  teamId: text("team_id"),
  // { interview: ["coordinator"], chat: [...], parts: [...], cad: [...] }
  visibility: jsonb("visibility")
    .notNull()
    .default(sql`'{"interview":["coordinator"],"chat":["coordinator","treasurer","interviewer"],"parts":["coordinator","treasurer","interviewer"],"cad":["coordinator"]}'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type CadBot = typeof cadBotsTable.$inferSelect;
export type CadFolder = typeof cadFoldersTable.$inferSelect;
export type CadModel = typeof cadModelsTable.$inferSelect;
export type WorkspaceSettings = typeof workspaceSettingsTable.$inferSelect;
