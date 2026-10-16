---
name: Kilo model catalog route
description: Endpoint-path behavior for listing models through the configured Kilo OpenRouter-compatible provider.
---

When `AI_INTEGRATIONS_OPENAI_BASE_URL` points at Kilo's OpenRouter-compatible route, use the existing OpenAI client's `models.list()` method. With the current base URL, the catalog is served under `/api/openrouter/models`; appending `/v1` returns a method error. For the keyless free catalog, trust each record's `isFree === true` metadata. ID suffixes are incomplete: some free entries have no `:free` suffix.

For model-specific thinking controls, read each model's `supported_parameters`. Do not send reasoning options to a model that does not advertise `reasoning` or `reasoning_effort`. Use `reasoning: { effort }` when `reasoning` is advertised, or top-level `reasoning_effort` when that is the advertised parameter. The catalog identifies parameter support, not a per-model list of effort values; avoid extra values such as `xhigh` unless the provider supplies explicit level metadata.

**Why:** Kilo's base URL already includes its provider route, so the usual OpenAI `/v1` suffix is not valid there; its explicit free flag includes valid models that naming heuristics would miss.

**How to apply:** Keep catalog requests server-side, use the configured SDK client, trust the provider's boolean free flag, and validate any model-specific reasoning setting against advertised parameters before sending it.