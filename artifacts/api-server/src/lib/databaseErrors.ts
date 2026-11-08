const DATABASE_CONNECTION_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ETIMEDOUT",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENOTFOUND",
  "EAI_AGAIN",
  "57P01",
  "57P02",
  "57P03",
]);

const DATABASE_CONNECTION_MESSAGE =
  /\b(?:ECONNREFUSED|ECONNRESET|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_AGAIN|connection terminated unexpectedly|connection timeout)\b/i;

/**
 * Drizzle wraps driver failures in a query error, so inspect nested causes as
 * well as the outer error. Do not classify schema or application errors as
 * temporary database outages.
 */
export function isDatabaseConnectionError(error: unknown): boolean {
  const seen = new Set<object>();
  let current: unknown = error;

  while (current !== null && current !== undefined) {
    if (typeof current === "string") {
      if (DATABASE_CONNECTION_MESSAGE.test(current)) return true;
      break;
    }
    if (typeof current !== "object" || seen.has(current)) break;
    seen.add(current);

    const candidate = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
    };
    const code = typeof candidate.code === "string" ? candidate.code : "";
    const message = typeof candidate.message === "string" ? candidate.message : "";

    if (
      DATABASE_CONNECTION_CODES.has(code) ||
      code.startsWith("08") ||
      DATABASE_CONNECTION_MESSAGE.test(message)
    ) {
      return true;
    }
    current = candidate.cause;
  }

  return false;
}
