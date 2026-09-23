---
name: External database ownership
description: The app's DATABASE_URL can point to Supabase while Replit's managed development database remains a separate legacy resource.
---

The running app's `DATABASE_URL` must be checked by hostname before database cleanup. A Supabase pooler host means Drizzle application data lives in Supabase; Replit's Database tool and `executeSql` target a separate managed development database. Clearing the latter does not clear Supabase data.

**Why:** The project retained an active Replit development database after moving application storage to Supabase, which made the Database pane show old records and storage unrelated to the current app.

**How to apply:** Confirm the connection hostname and target database before destructive operations. Treat Replit development database cleanup and Supabase data cleanup as separate, explicitly authorized actions.