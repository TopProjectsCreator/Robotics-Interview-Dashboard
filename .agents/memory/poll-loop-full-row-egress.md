---
name: Poll loops must project columns, bound history, and cancel on disconnect
description: Frequent polls of wide rows and unbounded recovery scans can create severe direct-database egress.
---

Never write a polling loop as `db.select().from(table)` when it only checks a few fields, and never give a recovery scan an open-ended historical range.

**Why:** A builder answer poll repeatedly fetched prompt, questions, answers, activities, and result data even though it inspected only a few fields. Disconnected SSE clients also left those polls running. Separately, a recovery scan repeatedly selected historical settled prompts that it skipped but never excluded. Together, these loops generated substantial direct database egress despite a small user population.

**How to apply:** Project only inspected columns in every poll; add both lower and upper time bounds to recovery scans (`updated_at > now() - lookback AND updated_at < staleBefore`); throttle crash-recovery scans independently of the low-latency job dispatcher; and register `res.on("close", () => { if (!res.writableEnded) abort.abort(); })` on SSE routes so an abandoned stream clears its intervals. Verify with `pg_stat_statements` snapshots before/after and a source-level regression test for the projection, bounds, and disconnect handler.
