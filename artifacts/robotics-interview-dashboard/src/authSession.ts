import type { QueryClient, QueryKey } from "@tanstack/react-query";
import {
  getGetSessionQueryKey,
  getListInterviewersQueryKey,
} from "@workspace/api-client-react";

export const AUTH_TOKEN_STORAGE_KEY = "robotics_admin_session_token";
export const AUTH_SESSION_ACTIVE_STORAGE_KEY = "robotics_admin_session_active";
export const AUTH_SESSION_CHANNEL_NAME = "robotics-admin-session";
export const AUTH_SESSION_END_STORAGE_KEY = "robotics_admin_session_ended";
export const DEFAULT_AUTH_RETURN_PATH = "/dashboard";
const CHAT_DRAFT_STORAGE_KEY_PREFIX = "robotics_admin_chat_draft";

export function getChatDraftStorageKey(
  interviewerId: string | null | undefined,
  conversationId: string,
): string | null {
  if (!interviewerId?.trim() || !conversationId) return null;
  return `${CHAT_DRAFT_STORAGE_KEY_PREFIX}:${encodeURIComponent(interviewerId)}:${encodeURIComponent(conversationId)}`;
}

export function loadChatDraft(storageKey: string | null): string {
  if (!storageKey || typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(storageKey) ?? "";
  } catch {
    return "";
  }
}

export function saveChatDraft(storageKey: string | null, draft: string): void {
  if (!storageKey || typeof window === "undefined") return;
  try {
    if (draft.length === 0) window.sessionStorage.removeItem(storageKey);
    else window.sessionStorage.setItem(storageKey, draft);
  } catch {
    // The composer remains usable when browser storage is unavailable.
  }
}

export function clearChatDraft(storageKey: string | null): void {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // The composer remains usable when browser storage is unavailable.
  }
}

const AUTH_RETURN_ORIGIN = "https://robotics-workspace.invalid";
const WORKSPACE_RETURN_PATHS = new Set([
  "/dashboard",
  "/interview/assistant",
  "/interview",
  "/applicants",
  "/queue",
  "/chat",
  "/attendance",
  "/big-screen",
  "/parts/assistant",
  "/parts",
  "/cad",
  "/assistant",
]);

export function getSafeAuthReturnPath(value: string | null | undefined): string {
  const candidate = value?.trim();
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return DEFAULT_AUTH_RETURN_PATH;
  }

  try {
    const destination = new URL(candidate, AUTH_RETURN_ORIGIN);
    const isSpreadsheet = /^\/spreadsheets\/[^/]+$/.test(destination.pathname);
    if (
      destination.origin !== AUTH_RETURN_ORIGIN ||
      (!WORKSPACE_RETURN_PATHS.has(destination.pathname) && !isSpreadsheet)
    ) {
      return DEFAULT_AUTH_RETURN_PATH;
    }
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return DEFAULT_AUTH_RETURN_PATH;
  }
}

export function getAuthRedirectPath(currentPath: string): string {
  return `/auth?returnTo=${encodeURIComponent(getSafeAuthReturnPath(currentPath))}`;
}

export function getCurrentPathWithQuery(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

type AuthSessionEndMessage = {
  type: "session-ended";
  id: string;
  source: string;
};

const authSessionTabId = `${Date.now()}-${Math.random()}`;
let pendingOtherTabSessionEndNotice = false;
let pendingSessionExpiredNotice = false;

function clearActiveSessionMarker(): void {
  try {
    window.sessionStorage.removeItem(AUTH_SESSION_ACTIVE_STORAGE_KEY);
  } catch {
    // Session state can still be tracked in memory if storage is unavailable.
  }
}

export function markAuthSessionActive(): void {
  try {
    window.sessionStorage.setItem(AUTH_SESSION_ACTIVE_STORAGE_KEY, "1");
  } catch {
    // The session query remains the in-memory fallback.
  }
}

export function hasActiveAuthSessionMarker(): boolean {
  try {
    return window.sessionStorage.getItem(AUTH_SESSION_ACTIVE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAuthSessionEndedByAnotherTab(): void {
  pendingOtherTabSessionEndNotice = true;
  pendingSessionExpiredNotice = false;
  clearActiveSessionMarker();
}

export function consumeAuthSessionEndedByAnotherTab(): boolean {
  const shouldShowNotice = pendingOtherTabSessionEndNotice;
  pendingOtherTabSessionEndNotice = false;
  return shouldShowNotice;
}

export function markAuthSessionExpired(): void {
  pendingSessionExpiredNotice = true;
  clearActiveSessionMarker();
}

export function consumeAuthSessionExpiredNotice(): boolean {
  const shouldShowNotice = pendingSessionExpiredNotice;
  pendingSessionExpiredNotice = false;
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
  pendingOtherTabSessionEndNotice = false;
  pendingSessionExpiredNotice = false;
  clearActiveSessionMarker();
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
