---
name: Public demo isolation
description: Keep public demo routes disconnected from authenticated team data and service side effects.
---

Public demo routes must render only fictional local fixtures and remain disconnected from authenticated team data.

**Why:** Disabling query execution does not erase cached query results, and event handlers can manually refetch disabled queries. Effects may still consume cached broadcasts or other private data.

**How to apply:** In demo mode, ignore session-scoped cache values and disable authenticated queries, but keep read-only browsing controls active. Guard writes, hardware access, and service calls at their handlers; verify navigation and previews with fetch, EventSource, and WebSocket spies.
