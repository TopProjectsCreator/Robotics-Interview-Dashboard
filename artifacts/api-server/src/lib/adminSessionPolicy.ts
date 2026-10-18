export const ADMIN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function isAdminSessionExpired(issuedAt: number, now = Date.now()): boolean {
  return !Number.isFinite(issuedAt) || now - issuedAt > ADMIN_SESSION_TTL_MS || issuedAt > now + 60_000;
}
