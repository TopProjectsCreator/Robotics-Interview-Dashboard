import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  getGetSessionQueryKey,
  getListInterviewersQueryKey,
} from "@workspace/api-client-react";

export const AUTH_TOKEN_STORAGE_KEY = "robotics_admin_session_token";
export const AUTH_SESSION_CHANNEL_NAME = "robotics-admin-session";
export const AUTH_SESSION_END_STORAGE_KEY = "robotics_admin_session_ended";

type AuthSessionEndMessage = {
  type: "session-ended";
  id: string;
  source: string;
};

const authSessionTabId = `${Date.now()}-${Math.random()}`;
let pendingOtherTabSessionEndNotice = false;

export function markAuthSessionEndedByAnotherTab(): void {
  pendingOtherTabSessionEndNotice = true;
}

export function consumeAuthSessionEndedByAnotherTab(): boolean {
  const shouldShowNotice = pendingOtherTabSessionEndNotice;
  pendingOtherTabSessionEndNotice = false;
  return shouldShowNotice;
}

function parseAuthSessionEndMessage(value: unknown): AuthSessionEndMessage | null {
  let message: unknown = value;
  if (typeof value === "string") {
    try {
      message = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (
    !message ||
    typeof message !== "object" ||
    !("type" in message) ||
    message.type !== "session-ended" ||
    !("id" in message) ||
    typeof message.id !== "string" ||
    !("source" in message) ||
    typeof message.source !== "string"
  ) {
    return null;
  }
  return message as AuthSessionEndMessage;
}

export function broadcastAuthSessionEnd(): void {
  const message: AuthSessionEndMessage = {
    type: "session-ended",
    id: `${Date.now()}-${Math.random()}`,
    source: authSessionTabId,
  };

  try {
    if (typeof BroadcastChannel !== "undefined") {
      const channel = new BroadcastChannel(AUTH_SESSION_CHANNEL_NAME);
      channel.postMessage(message);
      channel.close();
    }
  } catch {
    // The storage event below is the fallback when BroadcastChannel is unavailable.
  }

  try {
    window.localStorage.setItem(AUTH_SESSION_END_STORAGE_KEY, JSON.stringify(message));
  } catch {
    // BroadcastChannel still synchronizes tabs when storage is unavailable.
  }
}

export function listenForAuthSessionEnd(onSessionEnd: () => void): () => void {
  const seenMessageIds = new Set<string>();
  const receiveMessage = (value: unknown) => {
    const message = parseAuthSessionEndMessage(value);
    if (!message || message.source === authSessionTabId || seenMessageIds.has(message.id)) return;
    seenMessageIds.add(message.id);
    if (seenMessageIds.size > 32) {
      const oldestId = seenMessageIds.values().next().value;
      if (oldestId) seenMessageIds.delete(oldestId);
    }
    onSessionEnd();
  };

  let channel: BroadcastChannel | undefined;
  try {
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel(AUTH_SESSION_CHANNEL_NAME);
      channel.addEventListener("message", (event: MessageEvent<unknown>) => receiveMessage(event.data));
    }
  } catch {
    // The storage event remains available when BroadcastChannel cannot be opened.
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === AUTH_SESSION_END_STORAGE_KEY && event.newValue) {
      receiveMessage(event.newValue);
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    channel?.close();
    window.removeEventListener("storage", onStorage);
  };
}

export function getStoredAuthToken(): string | null {
  try {
    return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeAuthToken(token: string | undefined): void {
  try {
    if (!token) window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    else window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } catch {
    // The cookie session remains available when storage is disabled.
  }
}

export function clearStoredAuthToken(): void {
  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // Nothing else is required when storage is disabled.
  }
}

export function clearAuthSession(privateDataCache: { clear: () => void }): void {
  broadcastAuthSessionEnd();
  clearStoredAuthToken();
  privateDataCache.clear();
}

export function clearUserScopedRecords(
  queryClient: QueryClient,
  sessionData: unknown = { authenticated: false },
): void {
  clearStoredAuthToken();
  const sessionQueryKey: QueryKey = getGetSessionQueryKey();
  const interviewerListQueryKey: QueryKey = getListInterviewersQueryKey();
  const isPreservedQuery = (queryKey: QueryKey) =>
    JSON.stringify(queryKey) === JSON.stringify(sessionQueryKey) ||
    JSON.stringify(queryKey) === JSON.stringify(interviewerListQueryKey);
  const userScopedQueries = {
    predicate: (query: { queryKey: QueryKey }) => !isPreservedQuery(query.queryKey),
  };

  // The interviewer list is public and is required before sign-in. Do not
  // cancel or remove it when an unauthenticated session check clears private data.
  void queryClient.cancelQueries(userScopedQueries);
  queryClient.removeQueries(userScopedQueries);
  queryClient.getMutationCache().clear();
  queryClient.setQueryData(sessionQueryKey, sessionData);
}
