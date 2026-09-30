---
name: Authentication cache expiry
description: React Query retry behavior for session-critical authentication failures
---

Authentication failures that invalidate a session should not use the ordinary query retry delay. TanStack Query's cache-level error callback runs after retries are exhausted, so retrying an unauthorized request leaves stale private records visible and realtime subscriptions active during that delay.

**Why:** A server-revoked interviewer session must remove the previous account's data promptly, not after exponential backoff.

**How to apply:** Exclude session-expired responses from query retries before relying on global cache error handling to clear user-scoped data and stop live connections.