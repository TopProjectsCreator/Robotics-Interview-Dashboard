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
    const source = new EventSource(`${import.meta.env.BASE_URL}api/events`, {
      withCredentials: true,
    });
    source.onmessage = () => {
      if (stopped) return;
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
