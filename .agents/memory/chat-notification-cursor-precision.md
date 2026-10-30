---
name: Chat notification cursor precision
description: Timestamp precision requirements for message-level chat notification pagination
---

Chat notification keyset cursors must preserve the database timestamp precision as well as the message ID. Do not round-trip cursor timestamps through JavaScript `Date`.

**Why:** PostgreSQL retains microseconds while JavaScript `Date` truncates to milliseconds; a rounded cursor can include the last row again or make page boundaries unreliable when messages share a timestamp.

**How to apply:** Serialize the database timestamp as exact UTC text, keep that string inside the opaque cursor, and bind it back as a timestamp for keyset comparisons.
