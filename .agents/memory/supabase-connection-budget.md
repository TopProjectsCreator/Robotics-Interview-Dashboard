---
name: Supabase connection budget
description: Keep Realtime relay sockets and PostgreSQL pool sessions bounded for the primary and secondary Supabase projects.
---

Keep one server-side Supabase Realtime relay client per configured database per API process, and explicitly disconnect a failed client before scheduling a replacement. A Realtime client's own reconnect loop can otherwise leave old sockets alive as replacement clients are created. Keep PostgreSQL pools explicitly capped rather than relying on node-postgres defaults.

**Why:** The user reported only 14 app users while both Supabase projects showed Realtime peak connections above 200; the relay retry lifecycle was able to accumulate sockets.

**How to apply:** When modifying Realtime retry or database pool setup, preserve a single-client lifecycle, bounded retries, explicit socket teardown, and explicit pool maxima. A per-process cap is not a global cap if the deployment runs multiple API replicas.
