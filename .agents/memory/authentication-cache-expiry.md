---
name: Authentication cache expiry
description: Session expiry handling for cached private data and live collaboration connections
---

Authentication failures that invalidate a session should not use the ordinary query retry delay. TanStack Query's cache-level error callback runs after retries are exhausted, so retrying an unauthorized request leaves stale private records visible and realtime subscriptions active during that delay.

**Why:** A server-revoked interviewer session must remove the previous account's data promptly, not after exponential backoff.

**How to apply:** Exclude session-expired responses from query retries before relying on global cache error handling to clear user-scoped data and stop live connections.

Protected editor routes unmount when session authentication becomes false. Their collaboration cleanup must close the socket and ignore queued message callbacks after teardown; calling close alone does not guarantee already-queued events stop.

**Why:** Late WebSocket events can still mutate editor state after the session has ended, and stale close events can otherwise schedule a reconnect.

**How to apply:** Keep per-connection stopped/identity checks in open, message, and close callbacks, and test unmount cleanup, stale updates, and a new authenticated connection.