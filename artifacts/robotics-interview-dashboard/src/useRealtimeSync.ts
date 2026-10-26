import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetChatConversationsQueryKey,
  getGetChatSettingsQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetDisplayStateQueryKey,
  getGetInterviewChatQueryKey,
  getGetQueueQueryKey,
  getGetSeatingSettingsQueryKey,
  getListApplicantsQueryKey,
  getListChatChannelsQueryKey,
  getListScheduledChatsQueryKey,
} from "@workspace/api-client-react";
import { useWorkspaceSettings } from "./workspaceSettings";
import { getStoredAuthToken } from "./authSession";
import { trackRealtimeStream } from "./realtimeHealth";

// Subscribes to the server's realtime relay (local write hints + Supabase
// Realtime -> SSE). Events carry only table names; rows are refetched through
// the authenticated JSON API. Polling configured in settings stays on as a
// backup, so a dropped stream never leaves a board stale.
export function useRealtimeSync(authenticated: boolean) {
  const { settings } = useWorkspaceSettings();
  const qc = useQueryClient();
  const on = authenticated && settings.realtime;
  useEffect(() => {
    if (!on) return;
    let stopped = false;
    // EventSource cannot send an Authorization header, so attach the stored
    // session token as ?access_token= (same convention as the WS collab
    // endpoints). The server also accepts the session cookie, so this keeps
    // working when cookies are blocked (embedded iframe, etc.).
    const token = getStoredAuthToken();
    const query = token ? `?access_token=${encodeURIComponent(token)}` : "";
    const source = new EventSource(`${import.meta.env.BASE_URL}api/events${query}`, {
      withCredentials: true,
    });
    const stream = trackRealtimeStream();
    source.onopen = () => {
      if (!stopped) stream.up();
    };
    source.onmessage = (event) => {
      if (stopped) return;
      stream.up();
      let table = "";
      try {
        const hint = JSON.parse(event.data) as { table?: unknown };
        if (typeof hint.table === "string") table = hint.table;
      } catch {
        // Malformed payloads fall through to the broad refresh below.
      }

      if (table === "interview_whiteboards") {
        // Boards, documents, whiteboards, and spreadsheets all live in
        // interview_whiteboards; each editor queries a different endpoint.
        void qc.invalidateQueries({
          predicate: ({ queryKey }) => {
            const key = JSON.stringify(queryKey);
            return (
              key.includes("/api/boards") ||
              key.includes("/api/whiteboards") ||
              key.includes("/api/spreadsheets")
            );
          },
        });
        return;
      }
      if (table === "code_files") {
        void qc.invalidateQueries({
          predicate: ({ queryKey }) => JSON.stringify(queryKey).includes("/api/code"),
        });
        return;
      }
      if (table === "cad_bots" || table === "cad_folders" || table === "cad_models") {
        // The CAD library is shared: another teammate uploading or deleting a
        // model has to show up here without a manual reload.
        void qc.invalidateQueries({
          predicate: ({ queryKey }) => JSON.stringify(queryKey).includes("/api/cad"),
        });
        return;
      }
      if (
        table === "parts_catalog_items" ||
        table === "parts_inventory" ||
        table === "parts_robots" ||
        table === "parts_robot_allocations"
      ) {
        // Same for the parts workspace: catalog edits, stock changes, and
        // robot builds are shared with the rest of the team.
        void qc.invalidateQueries({
          predicate: ({ queryKey }) => JSON.stringify(queryKey).includes("/api/parts"),
        });
        return;
      }
      if (table === "chat_settings") {
        void qc.invalidateQueries({ queryKey: getGetChatSettingsQueryKey() });
        return;
      }
      if (table === "scheduled_chat_messages") {
        void qc.invalidateQueries({ queryKey: getListScheduledChatsQueryKey() });
        return;
      }
      if (table === "chat_message_reads") {
        void qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetChatConversationsQueryKey() });
        return;
      }
      if (table === "chat_channels") {
        // Invites, renames, and deletes change the channel strip and can
        // orphan the open conversation (deleted channel) or unlock messages
        // (new member) — refresh all of the chat keys.
        void qc.invalidateQueries({ queryKey: getListChatChannelsQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetChatConversationsQueryKey() });
        void qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey() });
        return;
      }
      if (table === "teams") {
        // A team rename changes the public display label without touching any
        // of the queue or display-settings rows. The base key also matches
        // code-scoped display queries.
        void qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
        return;
      }

      // applicants, interview_queue, display_settings, interview_chat_messages,
      // broadcasts, seating_settings, dashboard_charts, and anything unknown:
      // refresh the live boards.
      qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetQueueQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
      qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey() });
      qc.invalidateQueries({ queryKey: getGetChatConversationsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetSeatingSettingsQueryKey() });
    };
    source.onerror = () => {
      // EventSource reconnects on its own; polling covers any gap.
      stream.down();
    };
    return () => {
      stopped = true;
      stream.down();
      source.close();
    };
  }, [on, qc]);
}
