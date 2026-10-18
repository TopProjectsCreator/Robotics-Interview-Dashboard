import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { ensureRealtimePublication, initRealtime } from "./lib/realtime";
import { setupWhiteboardCollaboration } from "./lib/whiteboardCollaboration";
import { setupDocumentCollaboration } from "./lib/documentCollaboration";
import { setupCodeCollaboration } from "./lib/codeCollaboration";
import { pool, db, secondaryPool, hasSecondary, interviewQueueTable } from "@workspace/db";
import { syncInterviewerAccounts } from "./lib/interviewerAccounts";
import { startSitemapCatalogCrawler, syncPublicPartsCatalogs } from "./routes/parts";
import { startScheduledChatDispatcher } from "./routes/robotics";

initRealtime();

// One-time removal of test accounts created during development. Best
// effort and non-fatal; safe to keep running (no-op once they are gone).
async function removeTestAccounts(): Promise<void> {
  // Development/verification accounts, matched by explicit name AND by
  // pattern so a probe created and forgotten during testing can never
  // survive a deploy. The same predicate is applied to accounts, their chat
  // history and the interviewer labels — stripping the labels matters,
  // otherwise a deleted account is re-created (passwordless) from the
  // stale label on the next boot.
  const TEST_NAMES = [
    'TempVerify', 'RoleTest', 'DMCheck', 'MsgCheck', 'UpCheck', 'PartsCheck',
    'VerifyParts', 'RobotCheck', 'FinalPeek', 'TreasCheck', 'TreasMatrix',
    'MatrixTwo', 'DmAlice', 'DmBob', 'ModCheck', 'ChatTrim', 'AiDel',
    'PollA', 'PollB', 'PollC', 'PollD', 'NotifyCheck', 'NotifyProbe',
    'BigFile', 'CadCheck', 'StepCheck', 'Probe', 'TestBot', 'MonitorCheck',
    'BotProbe', 'LimitCheck', 'RenameProbe', 'RenameTry', 'Renamed Person',
    'Label Prop Test', 'CtxCheck', 'SlowUser', 'LoopRunner', 'FeatureFan', 'IdeaPerson',
    'EgressRunner', 'DiagRunner', 'QuotaCheck', 'MemCheck', 'FinalCheck', 'GateMember',
    'GateAdmin', 'NewHostProbe', 'BotCheck', 'BotCase', 'BotTrial', 'TestTeam',
    'test', 'test2', 'test3',
  ];
  // Test-style names are matched as WHOLE WORDS only. Substring matching here is
  // destructive: "%bot%" also matches real accounts like "Shriyash Incredibots"
  // (incredi-BOT-s), "%temp%" matches "Tempest", "%test%" matches "Contestant".
  // A loose pattern silently deletes a real teammate's account on every boot.
  const TEST_NAME_REGEX = '^(.*[\\s._-])?(check|probe|verify|temp|test|bot)([\\s._-].*)?$';
  // Probe accounts I create carry this prefix so they always clean up without
  // relying on substring guesses.
  const PROBE_NAME_PREFIX = 'zxprobe';
  try {
    // [exact names, word-boundary regex, probe prefix]
    const params = [
      TEST_NAMES.map((name) => name.toLowerCase()),
      TEST_NAME_REGEX,
      `${PROBE_NAME_PREFIX}%`,
    ];
    await pool.query(
      `delete from interview_chat_messages
        where lower(author) = any($1::text[])
           or lower(author) ~ $2::text
           or lower(author) like $3::text`,
      params,
    );
    await pool.query(
      `delete from interviewer_accounts
        where lower(normalized_name) = any($1::text[])
           or lower(normalized_name) ~ $2::text
           or lower(normalized_name) like $3::text`,
      params,
    );
    await pool.query(
      `delete from feature_requests
        where lower(author_name) = any($1::text[])
           or lower(author_name) ~ $2::text
           or lower(author_name) like $3::text`,
      params,
    );
    await pool.query(
      `delete from parts_robots where lower(name) in ('previewverify', 'verifybot', 'verifybotrenamed', 'previewcheck', 'previewcheck2')`,
    );
    await pool.query(
      `update interview_queue set interviewer_labels = (
         select coalesce(jsonb_agg(elem), '[]'::jsonb)::text
           from jsonb_array_elements_text(interviewer_labels::jsonb) as elem
          where not (
            lower(elem) = any($1::text[])
            or lower(elem) ~ $2::text
            or lower(elem) like $3::text
          )
       ) where id = 1`,
      params,
    );
    logger.info("Test accounts cleanup done");
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
    "assistant_skills",
    "audit_logs",
    "broadcast_acks",
    "broadcasts",
    "chat_custom_emojis",
    "chat_message_reactions",
    "chat_message_reads",
    "chat_polls",
    "chat_poll_votes",
    "scheduled_chat_messages",
    "cad_bots",
    "cad_folders",
    "cad_models",
    "code_projects",
    "code_files",
    "code_revisions",
    "code_presence",
    "custom_workspaces",
    "custom_workspace_versions",
    "custom_workspace_data",
    "workspace_settings",
    "dashboard_charts",
    "data_snapshots",
    "display_settings",
    "interview_chat_messages",
    "interview_queue",
    "interview_whiteboards",
    "interviewer_accounts",
    "personal_notepad",
    "onshape_mcp_connections",
    "onshape_mcp_oauth_states",
    "custom_mcp_connections",
    "custom_mcp_oauth_states",
    "page_visits",
    "parts_catalog_items",
    "parts_catalog_sync_state",
    "parts_catalog_crawl_skips",
    "parts_catalog_crawl_state",
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
    $rls$`)
    // Catch-all: RLS is enabled on EVERY table in the public schema, including
    // any table a later migration adds. A hardcoded list silently leaves new
    // tables exposed to PostgREST, which is how teams/webauthn_credentials/
    // chunked_uploads were found unguarded on the second instance.
    .concat(`
    DO $rls_all$
    DECLARE
      target text;
    BEGIN
      FOR target IN
        SELECT tablename FROM pg_tables
         WHERE schemaname = 'public'
           AND NOT rowsecurity
      LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target);
      END LOOP;

      FOR target IN
        SELECT c.relname
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r'
      LOOP
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
           WHERE schemaname = 'public'
             AND tablename = target
             AND policyname = 'deny_supabase_client_access'
        ) THEN
          BEGIN
            EXECUTE format('CREATE POLICY deny_supabase_client_access ON public.%I AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)', target);
          EXCEPTION
            WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END LOOP;
    END
    $rls_all$`
    );

  const statements = [
    `create table if not exists "custom_workspaces" (
       "id" text primary key,
       "team_id" text,
       "title" text not null check (length("title") between 1 and 120),
       "description" text not null default '',
       "prompt" text not null,
       "html" text not null check (octet_length("html") <= 120000),
       "capabilities" jsonb not null default '[]'::jsonb,
       "status" text not null default 'draft' check ("status" in ('draft', 'published')),
       "access_mode" text not null default 'team' check ("access_mode" in ('team', 'owner', 'selected')),
       "allowed_interviewer_ids" jsonb not null default '[]'::jsonb,
       "created_by" text not null,
       "created_at" timestamptz not null default now(),
       "updated_at" timestamptz not null default now()
     )`,
    `alter table "custom_workspaces" add column if not exists "access_mode" text not null default 'team'`,
    `alter table "custom_workspaces" add column if not exists "allowed_interviewer_ids" jsonb not null default '[]'::jsonb`,
    `do $custom_access$
       begin
         if not exists (
           select 1 from pg_constraint
            where conrelid = '"custom_workspaces"'::regclass
              and conname = 'custom_workspaces_access_mode_check'
              and pg_get_constraintdef(oid) like '%selected%'
         ) then
           alter table "custom_workspaces" drop constraint if exists "custom_workspaces_access_mode_check";
           alter table "custom_workspaces" add constraint "custom_workspaces_access_mode_check"
             check ("access_mode" in ('team', 'owner', 'selected'));
         end if;
       end;
     $custom_access$`,
    `create index if not exists "custom_workspaces_team_updated_idx" on "custom_workspaces" ("team_id", "updated_at" desc)`,
    `create table if not exists "custom_workspace_versions" (
       "id" text primary key,
       "team_id" text,
       "workspace_id" text not null references "custom_workspaces"("id") on delete cascade,
       "html" text not null check (octet_length("html") <= 120000),
       "capabilities" jsonb not null default '[]'::jsonb,
       "created_by" text not null,
       "message" text not null default '',
       "created_at" timestamptz not null default now()
     )`,
    `create index if not exists "custom_workspace_versions_workspace_idx" on "custom_workspace_versions" ("workspace_id", "created_at" desc)`,
    `create table if not exists "custom_workspace_data" (
       "id" text primary key,
       "team_id" text,
       "workspace_id" text not null references "custom_workspaces"("id") on delete cascade,
       "value" jsonb not null,
       "created_at" timestamptz not null default now(),
       "updated_at" timestamptz not null default now()
     )`,
    `create index if not exists "custom_workspace_data_scope_idx" on "custom_workspace_data" ("team_id", "workspace_id", "updated_at" desc)`,
    `alter table "applicants" add column if not exists "flagged" boolean not null default false`,
    `alter table "dashboard_charts" add column if not exists "x_axis" text`,
    `alter table "dashboard_charts" add column if not exists "y_axis" text`,
    `alter table "interview_chat_messages" add column if not exists "parent_message_id" text references "interview_chat_messages"("id") on delete cascade`,
    `alter table "interview_chat_messages" add column if not exists "pinned_at" timestamptz`,
    `alter table "interview_chat_messages" add column if not exists "conversation_scope" text not null default 'shared'`,
    `alter table "interview_chat_messages" add column if not exists "conversation_peer" text`,
    `alter table "interview_chat_messages" add column if not exists "edited_at" timestamptz`,
    `alter table "interview_chat_messages" add column if not exists "deleted_at" timestamptz`,
    `create index if not exists "interview_chat_messages_conversation_created_idx" on "interview_chat_messages" ("conversation_scope", "conversation_peer", "created_at")`,
    `create table if not exists "chat_message_reactions" ("id" text primary key, "message_id" text not null references "interview_chat_messages"("id") on delete cascade, "emoji" text not null, "author" text not null, "created_at" timestamptz not null default now())`,
    `create unique index if not exists "chat_message_reactions_unique" on "chat_message_reactions" ("message_id", "emoji", "author")`,
    `create table if not exists "chat_message_reads" ("id" text primary key, "team_id" text, "message_id" text not null references "interview_chat_messages"("id") on delete cascade, "reader_id" text not null, "reader_name" text not null, "read_at" timestamptz not null default now())`,
    `create unique index if not exists "chat_message_reads_message_reader_unique" on "chat_message_reads" ("message_id", "reader_id")`,
    `alter table "chat_message_reads" add column if not exists "team_id" text`,
    `create table if not exists "chat_settings" ("id" text primary key default '1', "slowmode_seconds" integer not null default 0, "updated_at" timestamptz not null default now())`,
    `create table if not exists "chunked_uploads" ("upload_id" text primary key, "file_name" text not null, "content_type" text not null, "size_bytes" integer not null default 0, "total_parts" integer not null, "part_size_bytes" integer not null, "created_by" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "chat_polls" ("message_id" text primary key references "interview_chat_messages"("id") on delete cascade, "question" text not null, "options" text not null, "created_by" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "chat_poll_votes" ("id" text primary key, "message_id" text not null references "interview_chat_messages"("id") on delete cascade, "option_index" integer not null, "voter" text not null, "created_at" timestamptz not null default now())`,
    `create unique index if not exists "chat_poll_votes_one_per_voter" on "chat_poll_votes" ("message_id", "voter")`,
    `create table if not exists "chat_custom_emojis" ("id" text primary key, "name" text not null unique, "image_path" text not null unique, "content_type" text not null, "created_by" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "scheduled_chat_messages" ("id" text primary key, "team_id" text, "author" text not null, "created_by" text not null, "conversation_scope" text not null default 'shared', "conversation_peer" text, "recipient" text, "message" text not null, "parent_message_id" text, "poll_question" text, "poll_options" text, "scheduled_at" timestamptz not null, "status" text not null default 'pending', "attempts" integer not null default 0, "last_error" text, "sent_message_id" text, "created_at" timestamptz not null default now())`,
    `create index if not exists "scheduled_chat_messages_due_idx" on "scheduled_chat_messages" ("status", "scheduled_at")`,
    `create table if not exists "interview_whiteboards" ("id" text primary key, "title" text not null, "data" text not null, "created_by" text not null, "conversation_scope" text not null default 'shared', "conversation_peer" text, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create index if not exists "interview_whiteboards_conversation_updated_idx" on "interview_whiteboards" ("conversation_scope", "conversation_peer", "updated_at")`,
    `create table if not exists "interviewer_accounts" ("id" text primary key, "display_name" text not null, "normalized_name" text not null unique, "password_hash" text, "role" text not null default 'coordinator', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `alter table "interviewer_accounts" add column if not exists "role" text not null default 'coordinator'`,
    `create table if not exists "webauthn_credentials" (
       "id" text primary key,
       "interviewer_id" text not null references "interviewer_accounts"("id") on delete cascade,
       "credential_id" text not null unique,
       "public_key" text not null,
       "counter" integer not null default 0,
       "transports" text not null default '[]',
       "label" text,
       "created_at" timestamptz not null default now(),
       "last_used_at" timestamptz
     )`,
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
    // Lease row for the background sitemap crawler. Autoscaled deployments run
    // several server instances, so an in-process flag is not enough to stop two
    // of them crawling the same supplier and doubling the request rate against a
    // host that asks for a delay between fetches.
    `create table if not exists "parts_catalog_crawl_state" ("id" text primary key check ("id" = 'global'), "claimed_at" timestamptz)`,
    `insert into "parts_catalog_crawl_state" ("id") values ('global') on conflict ("id") do nothing`,
    // Sitemap URLs the crawl has stopped retrying. The pending set is "sitemap
    // URLs minus indexed URLs", so a URL that never yields a product row would
    // otherwise be re-fetched on every slice forever: the supplier could never
    // converge, and the crawler would keep asking a host for a page it has already
    // declined to serve as a product. Recording the refusal is what makes the
    // first pass provably finite.
    `create table if not exists "parts_catalog_crawl_skips" ("vendor_key" text not null, "product_url" text not null, "reason" text not null, "attempts" integer not null default 1, "updated_at" timestamptz not null default now(), primary key ("vendor_key", "product_url"))`,
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
    `create table if not exists "code_projects" (
       "id" text primary key,
       "name" text not null check (length("name") between 1 and 120),
       "sdk_version" text not null default 'v12.0',
       "git_config" jsonb not null default '{}'::jsonb,
       "created_by" text,
       "created_at" timestamptz not null default now(),
       "updated_at" timestamptz not null default now()
     )`,
    `create unique index if not exists "code_projects_normalized_name_unique" on "code_projects" (lower("name"))`,
    `create table if not exists "code_files" (
       "id" text primary key,
       "project_id" text not null references "code_projects"("id") on delete cascade,
       "path" text not null check (length("path") between 1 and 255),
       "content" text not null default '' check (octet_length("content") <= 500000),
       "updated_by" text,
       "created_at" timestamptz not null default now(),
       "updated_at" timestamptz not null default now()
     )`,
    `create unique index if not exists "code_files_project_path_unique" on "code_files" ("project_id", "path")`,
    `create index if not exists "code_files_project_idx" on "code_files" ("project_id")`,
    `create table if not exists "code_revisions" (
       "id" text primary key,
       "project_id" text not null references "code_projects"("id") on delete cascade,
       "message" text not null,
       "author" text,
       "snapshot" jsonb not null,
       "created_at" timestamptz not null default now()
     )`,
    `create index if not exists "code_revisions_project_idx" on "code_revisions" ("project_id", "created_at")`,
    `create table if not exists "code_presence" (
       "id" text primary key,
       "project_id" text not null references "code_projects"("id") on delete cascade,
       "file_id" text,
       "display_name" text not null,
       "color" text not null default '#f8c84a',
       "updated_at" timestamptz not null default now()
     )`,
    `create index if not exists "code_presence_project_idx" on "code_presence" ("project_id", "updated_at")`,
    // Multi-team migration: every tenant table carries a nullable team_id
    // (NULL = legacy row of the default team); the teams table holds each
    // team's access-code hash. All statements are idempotent.
    `create table if not exists "teams" ("id" text primary key, "name" text not null, "normalized_name" text not null unique, "code_hash" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `alter table "teams" add column if not exists "logo_path" text`,
    `alter table "teams" add column if not exists "primary_color" text`,
    `alter table "applicants" add column if not exists "team_id" text`,
    `alter table "application_imports" add column if not exists "team_id" text`,
    `alter table "assistant_conversations" add column if not exists "team_id" text`,
    `alter table "assistant_messages" add column if not exists "team_id" text`,
    `alter table "broadcasts" add column if not exists "team_id" text`,
    `alter table "cad_bots" add column if not exists "team_id" text`,
    `alter table "cad_folders" add column if not exists "team_id" text`,
    `alter table "cad_models" add column if not exists "team_id" text`,
    `alter table "chat_custom_emojis" add column if not exists "team_id" text`,
    `alter table "chat_message_reactions" add column if not exists "team_id" text`,
    `alter table "chat_poll_votes" add column if not exists "team_id" text`,
    `alter table "chat_polls" add column if not exists "team_id" text`,
    `alter table "chat_settings" add column if not exists "team_id" text`,
    `alter table "chunked_uploads" add column if not exists "team_id" text`,
    `alter table "code_files" add column if not exists "team_id" text`,
    `alter table "code_presence" add column if not exists "team_id" text`,
    `alter table "code_projects" add column if not exists "team_id" text`,
    `alter table "code_revisions" add column if not exists "team_id" text`,
    `alter table "dashboard_charts" add column if not exists "team_id" text`,
    `alter table "data_snapshots" add column if not exists "team_id" text`,
    `alter table "display_settings" add column if not exists "team_id" text`,
    `alter table "interview_chat_messages" add column if not exists "team_id" text`,
    `alter table "interview_queue" add column if not exists "team_id" text`,
    `alter table "interview_whiteboards" add column if not exists "team_id" text`,
    `alter table "interviewer_accounts" add column if not exists "team_id" text`,
    `alter table "page_visits" add column if not exists "team_id" text`,
    `alter table "parts_catalog_items" add column if not exists "team_id" text`,
    `alter table "parts_inventory" add column if not exists "team_id" text`,
    `alter table "parts_robots" add column if not exists "team_id" text`,
    `alter table "parts_supplier_sync_states" add column if not exists "team_id" text`,
    `alter table "presence_heartbeats" add column if not exists "team_id" text`,
    `alter table "seating_settings" add column if not exists "team_id" text`,
    `alter table "workspace_settings" add column if not exists "team_id" text`,
    // Feature requests inbox for the site owner (Ishaan Bansal): every
    // team's requests land here. is_site_owner is set once by the migration
    // below; all statements idempotent.
    `create table if not exists "feature_requests" ("id" text primary key, "team_id" text, "author_id" text, "author_name" text not null, "message" text not null, "status" text not null default 'open', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `alter table "interviewer_accounts" add column if not exists "is_site_owner" boolean not null default false`,
    `update "interviewer_accounts" set "is_site_owner" = true, "updated_at" = now() where "is_site_owner" = false and "normalized_name" in ('ishaan bansal', 'ishaan') and ("team_id" is null or "team_id" = 'default')`,
    `alter table "applicants" add column if not exists "photo_thumb_url" text`,
    // Core tables below predate the boot-DDL array on the primary (created
    // via drizzle-kit push), but a FRESH secondary boots from this array
    // alone — so every table needs a CREATE here. All idempotent.
    `create table if not exists "applicants" ("id" text primary key, "team_id" text, "name" text not null, "grade" text not null default 'Unknown', "age" integer, "gender" text, "email" text, "photo_url" text, "photo_thumb_url" text, "transcript" text, "attachments" text, "ai_score" integer not null default -1, "ai_recommendation" text not null default 'Review', "ai_summary" text not null default '', "ai_strengths" text not null default '', "ai_concerns" text not null default '', "robotics_experience" text not null default '', "commit_10_hours" text not null default 'Unclear', "parent_volunteer" text not null default 'Unclear', "interview_status" text not null default 'queued', "interviewer" text not null default '', "interview_decision" text not null default 'Undecided', "callback_requested" boolean not null default false, "flagged" boolean not null default false, "attendance" text not null default 'unmarked', "late_arrival_time" text, "makeup_date" text, "attendance_excused" boolean, "seat_row" integer, "seat_col" integer, "category" text not null default 'Unsorted', "rank" integer not null default 0, "notes" text not null default '', "queue_position" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create table if not exists "interview_queue" ("id" integer primary key default 1, "team_id" text, "interviewer_labels" text not null default '["Interviewer 1","Interviewer 2"]', "updated_at" timestamptz not null default now())`,
    `create table if not exists "interview_chat_messages" ("id" text primary key, "team_id" text, "author" text not null, "message" text not null, "conversation_scope" text not null default 'shared', "conversation_peer" text, "activities" text not null default '[]', "parent_message_id" text, "pinned_at" timestamptz, "edited_at" timestamptz, "deleted_at" timestamptz, "created_at" timestamptz not null default now())`,
    `create table if not exists "personal_notepad" ("account_id" text primary key references "interviewer_accounts"("id") on delete cascade, "team_id" text not null, "content" text not null default '<p></p>', "updated_at" timestamptz not null default now())`,
    `create table if not exists "application_imports" ("id" text primary key, "team_id" text, "object_path" text not null, "file_name" text not null, "row_count" integer not null, "imported_count" integer not null default 0, "skipped_count" integer not null default 0, "delimiter" text not null default ',', "warnings" text not null default '[]', "diff_summary" text not null default '{}', "created_at" timestamptz not null default now())`,
    `create table if not exists "assistant_conversations" ("id" text primary key, "team_id" text, "title" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create table if not exists "assistant_messages" ("id" text primary key, "team_id" text, "conversation_id" text, "question" text not null, "answer" text not null, "applicant_ids" text not null default '[]', "activities" text not null default '[]', "created_at" timestamptz not null default now())`,
    `create table if not exists "assistant_skills" (
       "id" text primary key,
       "team_id" text not null,
       "name" text not null check (length("name") between 1 and 80),
       "description" text not null check (length("description") between 1 and 500),
       "instructions" text not null check (length("instructions") between 1 and 8000),
       "actions" jsonb not null default '[]'::jsonb check (jsonb_typeof("actions") = 'array'),
       "enabled" boolean not null default true,
       "created_at" timestamptz not null default now(),
       "updated_at" timestamptz not null default now()
     )`,
    `create unique index if not exists "assistant_skills_team_name_unique" on "assistant_skills" ("team_id", lower("name"))`,
    `create index if not exists "assistant_skills_team_enabled_idx" on "assistant_skills" ("team_id", "enabled")`,
    `create table if not exists "onshape_mcp_connections" ("account_id" text primary key references "interviewer_accounts"("id") on delete cascade, "team_id" text not null, "client_id" text not null, "access_token" jsonb not null, "refresh_token" jsonb, "expires_at" timestamptz not null, "scopes" text not null default '', "updated_at" timestamptz not null default now())`,
    `create table if not exists "onshape_mcp_oauth_states" ("id" text primary key, "state_hash" text not null unique, "account_id" text not null references "interviewer_accounts"("id") on delete cascade, "team_id" text not null, "client_id" text not null, "redirect_uri" text not null, "code_verifier" jsonb not null, "return_origin" text not null, "created_at" timestamptz not null default now())`,
    `create index if not exists "onshape_mcp_oauth_states_created_idx" on "onshape_mcp_oauth_states" ("created_at")`,
    `create table if not exists "custom_mcp_connections" ("account_id" text primary key references "interviewer_accounts"("id") on delete cascade, "team_id" text not null, "endpoint_url" text not null, "access_token" jsonb, "refresh_token" jsonb, "client_id" text, "token_endpoint" text, "expires_at" timestamptz, "updated_at" timestamptz not null default now())`,
    `alter table "custom_mcp_connections" add column if not exists "refresh_token" jsonb`,
    `alter table "custom_mcp_connections" add column if not exists "client_id" text`,
    `alter table "custom_mcp_connections" add column if not exists "token_endpoint" text`,
    `alter table "custom_mcp_connections" add column if not exists "expires_at" timestamptz`,
    `alter table "custom_mcp_connections" add column if not exists "api_key" jsonb`,
    `alter table "custom_mcp_connections" add column if not exists "api_key_header" text`,
    `alter table "custom_mcp_connections" add column if not exists "api_key_prefix" text`,
    `create table if not exists "custom_mcp_oauth_states" ("id" text primary key, "state_hash" text not null unique, "account_id" text not null references "interviewer_accounts"("id") on delete cascade, "team_id" text not null, "endpoint_url" text not null, "resource_uri" text not null, "client_id" text not null, "token_endpoint" text not null, "authorization_endpoint" text not null, "redirect_uri" text not null, "code_verifier" jsonb not null, "created_at" timestamptz not null default now())`,
    `alter table "custom_mcp_oauth_states" add column if not exists "resource_uri" text not null default ''`,
    `create table if not exists "broadcasts" ("id" text primary key, "team_id" text, "message" text not null, "kind" text not null default 'message', "target_ip" text not null default '', "created_by" text not null default '', "created_at" timestamptz not null default now(), "expires_at" timestamptz not null default now())`,
    `create table if not exists "broadcast_acks" ("broadcast_id" text not null, "session_hash" text not null, "acked_at" timestamptz not null default now())`,
    `create table if not exists "dashboard_charts" ("id" text primary key, "team_id" text, "owner_id" text, "source" text not null, "chart" text not null, "x_axis" text, "y_axis" text, "position" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create table if not exists "data_snapshots" ("id" text primary key, "team_id" text, "label" text not null, "created_by" text not null default 'coordinator', "applicant_count" integer not null default 0, "payload" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "display_settings" ("id" integer primary key default 1, "team_id" text, "custom_headline" text, "custom_subheadline" text, "show_names" boolean not null default true, "announce" boolean not null default true, "updated_at" timestamptz not null default now())`,
    `create table if not exists "page_visits" ("id" text primary key, "team_id" text, "session_hash" text not null, "ip" text not null default '', "page" text not null default '', "entered_at" timestamptz not null default now(), "exited_at" timestamptz)`,
    `create table if not exists "presence_heartbeats" ("session_hash" text primary key, "team_id" text, "ip" text not null default 'unknown', "user_agent" text not null default '', "city" text not null default '', "region" text not null default '', "country" text not null default '', "page" text not null default '', "notify_permission" text not null default '', "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create table if not exists "revoked_sessions" ("token_hash" text primary key, "expires_at" timestamptz not null)`,
    `create table if not exists "seating_settings" ("id" integer primary key default 1, "team_id" text, "rows" integer not null default 4, "cols" integer not null default 6, "updated_at" timestamptz not null default now())`,
    `create table if not exists "parts_supplier_sync_states" ("vendor_key" text primary key, "status" text not null, "checked_at" timestamptz not null, "item_count" integer not null, "source" text not null, "message" text not null, constraint "parts_supplier_sync_states_valid_result" check ("status" in ('synced', 'search_only', 'unavailable', 'incomplete') and "item_count" >= 0))`,
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
  // Second instance (new teams): same schema, so fresh teams boot with every
  // table. Multi-pass because FK references (e.g. chat_polls -> the newly
  // added interview_chat_messages) only resolve once their target exists.
  // Never fatal — a secondary outage must not take primary teams down.
  if (hasSecondary()) {
    const secondary = secondaryPool();
    if (secondary) {
      let pending = [...statements];
      for (let pass = 0; pass < 4 && pending.length > 0; pass += 1) {
        const failed: string[] = [];
        for (const sql of pending) {
          try {
            await secondary.query(sql);
          } catch {
            failed.push(sql);
          }
        }
        if (failed.length === pending.length) break;
        pending = failed;
      }
      if (pending.length > 0) {
        logger.warn({ count: pending.length }, "Secondary schema statements still failing (non-fatal)");
      } else {
        logger.info("Secondary schema check passed");
      }
    }
  }
  try {
    const owners = await pool.query(`select "display_name" from "interviewer_accounts" where "is_site_owner" = true`);
    logger.info({ owners: owners.rows.map((row) => row.display_name) }, "Site owner flag ensured");
  } catch (err) {
    logger.warn({ err }, "Site owner check failed (non-fatal)");
  }
  // Tables must be in the supabase_realtime publication or the Supabase
  // relay subscribes to them forever without receiving a single event.
  // Idempotent and a no-op on plain Postgres; never block boot on it.
  try {
    await ensureRealtimePublication();
    if (hasSecondary()) {
      const secondary = secondaryPool();
      if (secondary) await ensureRealtimePublication(secondary);
    }
  } catch (err) {
    logger.warn({ err }, "Could not add tables to supabase_realtime publication");
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
setupCodeCollaboration(server);

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
      // Server-side scheduled chat delivery: posts due messages even when no
      // browser is open.
      startScheduledChatDispatcher();
      // Sitemap-backed suppliers (goBILDA) crawl themselves incrementally here.
      // The scheduled sync above only runs once a day, which is far too slow to
      // seed a 2,387-product catalog, so this loop owns the long first pass and
      // then settles into a cheap "anything new?" check.
      startSitemapCatalogCrawler();
    })
    .catch((err) => {
      logger.error({ err }, "Schema migration failed; exiting");
      process.exit(1);
    });
});
