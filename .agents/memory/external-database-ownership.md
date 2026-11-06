---
name: External database ownership
description: The app's DATABASE_URL can point to Supabase while Replit's managed development database remains a separate legacy resource.
---

The running app's `DATABASE_URL` must be checked by hostname before database cleanup. A Supabase pooler host means Drizzle application data lives in Supabase; Replit's Database tool and `executeSql` target a separate managed development database. Clearing the latter does not clear Supabase data.

The configured secondary Supabase database is intentional and must remain available for teams routed to it. A DNS or network error is not evidence that its secret is absent; do not ask the user for a replacement URL or remove secondary routing without their direction.

Connection routing is runtime-specific: this Replit environment cannot resolve the secondary's direct Supabase hostname, while the configured Supavisor session pooler is reachable. Keep pooler routing opt-in and return the configured direct URL unchanged when no pooler host is supplied; do not hardcode a region into shared database code.

The secondary is an isolated team database, not a replica of primary. The server should still start and synchronize a reachable secondary when primary is unavailable, but never redirect primary teams' reads or writes to secondary. Without replication, only new-team placement can fall back after the secondary team list was checked and before any writes begin.

**Why:** The project retained an active Replit development database after moving application storage to Supabase, which made the Database pane show old records and storage unrelated to the current app. On 2026-11-06, the user clarified that primary outages should not make the configured secondary unusable; the secondary still does not contain primary-team data.

**How to apply:** Confirm the connection hostname and target database before destructive operations. The API workflow sources `.env`, while a bare database CLI command may use Replit's injected development URL; treat those databases as separate until verified. Preserve the configured secondary connection, diagnose runtime reachability separately from secret presence, and keep runtime-specific pooler configuration optional. During an outage, keep sessions pinned to their assigned instance and make migrations/startup independent across reachable instances. Moving a team between instances requires its source data to be reachable; otherwise return a retryable unavailable error instead of routing to an empty database.