---
name: Dashboard build memory
description: Production Vite build memory behavior in the shared workspace runner
---

The dashboard's production bundle build can need substantially more memory than its dev server, typecheck, or unit tests. In the shared runner, a high Node heap cap can cause the OS to kill the build when other services already consume the container's memory.

**Why:** Rollup chunk rendering exceeded a 2 GB heap, while a larger cap was killed under memory pressure; the build succeeded after setting a heap limit that fit the available container headroom.

**How to apply:** Before retrying a production build, account for current container usage and active language servers/workflows, not just the configured Node heap. Avoid treating a memory-killed build as an application error.