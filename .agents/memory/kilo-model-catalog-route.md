---
name: Kilo model catalog route
description: Endpoint-path behavior for listing models through the configured Kilo OpenRouter-compatible provider.
---

When `AI_INTEGRATIONS_OPENAI_BASE_URL` points at Kilo's OpenRouter-compatible route, use the existing OpenAI client's `models.list()` method. With the current base URL, the catalog is served under `/api/openrouter/models`; appending `/v1` returns a method error.

**Why:** Kilo's base URL already includes its provider route, so the usual OpenAI `/v1` suffix is not valid there.

**How to apply:** Keep catalog requests server-side and use the configured SDK client so the base URL and authorization behavior stay aligned with chat completions.