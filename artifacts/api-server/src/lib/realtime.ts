import type { Response } from "express";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { logger } from "./logger";

// Tables whose changes are pushed to coordinator browsers. Payloads sent
// over SSE carry only the table name and event type — browsers refetch the
// actual rows through the authenticated JSON API, so no applicant data ever
// travels the realtime channel.
const WATCHED_TABLES = [
  "applicants",
  "interview_queue",
  "display_settings",
  "interview_chat_messages",
  "broadcasts",
  "seating_settings",
  "dashboard_charts",
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
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    logger.warn(
      "Supabase realtime relay disabled: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Live pages fall back to polling.",
    );
    return;
  }
  try {
    supabase = createClient(url, key, {
      realtime: { params: { eventsPerSecond: 20 } },
    });
    const channel = supabase.channel("dashboard-changes");
    for (const table of WATCHED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        (payload) => broadcast({ table, event: payload.eventType }),
      );
    }
    channel.subscribe((status, error) => {
      if (error) {
        logger.error({ err: error }, "Supabase realtime subscription error");
        return;
      }
      logger.info({ status }, "Supabase realtime status");
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to start Supabase realtime relay");
    supabase = null;
  }
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
