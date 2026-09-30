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
