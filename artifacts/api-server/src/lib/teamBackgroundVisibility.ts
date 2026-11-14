export function backgroundVisibleToMember(
  audience: unknown,
  memberIds: unknown,
  interviewerId: string | undefined,
): boolean {
  if (audience !== "selected") return true;
  return Boolean(
    interviewerId &&
    Array.isArray(memberIds) &&
    memberIds.some((memberId) => memberId === interviewerId),
  );
}

export function canReadTeamBrandingObject(input: {
  requestedPath: string;
  logoPath?: string | null;
  backgroundPath?: string | null;
  backgroundAudience?: unknown;
  backgroundMemberIds?: unknown;
  interviewerId?: string;
  canManageBranding?: boolean;
}): boolean {
  const normalize = (path: string | null | undefined) => path?.replace(/^secondary\//, "");
  const requestedPath = normalize(input.requestedPath);
  const logoPath = normalize(input.logoPath);
  const backgroundPath = normalize(input.backgroundPath);
  if (requestedPath && requestedPath === logoPath) return true;
  if (!requestedPath || requestedPath !== backgroundPath) return false;
  return input.canManageBranding === true || backgroundVisibleToMember(
    input.backgroundAudience,
    input.backgroundMemberIds,
    input.interviewerId,
  );
}
