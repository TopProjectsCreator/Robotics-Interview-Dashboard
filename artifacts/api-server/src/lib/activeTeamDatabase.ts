import * as database from "@workspace/db";

/**
 * All teams are now on the secondary database. Keep single-database installs
 * working by using primary only when no secondary connection is configured.
 */
export function activeTeamDatabaseInstance(): "primary" | "secondary" {
  if (typeof database.hasSecondary === "function") {
    return database.hasSecondary() ? "secondary" : "primary";
  }
  return process.env.SECONDARY_DATABASE_URL?.trim() ? "secondary" : "primary";
}
