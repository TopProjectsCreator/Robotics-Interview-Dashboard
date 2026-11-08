---
name: Maildrop bearer-key limitation
description: Maildrop's published GraphQL overview still says authentication is not required; successful checks cannot verify team keys.
---

Rechecked the official API overview on 2026-11-08: it still says the GraphQL API requires no authentication and only requires POST with `Content-Type: application/json`. Bearer-token authentication is described only as a possible future requirement. The team inbox sends each saved key as an `Authorization: Bearer` header, but a successful response cannot prove Maildrop accepted the key; only an explicit authentication rejection can be reported as rejection.

**Why:** Provider-side authentication is not currently documented as active, so treating a successful check as key verification would be misleading.

**How to apply:** Before claiming Maildrop validates keys or relying on provider rejection to disable invalid credentials, re-check `https://docs.maildrop.cc/api-reference/overview.md` and confirm Maildrop has enabled bearer authentication.
