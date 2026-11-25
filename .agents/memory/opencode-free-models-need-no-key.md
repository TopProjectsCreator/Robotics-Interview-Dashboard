---
name: OpenCode free models need no API key
description: Free `opencode/*` models like big-pickle work with no OPENCODE_API_KEY; don't add a key secret for them.
---

`opencode/big-pickle` is a free Console/Zen model. It works with no `OPENCODE_API_KEY` at all — verified locally on v2.2.6 with the variable unset (`opencode run --standalone --auto --archived --format json --model opencode/big-pickle ...` returned a completion). Setting it to `""` is unnecessary; omit it entirely.

**Why:** The docs line about "signed out, the `opencode` provider is absent" applies to *paid* models. Free models are listed as Free in the Console pricing table. GitHub issue #59027 confirms v1 worked "with no key" and that `FreeUsageLimitError` is a per-account free-quota rejection, not a missing-key error.

**How to apply:** Don't add an API-key secret for free models. In CI, watch for `429 FreeUsageLimitError` (shared runner IPs can exhaust the daily quota) — only then add a Console/Go key.
