---
name: Collaborative document edit transactions
description: Preserve live Yjs room state when an assistant edit's database transaction fails.
---

Stage server-side edits for an open collaborative Document on a cloned Y.Doc. Validate size and persist the candidate envelope inside the database transaction, then apply only its Yjs update to the live room after the transaction commits.

**Why:** A live Y.Doc update observer broadcasts changes and schedules persistence immediately. Mutating the room before the transaction succeeds can expose or later save an edit that the API reports as failed.

**How to apply:** Any server-side path that edits a live Yjs document should prepare and validate on a clone, commit durable state first, then merge the encoded update into the current room.