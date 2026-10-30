---
name: Assistant model policy modality compatibility
description: How team-wide assistant model locks interact with server-side image requests.
---

Locking a team's default model prevents users and agents from selecting a different text model. When that default cannot accept image input, server-side vision requests may use the configured image model or another compatible model, but only when the team policy permits it. If no permitted image-capable model exists, fail clearly.

**Why:** A text-only locked default cannot process vision input; failing every image flow would violate modality compatibility, while bypassing allow/block lists would violate the policy.

**How to apply:** Resolve text overrides against the lock and lists. For vision, preserve modality requirements and apply the same effective-model restrictions to any server-selected compatible fallback.
