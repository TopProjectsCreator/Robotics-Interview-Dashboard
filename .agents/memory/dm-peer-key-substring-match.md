---
name: DM peer keys need exact token matching
description: A substring search for the viewer's label in conversation_peer matches longer names (Yishaan contains Ishaan), creating phantom unread DMs.
---

Direct-message keys are two labels joined by the unit separator `chr(31)`. Filtering them with `position(lower(viewer) in lower(conversation_peer)) > 0` is wrong: it matches any name containing the viewer's name as a substring.

**Why:** On 2026-11-23 the user kept seeing an unread "Clinton" DM after opening and reading it dozens of times. The real source was an old `Clinton<US>Yishaan` conversation on the secondary; "yishaan" contains "ishaan", so it was returned as a conversation for the "Ishaan" account with `isUnread = true`. Reading the real `Clinton<US>Ishaan` thread could never clear it because the mark-read route uses the exact canonical key for the selected peer. All 71 receipts for the real thread were present in the DB.

**How to apply:** Match the viewer as a whole token: `position(chr(31) || lower($1) || chr(31) in chr(31) || lower(conversation_peer) || chr(31)) > 0`. Never use bare substring containment on delimited keys. When a badge will not clear, replicate the unread SELECT in SQL with the signed-in account id and compare against receipts before changing the mark-read flow.
