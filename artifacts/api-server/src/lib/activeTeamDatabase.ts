import * as database from "@workspace/db";

/**
 * The instance that owns team data.
 *
 * All teams live on the primary; the secondary is retained as a backup, so
 * this is the one switch that decides where team reads and writes go. It is
 * driven by ACTIVE_TEAM_DATABASE in `.env`:
 *
 *   - "primary"   → every team uses the primary (the post-migration state)
 *   - "secondary" → the pre-migration state
 *   - unset       → secondary when one is configured, primary otherwise
 *     (unchanged legacy behavior, so a single-database install keeps working)
 *
 * Read on every call rather than cached, so the value can be flipped by a
 * restart without touching code, and the secondary's pools/clients/schema
 * pass keep running either way — only team routing changes.
 */
export function activeTeamDatabaseInstance(): "primary" | "secondary" {
  const configured = process.env.ACTIVE_TEAM_DATABASE?.trim().toLowerCase();
  if (configured === "primary" || configured === "secondary") return configured;
  if (typeof database.hasSecondary === "function") {
    return database.hasSecondary() ? "secondary" : "primary";
  }
  return process.env.SECONDARY_DATABASE_URL?.trim() ? "secondary" : "primary";
}
