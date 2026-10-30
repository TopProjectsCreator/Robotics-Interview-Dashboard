import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { getChatNotificationEvents, type ChatNotificationEvent } from "@workspace/api-client-react";
import {
  chatNotificationDestination,
  claimNotificationMessage,
  isAuthoredByMe,
  isCurrentChatConversation,
  notificationEventBody,
  notificationEventTitle,
} from "./lib/chatNotificationLogic";

const POLL_MS = 8000;
const ACTIVE_VIEW_TTL_MS = 12_000;

type StoredActiveView = {
  path: string;
  peer: string | null;
  channelId: string | null;
  expiresAt: number;
};

function scopedKey(teamId: string, interviewerId: string, suffix: string): string {
  return `robotics-chat-notify:${teamId}:${interviewerId}:${suffix}`;
}

function readCursor(key: string): { initialized: boolean; cursor: string | undefined } {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return { initialized: false, cursor: undefined };
    const parsed = JSON.parse(raw) as { cursor?: unknown };
    return { initialized: true, cursor: typeof parsed.cursor === "string" ? parsed.cursor : undefined };
  } catch {
    return { initialized: false, cursor: undefined };
  }
}

function writeCursor(key: string, cursor: string | null): void {
  try {
    window.localStorage.setItem(key, JSON.stringify({ cursor }));
  } catch {
    // Polling still works for this tab; message identities remain in memory.
  }
}

function readActiveViews(key: string): Record<string, StoredActiveView> {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as Record<string, StoredActiveView> : {};
  } catch {
    return {};
  }
}

function notificationAvailable(): boolean {
  return typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted";
}

/**
 * Polls a message-level cursor feed. One browser tab polls at a time where
 * Web Locks are available; local message-ID claims provide an additional
 * dedupe guard across reconnects and tabs.
 */
export function useGlobalChatNotifications(options: {
  myLabel: string;
  interviewerId: string;
  teamId: string;
  viewingPeer: string | null;
  viewingChannel: string | null;
  enabled: boolean;
}): void {
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const { myLabel, interviewerId, teamId, viewingPeer, viewingChannel, enabled } = options;
  const memoryScope = `${teamId}:${interviewerId}`;
  const memorySeenRef = useRef({ scope: memoryScope, ids: new Set<string>() });
  if (memorySeenRef.current.scope !== memoryScope) {
    memorySeenRef.current = { scope: memoryScope, ids: new Set() };
  }
  const path = location.split(/[?#]/, 1)[0];

  useEffect(() => {
    if (!enabled || !interviewerId || !teamId) return;
    let stopped = false;
    let inFlight = false;
    const cursorKey = scopedKey(teamId, interviewerId, "cursor");
    const seenKey = scopedKey(teamId, interviewerId, "seen");
    const activeViewsKey = scopedKey(teamId, interviewerId, "active-views");
    const lockName = scopedKey(teamId, interviewerId, "poll-lock");
    const tabKey = "robotics-chat-notify-tab-id";
    let tabId = "";
    try {
      tabId = window.sessionStorage.getItem(tabKey) ?? "";
      if (!tabId) {
        tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.sessionStorage.setItem(tabKey, tabId);
      }
    } catch {
      tabId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    const currentView = {
      path,
      peer: viewingPeer,
      channelId: viewingChannel,
    };
    let localCursorInitialized = false;
    let localCursor: string | undefined;
    const refreshActiveView = () => {
      try {
        const activeViews = readActiveViews(activeViewsKey);
        for (const [id, view] of Object.entries(activeViews)) {
          if (view.expiresAt <= Date.now()) delete activeViews[id];
        }
        if ((path === "/chat" || path === "/queue") && document.visibilityState !== "hidden") {
          activeViews[tabId] = { ...currentView, expiresAt: Date.now() + ACTIVE_VIEW_TTL_MS };
        } else {
          delete activeViews[tabId];
        }
        window.localStorage.setItem(activeViewsKey, JSON.stringify(activeViews));
      } catch {
        // Active conversation suppression still applies in this tab.
      }
    };
    refreshActiveView();
    const activeViewTimer = window.setInterval(refreshActiveView, 4000);
    document.addEventListener("visibilitychange", refreshActiveView);

    const shouldSuppress = (event: ChatNotificationEvent): boolean => {
      if (document.visibilityState !== "hidden" && isCurrentChatConversation(event, currentView)) return true;
      const activeViews = readActiveViews(activeViewsKey);
      return Object.values(activeViews).some(view =>
        view.expiresAt > Date.now() && isCurrentChatConversation(event, view),
      );
    };

    const processEvents = (events: ChatNotificationEvent[]) => {
      for (const event of events) {
        const seenIds = memorySeenRef.current.ids;
        if (!event.id || seenIds.has(event.id)) continue;
        seenIds.add(event.id);
        if (seenIds.size > 2000) {
          const oldest = seenIds.values().next().value;
          if (oldest) seenIds.delete(oldest);
        }
        if (isAuthoredByMe(event, myLabel) || shouldSuppress(event)) continue;
        if (!claimNotificationMessage(seenKey, event.id) || !notificationAvailable()) continue;
        try {
          const note = new Notification(notificationEventTitle(event), {
            body: notificationEventBody(event),
            tag: `chat-message-${event.id}`,
          });
          note.onclick = () => {
            window.focus();
            setLocation(chatNotificationDestination(event));
            note.close();
          };
        } catch {
          // Chat unread indicators remain available when desktop notifications fail.
        }
      }
    };

    const poll = async () => {
      if (stopped || inFlight) return;
      inFlight = true;
      try {
        const runFeed = async () => {
          let stored = readCursor(cursorKey);
          if (!stored.initialized && localCursorInitialized) {
            stored = { initialized: true, cursor: localCursor };
          }
          let cursor = stored.cursor;
          let pages = 0;
          do {
            if (stopped || pages >= 100) break;
            const requestParams = {
              ...(stored.initialized && cursor ? { cursor } : {}),
              limit: 100,
            };
            const page = await queryClient.fetchQuery({
              queryKey: ["chat-notification-events", teamId, interviewerId, cursor ?? "initial"],
              queryFn: () => getChatNotificationEvents(requestParams),
              staleTime: 0,
            });
            if (stopped) break;
            processEvents(page.items);
            // The initial request only establishes a baseline. Its response is
            // a valid cursor even when the team has no messages yet.
            writeCursor(cursorKey, page.nextCursor);
            cursor = page.nextCursor ?? undefined;
            stored = { initialized: true, cursor };
            localCursorInitialized = true;
            localCursor = cursor;
            pages += 1;
            if (!page.hasMore) break;
          } while (true);
        };

        if ("locks" in navigator && navigator.locks) {
          await navigator.locks.request(lockName, { ifAvailable: true }, async lock => {
            if (lock) await runFeed();
          });
        } else {
          await runFeed();
        }
      } catch {
        // Keep the existing cursor; a failed request will retry on the next poll.
      } finally {
        inFlight = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearInterval(activeViewTimer);
      document.removeEventListener("visibilitychange", refreshActiveView);
      try {
        const activeViews = readActiveViews(activeViewsKey);
        delete activeViews[tabId];
        window.localStorage.setItem(activeViewsKey, JSON.stringify(activeViews));
      } catch {
        // No-op when browser storage is unavailable.
      }
    };
  }, [enabled, interviewerId, myLabel, path, queryClient, setLocation, teamId, viewingChannel, viewingPeer]);
}
