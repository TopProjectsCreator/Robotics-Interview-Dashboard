import app from "./app";
import { logger } from "./lib/logger";
import { initRealtime } from "./lib/realtime";
import { pool } from "@workspace/db";

initRealtime();

// Self-healing schema: additive columns the code depends on are created at
// boot when missing, so a deploy never needs a separate migration step.
async function ensureSchema(): Promise<void> {
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
  ];
  for (const sql of statements) {
    try {
      await pool.query(sql);
    } catch (err) {
      logger.error({ err, sql }, "Schema migration failed");
      throw err;
    }
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

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  ensureSchema().catch((err) => {
    logger.error({ err }, "Schema migration failed; exiting");
    process.exit(1);
  });
});
