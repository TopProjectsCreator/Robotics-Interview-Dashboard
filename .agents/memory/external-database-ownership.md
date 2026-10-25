---
name: External database ownership
description: The app's DATABASE_URL can point to Supabase while Replit's managed development database remains a separate legacy resource.
---

The running app's `DATABASE_URL` must be checked by hostname before database cleanup. A Supabase pooler host means Drizzle application data lives in Supabase; Replit's Database tool and `executeSql` target a separate managed development database. Clearing the latter does not clear Supabase data.

The configured secondary Supabase database is intentional and must remain available for teams routed to it. A DNS or network error is not evidence that its secret is absent; do not ask the user for a replacement URL or remove secondary routing without their direction.

**Why:** The project retained an active Replit development database after moving application storage to Supabase, which made the Database pane show old records and storage unrelated to the current app.

**How to apply:** Confirm the connection hostname and target database before destructive operations or schema pushes. The API workflow sources `.env`, while a bare database CLI command may use Replit's injected development URL; treat those databases as separate until verified. Preserve the configured secondary connection and diagnose runtime reachability separately from secret presence.