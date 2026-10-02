import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetChatConversationsQueryKey, useGetChatConversations } from "@workspace/api-client-react";

const LAST_SEEN_KEY = "robotics-notify-last-seen";
const POLL_MS = 8000;

function notifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

function readSeen(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeSeen(seen: Record<string, string>): void {
  try {
    window.localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Private browsing etc.
  }
}

function fire(title: string, body: string, tag: string): void {
  if (!notifySupported()) return;
  try {
    const note = new Notification(title, { body, tag });
    note.onclick = () => {
      window.focus();
      note.close();
    };
  } catch {
    // Blocked or unsupported; the in-app unread markers still work.
  }
}

/**
 * OS notifications for chat activity, independent of which page is open.
 *
 * The in-chat mention notifier only runs while the chat panel is mounted and
 * only for the conversation being viewed, so a DM arriving while you were on
 * Overview or Parts produced nothing at all. This watcher polls the same
 * conversation summary endpoint and notifies for:
 *   - a new direct message from someone else
 *   - a new team-channel message from someone else
 * "seen" watermarks live in localStorage, so switching tabs or pages never
 * re-notifies, and marking a DM read (red dot cleared) marks it seen.
 */
export function useGlobalChatNotifications(options: {
  myLabel: string;
  viewingPeer: string | null;
  viewingShared: boolean;
  enabled: boolean;
}): void {
  const qc = useQueryClient();
  const { myLabel, viewingPeer, viewingShared, enabled } = options;
  const seenRef = useRef<Record<string, string> | null>(null);
  const primedRef = useRef(false);
  const markSeen = useCallback((key: string, at: string) => {
    const current = seenRef.current ?? readSeen();
    const next = { ...current, [key]: at };
    seenRef.current = next;
    writeSeen(next);
  }, []);

  // Share watermarks with the DM red dots so opening a DM silences it.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "robotics-dm-last-seen" || !event.newValue) return;
      try {
        const dm = JSON.parse(event.newValue) as Record<string, string>;
        seenRef.current = { ...(seenRef.current ?? {}), ...dm };
      } catch {
        // ignore malformed value
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const conversations = useGetChatConversations({
    query: {
      queryKey: getGetChatConversationsQueryKey(),
      refetchInterval: POLL_MS,
      enabled: Boolean(enabled),
      staleTime: 2000,
    },
  });

  useEffect(() => {
    const data = conversations.data;
    if (!data || !enabled) return;
    if (seenRef.current === null) {
      seenRef.current = readSeen();
    }
    const me = myLabel.trim().toLowerCase();

    if (!primedRef.current) {
      // First poll after load: record watermarks without firing a backlog.
      primedRef.current = true;
      for (const item of data.items) markSeen(`dm:${item.peer.trim().toLowerCase()}`, item.lastMessageAt);
      if (data.shared) markSeen("shared", data.shared.lastMessageAt);
      return;
    }

    for (const item of data.items) {
      const peer = item.peer.trim().toLowerCase();
      if (!peer) continue;
      const key = `dm:${peer}`;
      const seenAt = seenRef.current?.[key];
      if (item.lastMessageAuthor.trim().toLowerCase() === me) {
        markSeen(key, item.lastMessageAt);
        continue;
      }
      const viewingThisDm = (viewingPeer ?? "").trim().toLowerCase() === peer;
      if (viewingThisDm) {
        markSeen(key, item.lastMessageAt);
        continue;
      }
      if (!seenAt || item.lastMessageAt > seenAt) {
        markSeen(key, item.lastMessageAt);
        if (document.visibilityState === "hidden" || !viewingShared) {
          fire(`${item.lastMessageAuthor} · direct message`, item.lastMessage || "New direct message", key);
        }
      }
    }

    const shared = data.shared;
    if (shared) {
      const seenAt = seenRef.current?.shared;
      const fromOther = shared.lastMessageAuthor.trim().toLowerCase() !== me;
      if (viewingShared) {
        markSeen("shared", shared.lastMessageAt);
      } else if (fromOther && (!seenAt || shared.lastMessageAt > seenAt)) {
        markSeen("shared", shared.lastMessageAt);
        if (document.visibilityState === "hidden" || !viewingShared) {
          fire("New team chat message", `${shared.lastMessageAuthor}: ${shared.lastMessage}`.slice(0, 140), "shared");
        }
      }
    }
  }, [conversations.data, enabled, markSeen, myLabel, viewingPeer, viewingShared]);

  // Keep the conversations cache warm for the chat panel's unread dots.
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setInterval(() => {
      qc.invalidateQueries({ queryKey: getGetChatConversationsQueryKey() });
    }, 30000);
    return () => window.clearInterval(timer);
  }, [enabled, qc]);
}
