export function accountSetupErrorMessage(error: unknown, fallback: string): string {
  const status = error && typeof error === "object" && "status" in error
    ? (error as { status?: unknown }).status
    : undefined;

  if (status === 401) return "The team access code is incorrect. Check it and try again.";
  if (status === 429) return "Too many account setup attempts. Wait a minute and try again.";
  if (status === 400 || status === 409) {
    const data = error && typeof error === "object" && "data" in error
      ? (error as { data?: unknown }).data
      : undefined;
    const message = data && typeof data === "object" && "error" in data
      ? (data as { error?: unknown }).error
      : undefined;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof status !== "number" || status >= 500) {
    return "Account setup is temporarily unavailable. Check your connection and try again.";
  }
  return fallback;
}
