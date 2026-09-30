import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime } from "./lib/realtime";
import { setupWhiteboardCollaboration } from "./lib/whiteboardCollaboration";
import { setupDocumentCollaboration } from "./lib/documentCollaboration";
import { pool, db, interviewQueueTable } from "@workspace/db";
import { syncInterviewerAccounts } from "./lib/interviewerAccounts";
import { syncPublicPartsCatalogs } from "./routes/parts";

initRealtime();

// Self-healing schema: additive columns the code depends on are created at
// boot when missing, so a deploy never needs a separate migration step.
async function ensureSchema(): Promise<void> {
  const privateTableRlsStatements = [
    "applicants",
    "application_imports",
    "assistant_conversations",
    "assistant_messages",
    "audit_logs",
    "broadcast_acks",
    "broadcasts",
    "chat_custom_emojis",
    "chat_message_reactions",
    "dashboard_charts",
    "data_snapshots",
    "display_settings",
    "interview_chat_messages",
    "interview_queue",
    "interview_whiteboards",
    "interviewer_accounts",
    "page_visits",
    "parts_catalog_items",
    "parts_catalog_sync_state",
    "parts_inventory",
    "parts_robots",
    "parts_robot_allocations",
    "presence_heartbeats",
    "revoked_sessions",
    "seating_settings",
    "whiteboards",
  ].map((tableName) => `
    DO $rls$
    BEGIN
      IF to_regclass('public.${tableName}') IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY';

        IF NOT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE schemaname = 'public'
            AND tablename = '${tableName}'
            AND policyname = 'deny_supabase_client_access'
        ) THEN
          BEGIN
            EXECUTE 'CREATE POLICY deny_supabase_client_access ON public.${tableName} AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)';
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END IF;
    END
    $rls$
  `);

  const statements = [
    `alter table "applicants" add column if not exists "flagged" boolean not null default false`,
    `alter table "interviewer_accounts" add column if not exists "role" text not null default 'coordinator'`,
    `alter table "dashboard_charts" add column if not exists "x_axis" text`,
    `alter table "dashboard_charts" add column if not exists "y_axis" text`,
    `alter table "interview_chat_messages" add column if not exists "parent_message_id" text references "interview_chat_messages"("id") on delete cascade`,
    `alter table "interview_chat_messages" add column if not exists "pinned_at" timestamptz`,
    `alter table "interview_chat_messages" add column if not exists "conversation_scope" text not null default 'shared'`,
    `alter table "interview_chat_messages" add column if not exists "conversation_peer" text`,
    `create index if not exists "interview_chat_messages_conversation_created_idx" on "interview_chat_messages" ("conversation_scope", "conversation_peer", "created_at")`,
    `create table if not exists "chat_message_reactions" ("id" text primary key, "message_id" text not null references "interview_chat_messages"("id") on delete cascade, "emoji" text not null, "author" text not null, "created_at" timestamptz not null default now())`,
    `create unique index if not exists "chat_message_reactions_unique" on "chat_message_reactions" ("message_id", "emoji", "author")`,
    `create table if not exists "chat_custom_emojis" ("id" text primary key, "name" text not null unique, "image_path" text not null unique, "content_type" text not null, "created_by" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "interview_whiteboards" ("id" text primary key, "title" text not null, "data" text not null, "created_by" text not null, "conversation_scope" text not null default 'shared', "conversation_peer" text, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create index if not exists "interview_whiteboards_conversation_updated_idx" on "interview_whiteboards" ("conversation_scope", "conversation_peer", "updated_at")`,
    `create table if not exists "interviewer_accounts" ("id" text primary key, "display_name" text not null, "normalized_name" text not null unique, "password_hash" text, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `alter table "dashboard_charts" add column if not exists "owner_id" text`,
    `create table if not exists "parts_catalog_items" ("id" text primary key, "vendor_key" text not null, "external_key" text not null, "name" text not null, "sku" text, "category" text, "description" text, "product_url" text, "image_url" text, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create unique index if not exists "parts_catalog_vendor_external_key_unique" on "parts_catalog_items" ("vendor_key", "external_key")`,
    `create index if not exists "parts_catalog_vendor_name_idx" on "parts_catalog_items" ("vendor_key", lower("name"))`,
    `create table if not exists "parts_catalog_sync_state" ("id" text primary key check ("id" = 'global'), "last_attempted_at" timestamptz, "last_completed_at" timestamptz)`,
    `insert into "parts_catalog_sync_state" ("id") values ('global') on conflict ("id") do nothing`,
    `create table if not exists "parts_inventory" ("part_id" text primary key references "parts_catalog_items"("id") on delete cascade, "quantity_owned" integer not null default 0 check ("quantity_owned" >= 0), "updated_at" timestamptz not null default now())`,
    `create table if not exists "parts_robots" ("id" text primary key, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create unique index if not exists "parts_robots_normalized_name_unique" on "parts_robots" (lower("name"))`,
    `create table if not exists "parts_robot_allocations" ("id" text primary key, "robot_id" text not null references "parts_robots"("id") on delete cascade, "part_id" text not null references "parts_catalog_items"("id") on delete cascade, "quantity" integer not null check ("quantity" > 0), "updated_at" timestamptz not null default now())`,
    `create unique index if not exists "parts_robot_allocations_robot_part_unique" on "parts_robot_allocations" ("robot_id", "part_id")`,
    ...privateTableRlsStatements,
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      logger.error({ err, sql }, "Schema migration failed");
      throw err;
    }
  }
  const [queue] = await db.select().from(interviewQueueTable).limit(1);
  try {
    const labels = JSON.parse(queue?.interviewerLabels ?? '["Interviewer 1","Interviewer 2"]');
    if (Array.isArray(labels)) await syncInterviewerAccounts(labels.filter((label): label is string => typeof label === "string"));
  } catch {
    await syncInterviewerAccounts(["Interviewer 1", "Interviewer 2"]);
  }
  logger.info("Schema check passed");
}

async function syncPartsCatalogsIfDue(): Promise<void> {
  const claim = await pool.query(
    `insert into "parts_catalog_sync_state" ("id", "last_attempted_at")
     values ('global', now())
     on conflict ("id") do update set "last_attempted_at" = now()
     where "parts_catalog_sync_state"."last_attempted_at" is null
        or "parts_catalog_sync_state"."last_attempted_at" < now() - interval '24 hours'
     returning "id"`,
  );
  if (claim.rowCount === 0) return;

  logger.info("Starting scheduled public supplier catalog sync");
  try {
    const summary = await syncPublicPartsCatalogs();
    await pool.query(
      `update "parts_catalog_sync_state" set "last_completed_at" = now()
       where "id" = 'global'`,
    );
    logger.info(
      {
        vendors: summary.vendors.length,
        totalItems: summary.totalItems,
        created: summary.created,
        updated: summary.updated,
        availableVendors: summary.vendors.filter((vendor) => vendor.status === "synced").length,
      },
      "Scheduled public supplier catalog sync completed",
    );
  } catch (error) {
    await pool.query(
      `update "parts_catalog_sync_state"
       set "last_attempted_at" = now() - interval '23 hours'
       where "id" = 'global'`,
    );
    logger.error({ err: error }, "Scheduled public supplier catalog sync failed");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);
setupDocumentCollaboration(server);
setupWhiteboardCollaboration(server);

server.listen(port, () => {
  logger.info({ port }, "Server listening");
  ensureSchema()
    .then(() => {
      void syncPartsCatalogsIfDue().catch((err) => {
        logger.error({ err }, "Unable to start scheduled public supplier catalog sync");
      });
      const catalogRefreshCheck = setInterval(() => {
        void syncPartsCatalogsIfDue().catch((err) => {
          logger.error({ err }, "Unable to check scheduled public supplier catalog sync");
        });
      }, 60 * 60 * 1000);
      catalogRefreshCheck.unref();
    })
    .catch((err) => {
      logger.error({ err }, "Schema migration failed; exiting");
      process.exit(1);
    });
});
