---
name: Chat cache revisions
description: Consistency requirements for constant-time chat cache validation across API instances.
---

Use database-maintained monotonic revisions for idle chat ETag checks instead of recounting retained messages or receipts. Update revisions in the same transaction as the chat mutation, preferably with database triggers so route handlers, background work, cascading deletes, and other API instances cannot bypass invalidation. Keep content revisions team-scoped and read-state revisions scoped to the viewer where the response depends on that viewer; team-level read invalidation is also needed for message-thread receipts visible to other members.

**Why:** Chat messages can change through multiple routes and processes, and validating cache tags with exact history aggregates makes idle polling grow with retained history. A process-local counter misses writes from other API instances.

**How to apply:** When adding a chat mutation or a cached response, verify every relevant event type updates the revision atomically, default-team legacy rows share the default revision, and private read state does not leak between viewers.
