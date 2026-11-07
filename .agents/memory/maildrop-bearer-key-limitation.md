---
name: Maildrop bearer-key limitation
description: Current official Maildrop documentation says the GraphQL API does not enforce authentication.
---

Maildrop's official API overview currently says the GraphQL API requires no authentication and only requires POST with `Content-Type: application/json`. It mentions bearer-token authentication only as a possible future requirement. The team inbox sends each saved key as an `Authorization: Bearer` header, but a successful current response does not prove the key is valid.

**Why:** Team-owned credentials are a product requirement, but provider-side authentication is not currently documented as active, so treating a successful check as key verification would be misleading.

**How to apply:** Before claiming Maildrop validates keys or relying on provider rejection to disable invalid credentials, re-check `https://docs.maildrop.cc/api-reference/overview.md` and confirm Maildrop has enabled bearer authentication.
