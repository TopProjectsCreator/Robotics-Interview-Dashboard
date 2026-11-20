---
name: Supabase disk I/O saturation diagnosis
description: Sustained 100% disk I/O with one user online traces to job pollers plus realtime WAL decoding, not user traffic.
---

When a Supabase backend sits at 100% disk I/O with almost no users, query the statistics views before blaming traffic: `pg_stat_statements` (calls, temp_blks_written, shared_blks_read), `pg_stat_user_tables` (seq_scan vs idx_scan), `pg_statio_user_tables`, `pg_stat_wal` (`wal_buffers_full`), `pg_stat_archiver`, and `pg_stat_replication`.

**Why:** On the saturated secondary (`xjngarebhpebxlegfgdr`, 100% I/O for 5 days, one person online), diagnostics showed `wal_buffers_full=17.2M`, `temp_bytes=52GB` over 49 days, a WAL-decoding query called **5.6M times** for 38,409s (Supabase Realtime's logical slot, which the app feeds by adding ~19 tables to `supabase_realtime`), and an assistant-job query called **18.2M times** with 6M sequential scans on `assistant_builder_runs`/`assistant_prompt_runs` from a 1.5s dispatcher with no index on status. `work_mem` was only 2MB, forcing temp spills. The pooler's 15s checkout cap (`ECHECKOUTTIMEOUT`) makes repeated polling *slower*, not absent.

**How to apply:** Distinguish read pressure (shared_blks_read, seq scans), write pressure (WAL generation, wal_buffers_full), and temp spills (temp_bytes / work_mem). Fix the app-side drivers: add status indexes for job-claim queries, back off pollers when idle, and limit realtime publication membership to tables browsers actually watch. In PG17 read checkpoint stats from `pg_stat_checkpointer`, not `pg_stat_bgwriter`, and use `pg_stat_archiver`/`pg_stat_replication` to confirm WAL consumers.

- [Supabase disk I/O saturation diagnosis](supabase-disk-io-saturation.md) — one user + 100% I/O: check pollers, realtime WAL decoding, temp spills, and PG17 stats views.
