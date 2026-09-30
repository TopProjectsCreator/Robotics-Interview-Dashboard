import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { getGetSessionQueryKey } from "@workspace/api-client-react";

export const AUTH_TOKEN_STORAGE_KEY = "robotics_admin_session_token";

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
  clearStoredAuthToken();
  privateDataCache.clear();
}

export function clearUserScopedRecords(
  queryClient: QueryClient,
  sessionData: unknown = { authenticated: false },
): void {
  clearStoredAuthToken();
  const sessionQueryKey: QueryKey = getGetSessionQueryKey();
  const isSessionQuery = (queryKey: QueryKey) => JSON.stringify(queryKey) === JSON.stringify(sessionQueryKey);
  const otherQueries = { predicate: (query: { queryKey: QueryKey }) => !isSessionQuery(query.queryKey) };

  void queryClient.cancelQueries(otherQueries);
  queryClient.removeQueries(otherQueries);
  queryClient.getMutationCache().clear();
  queryClient.setQueryData(sessionQueryKey, sessionData);
}
