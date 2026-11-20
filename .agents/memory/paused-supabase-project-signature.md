---
name: Paused Supabase project signature
description: A stopped Supabase project answers TCP at the pooler but never completes auth, so queries can queue forever instead of failing.
---

Distinguish "project paused/stopped" from "wrong secret": the pooler still accepts TCP and TLS, then backend auth or the query itself never finishes. Bound schema statements with a timeout, because Supavisor queues rather than rejects.

**Why:** On 2026-11-20 the secondary project (`xjngarebhpebxlegfgdr`) produced `FATAL: Failed to connect to database: authentication did not complete within 15000ms` and `Failed to connect to database: {:error, :timeout}` (SQLSTATE 08006 — Elixir wording emitted by Supavisor), its HTTPS/REST endpoint hung to curl `000` at 15s while a healthy project returned 200 in 0.48s, and `ensureSchema()`'s secondary loop then awaited statements that never settled — minutes of silence, background jobs paused with no error logged, and ~800 statements × 10–15s of timeout would have stretched it to hours.

**How to apply:** Test the three layers separately — pooler TCP, auth (`psql` with a 12s `connect_timeout`), and REST (`/storage/v1/bucket` with the secret key). A DNS resolution plus a hang means the project exists but its compute is stopped; the fix is restoring it in the Supabase dashboard, not re-requesting credentials. `isDatabaseConnectionError()` now also matches Supavisor's wording so the schema loops bail early into the normal 60s retry.

- [Paused Supabase project signature](paused-supabase-project-signature.md) — pooler accepts TCP but auth/REST hang; restore the project, and bound schema statements.
