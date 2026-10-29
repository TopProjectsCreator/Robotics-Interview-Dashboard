export type DeletedCustomWorkspace = { id: string; title: string };
export type CustomWorkspaceDeleteQuery = (
  statement: string,
  values: unknown[],
) => Promise<{ rows: DeletedCustomWorkspace[] }>;
export type CustomWorkspaceTeamSqlCondition = (column: string, placeholder: string) => string;

/**
 * Delete exactly one custom workspace from the requested team.
 * The database's ON DELETE CASCADE relationships remove its versions,
 * saved files, and data records in the same atomic statement.
 */
export async function deleteCustomWorkspace(
  query: CustomWorkspaceDeleteQuery,
  teamSqlCondition: CustomWorkspaceTeamSqlCondition,
  workspaceId: string,
  teamId: string,
): Promise<DeletedCustomWorkspace | null> {
  const deleted = await query(
    `delete from "custom_workspaces"
      where "id" = $1 and ${teamSqlCondition('"team_id"', "$2")}
      returning "id", "title"`,
    [workspaceId, teamId],
  );
  return deleted.rows[0] ?? null;
}
