import { sql } from "drizzle-orm";
import {
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
 * The Code workspace: server-persisted FTC robot projects (BIOBUZZ / SDK v12).
 * A project owns many files addressed by repository-style paths
 * (`TeamCode/src/main/java/.../MyOpMode.java`). File bodies live in
 * `code_files.content` (capped by a CHECK) so the IDE, git pane, AI edits,
 * and realtime collab all share one source of truth. `code_revisions`
 * keeps a bounded history of committed snapshots for the git pane.
 */
export const codeProjectsTable = pgTable(
  "code_projects",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sdkVersion: text("sdk_version").notNull().default("v12.0"),
    // { remoteUrl, branch, ... } — git endpoint config for the git pane.
    gitConfig: jsonb("git_config").notNull().default(sql`'{}'::jsonb`),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueName: uniqueIndex("code_projects_normalized_name_unique").on(sql`lower(${table.name})`),
    nameLength: check(
      "code_projects_name_length_valid",
      sql`length(${table.name}) between 1 and 120`,
    ),
  }),
);

export const codeFilesTable = pgTable(
  "code_files",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => codeProjectsTable.id, { onDelete: "cascade" }),
    // Repository-style path, e.g. TeamCode/src/main/java/org/.../MyOpMode.java
    path: text("path").notNull(),
    content: text("content").notNull().default(""),
    updatedBy: text("updated_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniquePath: uniqueIndex("code_files_project_path_unique").on(table.projectId, table.path),
    byProject: index("code_files_project_idx").on(table.projectId),
    pathLength: check(
      "code_files_path_length_valid",
      sql`length(${table.path}) between 1 and 255`,
    ),
    contentSize: check(
      "code_files_content_size_valid",
      sql`octet_length(${table.content}) <= 500000`,
    ),
  }),
);

export const codeRevisionsTable = pgTable(
  "code_revisions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => codeProjectsTable.id, { onDelete: "cascade" }),
    message: text("message").notNull(),
    author: text("author"),
    // Snapshot: [{ path, content }]
    snapshot: jsonb("snapshot").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byProject: index("code_revisions_project_idx").on(table.projectId, table.createdAt),
  }),
);

export const codePresenceTable = pgTable(
  "code_presence",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => codeProjectsTable.id, { onDelete: "cascade" }),
    fileId: text("file_id"),
    displayName: text("display_name").notNull(),
    color: text("color").notNull().default("#f8c84a"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    byProject: index("code_presence_project_idx").on(table.projectId, table.updatedAt),
  }),
);

export type CodeProject = typeof codeProjectsTable.$inferSelect;
export type CodeFile = typeof codeFilesTable.$inferSelect;
export type CodeRevision = typeof codeRevisionsTable.$inferSelect;
