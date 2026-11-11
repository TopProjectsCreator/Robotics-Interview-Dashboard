---
name: Strict AI response schemas
description: Preserve complete per-conversation results when one model request assesses multiple chat channels.
---

For one AI request that must return a separate assessment for every dynamic channel, use a strict JSON Schema that lists every channel ID as a required top-level property. JSON-object mode can return valid JSON while omitting a conversation, causing the whole result to be discarded.

**Why:** Live testing with shared and private conversations showed that prompt-only JSON mode could omit a required conversation even when the input contained both. A strict schema produced complete persisted results in one request.

**How to apply:** Build the schema from the exact conversation keys at request time, require every key and assessment field, and avoid arbitrary array or text-length caps when the product requires uncapped output. Keep the parser as a final validation boundary.
