const TRANSIENT_POSTGRES_CODES = new Set([
  "53300", // too_many_connections
  "57P01", // admin_shutdown
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now
  "ECONNABORTED",
  "ECONNREFUSED",
  "ECONNRESET",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ETIMEDOUT",
]);

/**
 * True only for errors where retrying on another available database can be
 * useful. Constraint, validation, and other SQL errors must not trigger a
 * placement change.
 */
export function isTransientDatabaseAvailabilityError(error: unknown): boolean {
  const seen = new Set<object>();
  let current: unknown = error;

  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const candidate = current as {
      code?: unknown;
      status?: unknown;
      statusCode?: unknown;
      cause?: unknown;
    };
    const status = Number(candidate.status ?? candidate.statusCode);
    if (status === 429 || status === 502 || status === 503 || status === 504) {
      return true;
    }

    if (typeof candidate.code === "string") {
      if (candidate.code.startsWith("08") || TRANSIENT_POSTGRES_CODES.has(candidate.code)) {
        return true;
      }
    }
    current = candidate.cause;
  }

  return false;
}

export function canFallbackNewTeamToPrimary(
  error: unknown,
  secondaryTeamListWasRead: boolean,
): boolean {
  return secondaryTeamListWasRead && isTransientDatabaseAvailabilityError(error);
}
