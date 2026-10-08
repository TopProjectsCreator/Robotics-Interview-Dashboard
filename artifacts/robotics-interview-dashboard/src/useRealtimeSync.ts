import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardSummaryQueryKey,
  getGetDisplayStateQueryKey,
  getGetInterviewChatQueryKey,
  getGetQueueQueryKey,
  getListApplicantsQueryKey,
} from "@workspace/api-client-react";
import { useWorkspaceSettings } from "./workspaceSettings";
import { getStoredAuthToken } from "./authSession";

// Subscribes to the server's realtime relay (Supabase Realtime -> SSE).
// Events carry only table names; rows are refetched through the
// authenticated JSON API. Polling configured in settings stays on as a
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
    source.onmessage = (event) => {
      if (stopped) return;
      try {
        const hint = JSON.parse(event.data) as { table?: unknown };
        if (hint.table === "interview_whiteboards") {
          void qc.invalidateQueries({
            predicate: ({ queryKey }) => {
              const key = JSON.stringify(queryKey);
              return (
                key.includes("/api/boards") ||
                key.includes("/api/whiteboards") ||
                key.includes("/api/spreadsheets") ||
                key.includes("/whiteboards")
              );
            },
          });
          // Whiteboard-family artifacts (boards, documents, spreadsheets all
          // live in interview_whiteboards) still fall through to the broad
          // refresh below so chat/queue badges stay live too.
        } else {
          // Unknown realtime messages still trigger the broad refresh below.
        }
      } catch {
        // Unknown realtime messages still trigger the broad refresh below.
      }
      qc.invalidateQueries({ queryKey: getListApplicantsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetQueueQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDisplayStateQueryKey() });
      qc.invalidateQueries({ queryKey: getGetInterviewChatQueryKey() });
    };
    source.onerror = () => {
      // EventSource reconnects on its own; polling covers any gap.
    };
    return () => {
      stopped = true;
      source.close();
    };
  }, [on, qc]);
}
