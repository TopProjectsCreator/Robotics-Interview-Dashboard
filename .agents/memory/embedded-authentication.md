---
name: Embedded authentication
description: Browser cookie and fetch requirements for embedding the coordinator dashboard in a cross-site iframe.
---

Cross-site iframe authentication requires fetch requests to include credentials and the session cookie to use `SameSite=None; Secure` when the request is HTTPS. Local HTTP development should retain `SameSite=Lax` because browsers reject `SameSite=None` without `Secure`.

**Why:** Browsers isolate third-party iframe cookies by default, so a successful login can otherwise appear to work while the following session request remains unauthenticated.

**How to apply:** Preserve the secure-cookie detection based on forwarded HTTPS when changing the auth middleware or API client.