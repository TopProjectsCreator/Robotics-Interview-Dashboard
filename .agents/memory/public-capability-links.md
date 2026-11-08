---
name: Public capability links
description: Security measures for secret bearer URLs that grant anonymous read access.
---

Treat public share tokens as bearer capabilities. Generate them with cryptographic randomness, redact them from request logs when they appear in route paths, and prevent cached responses or referrers from extending their exposure. Public APIs should return only the exact data the capability authorizes.

**Why:** A valid URL grants access without a session, so logs, caches, referrer headers, or accidental response fields can turn a limited share into a broader disclosure.

**How to apply:** When adding any public link-based read feature, review token entropy, revocation, request logging, response caching, referrers, and the smallest possible response contract.
