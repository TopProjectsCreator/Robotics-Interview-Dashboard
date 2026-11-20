---
name: External database ownership
description: The app's DATABASE_URL can point to Supabase while Replit's managed development database remains a separate legacy resource.
---

The running app's `DATABASE_URL` must be checked by hostname before database cleanup. A Supabase pooler host means Drizzle application data lives in Supabase; Replit's Database tool and `executeSql` target a separate managed development database. Clearing the latter does not clear Supabase data.

The configured secondary Supabase database is intentional and must remain available for teams routed to it. A DNS or network error is not evidence that its secret is absent; do not ask the user for a replacement URL or remove secondary routing without their direction.

Connection routing is runtime-specific: this Replit environment cannot resolve the secondary's direct Supabase hostname, while the configured Supavisor session pooler is reachable. Keep pooler routing opt-in and return the configured direct URL unchanged when no pooler host is supplied; do not hardcode a region into shared database code.

A configured-but-unreachable secondary is usually a stopped project, not a missing secret — the pooler accepts TCP while auth and REST hang (see [Paused Supabase project signature](paused-supabase-project-signature.md)). Note the pooler generation in the configured URL: this instance's secondary runs on `aws-1-ca-central-1.pooler.supabase.com`, and newer projects live on `aws-1-*` rather than `aws-0-*` (see [Supabase pooler host discovery](supabase-pooler-host-discovery.md)).

Standing direction from 2026-11-20: the new Supabase primary is the intended home for all teams, and the secondary is retained as a backup. The data move is pending the secondary's restore — until then keep secondary routing configured and do not treat its outage as permission to drop it.

All team data has been moved to the secondary database; the user confirmed on 2026-11-08 that primary is empty. Treat secondary as authoritative whenever configured: legacy sessions, default-team operations, new teams, account/team lookups, and background work must use it. Do not depend on primary or write new team data there.

**Why:** The project retained an active Replit development database after moving application storage to Supabase, which made the Database pane show old records and storage unrelated to the current app. On 2026-11-08, the user clarified that every team is on secondary and primary is empty; older notes that teams remained on primary are stale. A primary connectivity failure must not block secondary startup or send team requests to an empty database.

**How to apply:** Confirm the connection hostname and target database before destructive operations. The API workflow sources `.env`, while a bare database CLI command may use Replit's injected development URL; treat those databases as separate until verified. Preserve the configured secondary connection, diagnose runtime reachability separately from secret presence, and keep runtime-specific pooler configuration optional. Route unmarked legacy sessions and team background work to secondary; retain explicit database-instance markers where needed. Treat a primary connectivity failure as a warning when secondary schema setup succeeds. Keep genuine schema failures visible and return retryable 503 responses for connection failures, including errors nested by Drizzle; never fall back to empty primary for team reads or writes.