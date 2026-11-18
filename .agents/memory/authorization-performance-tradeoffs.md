---
name: Authorization performance tradeoffs
description: Why performance optimizations must retain fresh authorization and existing public display links.
---

Prefer request-local account reuse over a cross-request authorization cache. For public display performance, preserve the existing code-based links rather than adding a credential-exchange flow solely to optimize polling.

**Why:** Account removal, role changes and team-code rotation must take effect on the next request across API instances. A time-to-live alone would delay revocation, while a new credential flow would widen a performance-only change.

**How to apply:** Keep account snapshots bounded to a request and database instance. Any reused successful team-code match must still check the authoritative current hash before granting access; expiration is a resource limit, not the revocation mechanism.
