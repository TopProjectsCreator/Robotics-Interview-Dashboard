/**
 * Raw-SQL equivalent of the team's default-team filter. Pass a qualified
 * column name and the placeholder containing the team id.
 */
export function teamSqlCondition(columnSql: string, placeholder: string): string {
  return `(${columnSql} = ${placeholder} or (${placeholder} = 'default' and ${columnSql} is null))`;
}
