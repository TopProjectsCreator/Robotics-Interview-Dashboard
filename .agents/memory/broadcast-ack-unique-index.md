---
name: Broadcast acknowledgement uniqueness
description: Broadcast acks need a unique index on (broadcast, session) or every poll adds a row and duplicates the broadcast.
---

`broadcast_acks` records that a session has seen a broadcast. The insert is idempotent in intent but was not idempotent in practice: with no unique constraint the insert never conflicted, so every poll of "my broadcasts" appended another row for the same `(broadcast_id, session_hash)` pair.

The "my broadcasts" join then returned the same broadcast once per accumulated ack row, so a coordinator saw the same announcement repeated.

**Why:** The duplication was invisible while a session saw a broadcast once, and grew with polling frequency. The rows were small, so nothing looked wrong until the roster started showing the same message repeatedly.

**How to apply:** Keep the unique index `broadcast_acks_broadcast_session_unique` on `(broadcast_id, session_hash)` in the Drizzle schema, and create the same index in the boot-time `ensureSchema` migration. Because the index may be added to a table that already holds duplicates, run the dedup `DELETE ... USING` self-join **before** creating the index in the same migration.
