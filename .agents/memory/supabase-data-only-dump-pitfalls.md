---
name: Supabase data-only dump pitfalls
description: A Supabase pg_dump for cross-project migration needs public-only filtering, search_path repair, and trigger-generated cache rows removed.
---

A `--data-only` dump of a Supabase project is not directly restorable into a fresh target: it contains internal schemas, sets `search_path` to empty, and includes derived rows that target triggers regenerate.

**Why:** On the 2026-11-20 secondary→primary move the raw 26MB dump failed three times in a row: (1) `permission denied for table schema_migrations` — the dump held 47 `auth.*`/`realtime.*` COPY blocks that our role cannot write; (2) `relation "chat_revisions" does not exist` — pg_dump emits `SELECT set_config('search_path','',false)`, so the `bump_chat_revision()` trigger's unqualified insert could not resolve the table (which *did* exist in public); (3) `duplicate key (default, reader:...) already exists` on `chat_revisions` — the target triggers had already rebuilt that derived cache while loading chat rows, colliding with the dump's own copy. A fourth failure came from single-row caches (`parts_catalog_crawl_state`, `parts_catalog_sync_state`) that the target seeds at boot.

**How to apply:** Filter to `COPY public.` blocks only; inject `SET search_path = public, pg_catalog;` after pg_dump's `set_config('',false)`; drop COPY blocks for trigger-derived tables like `chat_revisions`; and truncate target-seeded single-row caches inside the same restore transaction. Drop non-deferrable self-referencing FKs before the load and re-add them after (we are not superuser, so `--disable-triggers` is unavailable). Verify with row counts parsed from the dump's own COPY blocks.

- [Supabase data-only dump pitfalls](supabase-data-only-dump-pitfalls.md) — public-only filter, search_path fix, derived-cache blocks, seeded-row collisions.
