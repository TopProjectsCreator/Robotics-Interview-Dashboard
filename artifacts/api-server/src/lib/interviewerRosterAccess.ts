/**
 * Access rule for GET /auth/interviewers.
 *
 * The roster is private: it lists every teammate's display name, role and
 * credential state. Exactly two callers are allowed. A signed-in account
 * always gets its own team, and the login screen gets one team's accounts by
 * presenting that team's access code. Anyone with neither is rejected.
 *
 * There is deliberately no default-team fallback: treating a missing code as
 * "the default team" is what used to let any anonymous caller read the default
 * team's whole roster straight off the URL.
 */
export type InterviewerRosterAccess =
  | { kind: "session" }
  | { kind: "event-password"; eventPassword: string }
  | { kind: "denied"; status: 401; error: string };

export function interviewerRosterAccess(options: {
  hasSession: boolean;
  eventPassword?: string | null;
}): InterviewerRosterAccess {
  if (options.hasSession) return { kind: "session" };
  const eventPassword = typeof options.eventPassword === "string" ? options.eventPassword.trim() : "";
  if (!eventPassword) return { kind: "denied", status: 401, error: "Authentication required" };
  return { kind: "event-password", eventPassword };
}