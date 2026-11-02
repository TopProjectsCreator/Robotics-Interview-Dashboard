---
name: Cross-process builder cancellation
description: Prevent late AI worker writes when pausing or deleting custom workspaces.
---

Pausing, stopping, or deleting builder work must use durable database state across API replicas; an in-memory abort controller only signals workers in its own process. Keep a run non-resumable until every running prompt settles. A timeout means preserve workspace data and do not offer continuation.

**Why:** Coordinators and builder jobs can reach different server instances. Returning a paused state too early exposes a continuation while old model or tool work can still write.

**How to apply:** Persist cancellation intent, await prompt settlement using durable status plus local controller checks, and gate stale recovery, retries, answers, heartbeats, and completion against that intent. Keep live worker heartbeats active during cancellation so stale recovery does not mistake a slow but live worker for a dead one.
