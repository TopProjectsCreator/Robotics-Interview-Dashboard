import { and, eq } from "drizzle-orm";
import { DEFAULT_TEAM_ID, type TeamRole } from "@workspace/db";
import { normalizePermissions, permissionsForBuiltInRole, type PermissionId } from "@workspace/api-zod";

export type PublicTeamRole = {
  id: string;
  name: string;
  permissions: PermissionId[];
};

export function normalizeRoleTeamId(teamId: string | null | undefined): string {
  return teamId?.trim() || DEFAULT_TEAM_ID;
}

export function publicTeamRole(role: TeamRole): PublicTeamRole {
  return {
    id: role.id,
    name: role.name,
    permissions: normalizePermissions(role.permissions),
  };
}

export async function findAssignedTeamRole(
  customRoleId: string | null | undefined,
  teamId: string | null | undefined,
): Promise<PublicTeamRole | null> {
  if (!customRoleId) return null;
  const { db, teamRolesTable } = await import("@workspace/db");
  const [role] = await db.select().from(teamRolesTable).where(and(
    eq(teamRolesTable.id, customRoleId),
    eq(teamRolesTable.teamId, normalizeRoleTeamId(teamId)),
  )).limit(1);
  return role ? publicTeamRole(role) : null;
}

export async function permissionsForAccount(account: {
  role: string;
  customRoleId?: string | null;
  teamId?: string | null;
}): Promise<PermissionId[]> {
  if (account.role === "coordinator" || account.role === "admin") return permissionsForBuiltInRole(account.role);
  if (!account.customRoleId) return permissionsForBuiltInRole(account.role);
  const role = await findAssignedTeamRole(account.customRoleId, account.teamId);
  return role?.permissions ?? [];
}

export function parsePermissionSelection(value: unknown): PermissionId[] | null {
  if (!Array.isArray(value) || value.some((permission) => typeof permission !== "string")) return null;
  const normalized = normalizePermissions(value);
  if (normalized.length !== value.length || new Set(value).size !== value.length) return null;
  return normalized;
}
