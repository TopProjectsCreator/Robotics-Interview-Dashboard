---
name: Dual-instance reads require matching writes
description: When reads span both Supabase instances, the mark-read/write path must query both too or receipts are silently lost.
---

If a read path is broadened to query multiple databases (primary + secondary fallback), every related write/lookup path must be broadened the same way, or the feature silently breaks for rows from the other instance.

**Why:** After adding `readAcrossInstances()` to the chat GET (so messages on either Supabase instance render), `/queue/chat/read` still looked up the message ids with a single-instance `db` query. Any message that actually lived on the secondary displayed fine but could never get a read receipt — the mark-read endpoint returned `recorded: 0` with no error. The user reported "it doesn't see that I've read the messages" even after reading dozens of times. The fix was to use `readAcrossInstances()` in the mark-read message lookup as well.

**How to apply:** When introducing multi-instance reads, audit all endpoints that reference the same rows (mark-read, reactions, polls, edits, deletes) and switch their lookups to the same helper. Verify with an end-to-end two-account test: A posts, B reads in a real browser, A sees B in `readBy`. Also note receipts carry a per-reader revision key (`reader:<id>`) plus a global `reads` key; the chat ETag watches only the global one.
