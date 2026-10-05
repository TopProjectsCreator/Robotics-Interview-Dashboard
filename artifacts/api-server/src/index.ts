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

// One-time removal of test accounts created during development. Best
// effort and non-fatal; safe to keep running (no-op once they are gone).
async function removeTestAccounts(): Promise<void> {
  // Development/verification accounts, matched by name rather than id so a
  // stray account can never survive by having its id missed here. Everything
  // else (real coordinators, interviewers and treasurers) is left untouched.
  const TEST_NAMES = [
    'TempVerify', 'RoleTest', 'DMCheck', 'MsgCheck', 'UpCheck', 'PartsCheck',
    'VerifyParts', 'RobotCheck', 'FinalPeek', 'TreasCheck', 'TreasMatrix',
    'MatrixTwo', 'DmAlice', 'DmBob', 'ModCheck', 'ChatTrim', 'AiDel',
    'PollA', 'PollB', 'PollC', 'PollD', 'NotifyCheck', 'NotifyProbe',
    'BigFile', 'CadCheck', 'StepCheck', 'Probe', 'TestBot',
    'CleanupBot', 'CleanupBot2', 'AdminCleaner', 'RealAdmin', 'ProbeBot',
    'test', 'test2', 'test3',
  ];
  try {
    const params = TEST_NAMES.map((name) => name.toLowerCase());

    await pool.query(
      `DELETE FROM interview_chat_messages
        WHERE lower(author) = ANY($1::text[])`,
      [params],
    );
    await pool.query(
      `DELETE FROM interviewer_accounts
        WHERE lower(normalized_name) = ANY($1::text[])
           OR lower(normalized_name) LIKE '%bot'`,
      [params],
    );
    await pool.query(
      `DELETE FROM parts_robots
        WHERE lower(name) IN ('previewverify', 'verifybot', 'verifybotrenamed', 'previewcheck', 'previewcheck2')`,
    );
    await pool.query(
      `UPDATE interview_queue
          SET interviewer_labels = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)::text
              FROM jsonb_array_elements_text(interviewer_labels::jsonb) AS elem
             WHERE lower(elem) <> ALL($1::text[])
          )
        WHERE id = 1`,
      [params],
    );
    logger.info({ removed: TEST_NAMES.length }, "Test accounts cleanup done");
  } catch (err) {
    logger.error({ err }, "Test accounts cleanup failed (non-fatal)");
  }
}


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
    "chat_polls",
    "chat_poll_votes",
    "chat_custom_emojis",
    "cad_bots",
    "cad_folders",
    "cad_models",
    "workspace_settings",
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
    "parts_supplier_price_snapshots",
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
    `alter table "dashboard_charts" add column if not exists "x_axis" text`,
    `alter table "dashboard_charts" add column if not exists "y_axis" text`,
    `alter table "interview_chat_messages" add column if not exists "parent_message_id" text references "interview_chat_messages"("id") on delete cascade`,
    `alter table "interview_chat_messages" add column if not exists "pinned_at" timestamptz`,
    `alter table "interview_chat_messages" add column if not exists "conversation_scope" text not null default 'shared'`,
    `alter table "interview_chat_messages" add column if not exists "conversation_peer" text`,
    `create index if not exists "interview_chat_messages_conversation_created_idx" on "interview_chat_messages" ("conversation_scope", "conversation_peer", "created_at")`,
    `create table if not exists "chat_message_reactions" ("id" text primary key, "message_id" text not null references "interview_chat_messages"("id") on delete cascade, "emoji" text not null, "author" text not null, "created_at" timestamptz not null default now())`,
    `create unique index if not exists "chat_message_reactions_unique" on "chat_message_reactions" ("message_id", "emoji", "author")`,
    `create table if not exists "chunked_uploads" ("upload_id" text primary key, "file_name" text not null, "content_type" text not null, "size_bytes" integer not null default 0, "total_parts" integer not null, "part_size_bytes" integer not null, "created_by" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "chat_polls" ("message_id" text primary key references "interview_chat_messages"("id") on delete cascade, "question" text not null, "options" text not null, "created_by" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "chat_poll_votes" ("id" text primary key, "message_id" text not null references "interview_chat_messages"("id") on delete cascade, "option_index" integer not null, "voter" text not null, "created_at" timestamptz not null default now())`,
    `create unique index if not exists "chat_poll_votes_one_per_voter" on "chat_poll_votes" ("message_id", "voter")`,
    `create table if not exists "chat_custom_emojis" ("id" text primary key, "name" text not null unique, "image_path" text not null unique, "content_type" text not null, "created_by" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "interview_whiteboards" ("id" text primary key, "title" text not null, "data" text not null, "created_by" text not null, "conversation_scope" text not null default 'shared', "conversation_peer" text, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create index if not exists "interview_whiteboards_conversation_updated_idx" on "interview_whiteboards" ("conversation_scope", "conversation_peer", "updated_at")`,
    `create table if not exists "interviewer_accounts" ("id" text primary key, "display_name" text not null, "normalized_name" text not null unique, "password_hash" text, "role" text not null default 'coordinator', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `alter table "interviewer_accounts" add column if not exists "role" text not null default 'coordinator'`,
    `alter table "dashboard_charts" add column if not exists "owner_id" text`,
    `create table if not exists "parts_catalog_items" ("id" text primary key, "vendor_key" text not null, "external_key" text not null, "name" text not null, "sku" text, "category" text, "description" text, "product_url" text, "image_url" text, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `alter table "parts_catalog_items" add column if not exists "is_manual" boolean not null default false`,
    `alter table "parts_catalog_items" add column if not exists "unit_cost" numeric(10,2)`,
    `alter table "parts_catalog_items" add column if not exists "cost_currency" text`,
    `do $parts_cost$ begin
       if not exists (select 1 from pg_constraint where conname = 'parts_catalog_saved_cost_valid') then
         alter table "parts_catalog_items" add constraint "parts_catalog_saved_cost_valid"
           check (("unit_cost" is null and "cost_currency" is null)
             or ("unit_cost" >= 0 and "unit_cost" <= 99999999.99
               and "cost_currency" is not null and "cost_currency" ~ '^[A-Z]{3}$'));
       end if;
     end $parts_cost$`,
    `create unique index if not exists "parts_catalog_vendor_external_key_unique" on "parts_catalog_items" ("vendor_key", "external_key")`,
    `create index if not exists "parts_catalog_vendor_name_idx" on "parts_catalog_items" ("vendor_key", lower("name"))`,
    `create table if not exists "parts_catalog_sync_state" ("id" text primary key check ("id" = 'global'), "last_attempted_at" timestamptz, "last_completed_at" timestamptz)`,
    `insert into "parts_catalog_sync_state" ("id") values ('global') on conflict ("id") do nothing`,
    `create table if not exists "parts_inventory" ("part_id" text primary key references "parts_catalog_items"("id") on delete cascade, "quantity_owned" integer not null default 0 check ("quantity_owned" >= 0), "updated_at" timestamptz not null default now())`,
    `create table if not exists "parts_robots" ("id" text primary key, "name" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `alter table "parts_robots" add column if not exists "preview_object_path" text`,
    `alter table "parts_robots" add column if not exists "preview_file_name" text`,
    `do $robots_name$ begin
       if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'parts_robots_name_unique') then
         if not exists (select 1 from "parts_robots" group by lower(name) having count(*) > 1) then
           create unique index parts_robots_name_unique on "parts_robots" (lower(name));
         end if;
       end if;
     end $robots_name$`,
    `alter table "parts_robots" add column if not exists "preview_content_type" text`,
    `do $robot_preview$ begin
       if not exists (select 1 from pg_constraint where conname = 'parts_robots_preview_metadata_valid') then
         alter table "parts_robots" add constraint "parts_robots_preview_metadata_valid"
           check (("preview_object_path" is null and "preview_file_name" is null and "preview_content_type" is null)
             or ("preview_object_path" ~ '^/objects/[A-Za-z0-9-]{8,128}$'
               and "preview_file_name" is not null and "preview_content_type" is not null
               and length("preview_file_name") between 1 and 255
               and length("preview_content_type") between 1 and 100));
       end if;
     end $robot_preview$`,
    `create unique index if not exists "parts_robots_normalized_name_unique" on "parts_robots" (lower("name"))`,
    `create table if not exists "parts_robot_allocations" ("id" text primary key, "robot_id" text not null references "parts_robots"("id") on delete cascade, "part_id" text not null references "parts_catalog_items"("id") on delete cascade, "quantity" integer not null check ("quantity" > 0), "updated_at" timestamptz not null default now())`,
    `create unique index if not exists "parts_robot_allocations_robot_part_unique" on "parts_robot_allocations" ("robot_id", "part_id")`,
    `create table if not exists "parts_supplier_price_snapshots" (
       "id" text primary key,
       "part_id" text not null references "parts_catalog_items"("id") on delete cascade,
       "unit_price" numeric(10,2) not null check ("unit_price" >= 0 and "unit_price" <= 99999999.99),
       "currency" text not null check ("currency" ~ '^[A-Z]{3}$'),
       "source_url" text not null check (length("source_url") between 1 and 2000),
       "captured_at" timestamptz not null default now(),
       "is_starting_at" boolean not null default false
     )`,
    `create index if not exists "parts_price_snapshots_part_captured_idx" on "parts_supplier_price_snapshots" ("part_id", "captured_at" desc)`,
    `create table if not exists "workspace_settings" (
       "id" integer primary key default 1 check ("id" = 1),
       "visibility" jsonb not null default '{"interview":["coordinator"],"chat":["coordinator","treasurer","interviewer"],"parts":["coordinator","treasurer","interviewer"],"cad":["coordinator"]}'::jsonb,
       "updated_at" timestamptz not null default now()
     )`,
    `create table if not exists "cad_bots" (
       "id" text primary key,
       "name" text not null check (length("name") between 1 and 120),
       "notes" text,
       "created_at" timestamptz not null default now(),
       "updated_at" timestamptz not null default now()
     )`,
    `create unique index if not exists "cad_bots_normalized_name_unique" on "cad_bots" (lower("name"))`,
    `create table if not exists "cad_folders" (
       "id" text primary key,
       "bot_id" text not null references "cad_bots"("id") on delete cascade,
       "parent_id" text references "cad_folders"("id") on delete cascade,
       "name" text not null check (length("name") between 1 and 120),
       "created_at" timestamptz not null default now(),
       "updated_at" timestamptz not null default now()
     )`,
    // COALESCE lets a NULL parent (top level) take part in the unique index, so
    // two sibling folders can never end up with the same name.
    `create unique index if not exists "cad_folders_sibling_name_unique" on "cad_folders" ("bot_id", coalesce("parent_id", ''), lower("name"))`,
    `create index if not exists "cad_folders_parent_idx" on "cad_folders" ("bot_id", "parent_id")`,
    `create table if not exists "cad_models" (
       "id" text primary key,
       "name" text not null check (length("name") between 1 and 255),
       "file_name" text not null check (length("file_name") between 1 and 255),
       "content_type" text not null,
       "object_path" text not null check ("object_path" ~ '^/objects/[A-Za-z0-9/-]{8,160}$'),
       "size_bytes" integer not null default 0 check ("size_bytes" >= 0),
       "bot_id" text references "cad_bots"("id") on delete set null,
       "folder_id" text references "cad_folders"("id") on delete set null,
       "notes" text,
       "uploaded_by" text,
       "created_at" timestamptz not null default now(),
       "updated_at" timestamptz not null default now()
     )`,
    `create index if not exists "cad_models_folder_idx" on "cad_models" ("bot_id", "folder_id")`,
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
  await removeTestAccounts();

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
