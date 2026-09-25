import { createServer } from "node:http";
import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime } from "./lib/realtime";
import { setupWhiteboardCollaboration } from "./lib/whiteboardCollaboration";
import { setupDocumentCollaboration } from "./lib/documentCollaboration";
import { pool, db, interviewQueueTable } from "@workspace/db";
import { syncInterviewerAccounts } from "./lib/interviewerAccounts";

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
    `create table if not exists "chat_custom_emojis" ("id" text primary key, "name" text not null unique, "image_path" text not null unique, "content_type" text not null, "created_by" text not null, "created_at" timestamptz not null default now())`,
    `create table if not exists "interview_whiteboards" ("id" text primary key, "title" text not null, "data" text not null, "created_by" text not null, "conversation_scope" text not null default 'shared', "conversation_peer" text, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `create index if not exists "interview_whiteboards_conversation_updated_idx" on "interview_whiteboards" ("conversation_scope", "conversation_peer", "updated_at")`,
    `create table if not exists "interviewer_accounts" ("id" text primary key, "display_name" text not null, "normalized_name" text not null unique, "password_hash" text, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now())`,
    `alter table "dashboard_charts" add column if not exists "owner_id" text`,
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
  ensureSchema().catch((err) => {
    logger.error({ err }, "Schema migration failed; exiting");
    process.exit(1);
  });
});
