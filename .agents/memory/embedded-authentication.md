---
name: Embedded authentication
description: Browser cookie and fetch requirements for embedding the coordinator dashboard in a cross-site iframe.
---

Cross-site iframe authentication uses both included credentials and a signed bearer-token fallback stored in the app's own origin. The session cookie uses `SameSite=None; Secure` when the request is HTTPS. Local HTTP development should retain `SameSite=Lax` because browsers reject `SameSite=None` without `Secure`.

**Why:** Browsers may isolate or block third-party iframe cookies entirely, so a successful login can otherwise appear to work while the following session request remains unauthenticated.

**How to apply:** Preserve the bearer-token storage/getter, secure-cookie detection based on forwarded HTTPS, and credentialed fetch when changing the auth middleware or API client. Protected media elements cannot attach bearer headers, so load iframe-protected images with an authenticated fetch and render a temporary object URL rather than relying on `<img src>` cookies.