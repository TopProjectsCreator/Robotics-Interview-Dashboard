---
name: Fresh-primary schema multi-pass
description: A brand-new primary aborts schema at the first forward FK reference, and tables deferred to a later pass never receive their RLS statements.
---

`ensureSchema()` must retry failed statements across passes **and** re-run the RLS phase after every table exists; a single-pass primary plus one-shot RLS leaves a fresh database half-built and partly exposed.

**Why:** The secondary loop already ran 4 passes (its comment says FK references only resolve once their target exists) but the primary loop was single-pass. On a brand-new Supabase project `chat_message_reactions` (line 409) references `interview_chat_messages` (created ~line 978), so the first FK error aborted the whole primary schema — the instance sat at exactly 6 tables with **no log line**, because the error is only reported after the secondary loop finishes. The same ordering defect left those 4 deferred tables (`chat_message_reactions`, `chat_polls`, `chat_poll_votes`, `chat_message_reads`) with `rowsecurity = false`, readable by the publishable key, since each pass only re-runs what previously failed.

**How to apply:** Symptom = new primary frozen at a handful of tables, or `select count(*) from pg_tables where schemaname='public' and not rowsecurity` > 0 with deny policies < table count. Both loops now multi-pass with early bail, then re-run `privateTableRlsStatements` once all tables exist. Verify after any fresh build: tables ≈ code table count, `no_rls = 0`, `deny_supabase_client_access` policy count == table count.

- [Fresh-primary schema multi-pass](fresh-primary-schema-multi-pass.md) — single-pass primary aborts on forward FK refs; deferred tables also miss RLS.
