---
name: Kilo model catalog route
description: Endpoint-path behavior for listing models through the configured Kilo OpenRouter-compatible provider.
---

When `AI_INTEGRATIONS_OPENAI_BASE_URL` points at Kilo's OpenRouter-compatible route, use the existing OpenAI client's `models.list()` method. With the current base URL, the catalog is served under `/api/openrouter/models`; appending `/v1` returns a method error. For the keyless free catalog, trust each record's `isFree === true` metadata. ID suffixes are incomplete: some free entries have no `:free` suffix.

**Why:** Kilo's base URL already includes its provider route, so the usual OpenAI `/v1` suffix is not valid there; its explicit free flag includes valid models that naming heuristics would miss.

**How to apply:** Keep catalog requests server-side, use the configured SDK client, and filter on the provider's boolean free flag rather than model-name patterns or inferred price values.