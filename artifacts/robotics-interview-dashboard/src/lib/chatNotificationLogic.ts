import type { ChatNotificationEvent } from "@workspace/api-client-react";

export type ActiveChatView = {
  path: string;
  peer: string | null;
  channelId: string | null;
};

export function isCurrentChatConversation(event: ChatNotificationEvent, view: ActiveChatView): boolean {
  const onChatPage = view.path === "/chat" || view.path === "/queue";
  if (!onChatPage) return false;
  if (event.scope === "direct") {
    return Boolean(view.peer && event.peer && view.peer.trim().toLowerCase() === event.peer.trim().toLowerCase());
  }
  if (event.scope === "channel") {
    return Boolean(view.channelId && event.channelId && view.channelId === event.channelId);
  }
  return !view.peer && !view.channelId;
}

export function isAuthoredByMe(event: ChatNotificationEvent, myLabel: string): boolean {
  return event.author.trim().toLowerCase() === myLabel.trim().toLowerCase();
}

export function chatNotificationDestination(event: ChatNotificationEvent): string {
  if (event.scope === "direct" && event.peer) {
    return `/chat?${new URLSearchParams({ peer: event.peer }).toString()}`;
  }
  if (event.scope === "channel" && event.channelId) {
    return `/chat?${new URLSearchParams({ channel: event.channelId }).toString()}`;
  }
  return "/chat";
}

export function notificationEventTitle(event: ChatNotificationEvent): string {
  if (event.scope === "direct") return `${event.author} · direct message`;
  if (event.scope === "channel") return `${event.author} · ${event.channelName || "channel"}`;
  return "New team chat message";
}

export function notificationEventBody(event: ChatNotificationEvent): string {
  return event.scope === "shared"
    ? `${event.author}: ${event.message}`.slice(0, 140)
    : event.message || "New chat message";
}

const MAX_REMEMBERED_MESSAGES = 2000;

/** Synchronous storage claim keeps a second tab from alerting on the same message. */
export function claimNotificationMessage(storageKey: string, messageId: string): boolean {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const ids: string[] = raw ? JSON.parse(raw) as string[] : [];
    if (ids.includes(messageId)) return false;
    window.localStorage.setItem(storageKey, JSON.stringify([...ids.slice(-(MAX_REMEMBERED_MESSAGES - 1)), messageId]));
  } catch {
    // Without storage, the current tab still avoids duplicate processing in memory.
  }
  return true;
}
