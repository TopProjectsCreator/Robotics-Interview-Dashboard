import type { Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { pool } from "@workspace/db";
import { logger } from "./logger";

// Tables whose changes are pushed to coordinator browsers. Payloads sent
// over SSE carry only the table name and event type — browsers refetch the
// actual rows through the authenticated JSON API, so no applicant data ever
// travels the realtime channel.
// Also used at boot to add these tables to the `supabase_realtime`
// publication, without which Supabase emits no postgres_changes for them.
export const REALTIME_WATCHED_TABLES = [
  "applicants",
  "interview_queue",
  "display_settings",
  "interview_chat_messages",
  "chat_message_reads",
  "broadcasts",
  "seating_settings",
  "dashboard_charts",
  "interview_whiteboards",
  "chat_settings",
  "code_files",
] as const;

export interface RealtimeHint {
  table: string;
  event: string;
}

type HintListener = (hint: RealtimeHint) => void;

const listeners = new Set<HintListener>();
let supabase: SupabaseClient | null = null;
let started = false;

export function addRealtimeListener(listener: HintListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function broadcast(hint: RealtimeHint): void {
  for (const listener of listeners) {
    try {
      listener(hint);
    } catch (error) {
      logger.error({ err: error }, "Realtime listener failed");
    }
  }
}

// Push a hint directly (e.g. after a local write) without waiting for the
// Supabase round-trip. Used for tables not yet in the realtime publication.
export function pushRealtimeHint(table: string, event = "UPDATE"): void {
  broadcast({ table, event });
}

export function isRealtimeEnabled(): boolean {
  return started && supabase !== null;
}

export function initRealtime(): void {
  if (started) return;
  started = true;
  startRelay(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    "dashboard-changes",
    "primary",
  );
  // The second instance gets its own relay so new teams' live updates fan
  // out too. Either relay may be absent; local write hints cover everything
  // on a single instance regardless.
  if (process.env.SECONDARY_SUPABASE_URL?.trim() && process.env.SECONDARY_SUPABASE_SECRET_KEY?.trim()) {
    startRelay(
      process.env.SECONDARY_SUPABASE_URL.trim(),
      process.env.SECONDARY_SUPABASE_SECRET_KEY.trim(),
      "dashboard-changes-secondary",
      "secondary",
    );
  }
}

function startRelay(url: string | undefined, key: string | undefined, channelName: string, label: string): void {
  if (!url || !key) {
    logger.warn(
      `Supabase realtime relay (${label}) disabled: URL or key missing. Live pages fall back to local hints and polling.`,
    );
    return;
  }
  try {
    const relay = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
    if (!supabase) supabase = relay;
    const channel = relay.channel(channelName);
    for (const table of REALTIME_WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => broadcast({ table, event: payload.eventType }),
      );
    }
    channel.subscribe((status, error) => {
      if (error) {
        logger.error({ err: error }, `Supabase realtime subscription error (${label})`);
        return;
      }
      logger.info({ status, relay: label }, "Supabase realtime status");
    });
  } catch (error) {
    logger.error({ err: error }, `Failed to start Supabase realtime relay (${label})`);
  }
}

// Supabase only emits postgres_changes for tables that are members of the
// `supabase_realtime` publication. Fresh projects (and tables created after
// the project was provisioned) are not members by default, so the relay
// above subscribes but never receives anything. Add every watched table at
// boot; idempotent, and a no-op on plain Postgres where the publication does
// not exist (local hints + polling cover that case).
export async function ensureRealtimePublication(target: { query: (sql: string) => Promise<unknown> } = pool): Promise<void> {
  const tableList = REALTIME_WATCHED_TABLES.map((name) => `'${name}'`).join(", ");
  await target.query(`
    DO $pub$
    DECLARE
      table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ARRAY[${tableList}]::text[]
      LOOP
        IF EXISTS (
          SELECT 1 FROM pg_publication_tables
          WHERE pubname = 'supabase_realtime'
            AND schemaname = 'public'
            AND tablename = table_name
        ) THEN
          CONTINUE;
        END IF;
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
      END LOOP;
    EXCEPTION
      WHEN undefined_object THEN
        NULL;
    END
    $pub$
  `);
}

// --- Server-sent events plumbing -------------------------------------------

const sseClients = new Set<Response>();

export function sseClientCount(): number {
  return sseClients.size;
}

export function addSseClient(res: Response): () => void {
  sseClients.add(res);
  const removeListener = addRealtimeListener((hint) => {
    try {
      res.write(`data: ${JSON.stringify(hint)}\n\n`);
    } catch {
      // Client gone; cleanup happens on close.
    }
  });
  return () => {
    removeListener();
    sseClients.delete(res);
  };
}
