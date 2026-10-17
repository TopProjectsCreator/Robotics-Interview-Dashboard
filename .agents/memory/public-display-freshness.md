---
name: Public display freshness
description: Realtime and polling requirements for anonymous public event displays.
---

Public display data should keep a short polling fallback even while the browser's SSE connection is open. The SSE health signal tracks the browser-to-API stream, not whether the API's database realtime relay is receiving updates. Include mutable display metadata such as the team name in the display response validator so unchanged polls are cheap and a rename invalidates the cached response.

**Why:** The API can keep its SSE stream open while a Supabase relay is disconnected, so pausing polling on SSE health can leave a public screen stale indefinitely.

**How to apply:** When updating public display freshness or realtime hints, preserve polling as the fallback and test both default and code-scoped query keys.
