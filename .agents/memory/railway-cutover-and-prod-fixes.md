---
name: Railway cutover and deployed DM/send fixes
description: On 2026-11-25 production was repointed from dead Supabase primary to Railway Postgres; DM peer-token and migration-lock fixes were pushed and deployed.
---

On 2026-11-25 the user explicitly authorized moving production off the restricted Supabase primary. Railway service `robotics-dashboard` variables `PRIMARY_DATABASE_URL` and `DATABASE_URL` were set to the Railway Postgres TCP proxy `roundhouse.proxy.rlwy.net:56522` (database `railway`), which holds the verified secondary dump. Supabase secondary credentials remain in place as fallback. A Railway deploy succeeded (`c7084971…`), health 200, no errors in logs.

Deployed fixes (commit `29c714f0`): DM conversations query matches the viewer as a whole `chr(31)` token so `Clinton<US>Yishaan` is not reported as an unread Clinton DM for `Ishaan`; startup migrations skip already-applied column/index/trigger/RLS DDL and use a 3 s DB-side lock timeout so chat writes and sends no longer queue behind migrations; failover probes start before schema and schema successes no longer reset health; pg-pool's `timeout exceeded when trying to connect` is classified as a connection error.

**Why:** locally the old build plus `.env` pointing at the dead Supabase pooler made both DM unread and message sending appear broken even though the source fixes existed. Rebuilding, repointing `.env` to Railway Postgres, and restarting made sends return 201 in ~1 s and the Clinton DM show `unread=false` for both `Ishaan` and `Yishaan`.

**How to apply:** when a user reports a fix "not working locally", first check that the running build and `.env` match the intended code/DB before changing code. GitHub push needs `git push https://x-access-token:$(gh auth token)@github.com/TopProjectsCreator/Robotics-Interview-Dashboard.git main`; the `http.extraHeader` form fails here. Never leave verification teams/messages in the prod DB — clean them up.
