/** Admin accounts are stored as coordinators; accept the legacy admin value too. */
export function isAdminRole(role: string | null | undefined): boolean {
  return role === "coordinator" || role === "admin";
}
