---
name: Chat message tombstones
description: Interview-chat deletion, edit markers, and sent timestamps
---

Interview-chat deletion keeps the message row as a tombstone so replies and conversation history can still show that a message was deleted. Scrub its body, activities, pin, reactions, poll, and votes; retain the original sent timestamp and record deletion time. Edits record a separate edited timestamp without changing sent time.

**Why:** Users need an honest chat history without retaining deleted message content or breaking replies that refer to the original message.

**How to apply:** Keep tombstones visible in shared and direct conversations, display full sent date and time plus edit/delete state, and include edit/delete timestamps in cache freshness checks.
