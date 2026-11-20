---
name: OpenCode DB compaction history
description: Find session compaction attempts in the OpenCode SQLite DB via session_message rows of type 'compaction'; check the JSON status field.
---

OpenCode's session database is `~/.local/share/opencode/opencode.db` (here `/home/runner/workspace/.local/share/opencode/opencode.db`). A session's compaction history is stored as `session_message` rows with `type = 'compaction'` for that `session_id`, not in the `event` table. The row's `data` JSON has a `status` field (`completed` or `failed`) and a `reason` (e.g. `auto`); failed rows carry `error.type = "compaction.interrupted"`.

**Why:** Counting all `compaction` messages overcounts actual compactions — a session can have both a completed compaction and a later interrupted/failed attempt, so the raw count is attempts, not successes.

**How to apply:** Locate the session first (`SELECT id, slug, title FROM session_v2 WHERE title LIKE '%...%'`), then query `SELECT seq, time_created, json_extract(data,'$.status') FROM session_message WHERE session_id=<id> AND type='compaction' ORDER BY seq`. Report both the total attempt count and the completed-vs-failed breakdown so the answer is unambiguous. Symptom: the user asks "how many times did it compact" and the DB shows 2 rows but only 1 `status:'completed'`.
