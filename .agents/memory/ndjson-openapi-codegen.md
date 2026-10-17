---
name: NDJSON OpenAPI clients
description: How generated OpenAPI clients handle newline-delimited JSON responses.
---

**Rule:** Use a dedicated streaming client helper for `application/x-ndjson` endpoints and keep its event union documented in OpenAPI.

**Why:** Current Orval generation emits a TypeScript event union, a raw `Response` fetch helper, and an `unknown` Zod operation response; it does not generate typed incremental parsing or event validation.

**How to apply:** Preserve NDJSON responses as raw streams in the shared custom fetch, and use a dedicated typed helper to parse newline-delimited events and validate their shapes before exposing them to UI code.
