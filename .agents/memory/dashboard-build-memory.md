---
name: Dashboard build memory
description: Production Vite build memory behavior in the shared workspace runner
---

The dashboard's production bundle build can need substantially more memory than its dev server, typecheck, or unit tests. The current bundle exceeded a 1.75 GiB V8 heap during transformation, even with roughly 3.4 GiB host memory available. Increasing the cap without checking concurrent services can still cause an OS-level kill.

**Why:** The large dashboard bundle has a high heap floor, while the shared runner also hosts a development server, API service, language servers, and browser processes.

**How to apply:** Before a production build, account for current container usage and active language servers/workflows, not just the configured Node heap. A cap at or below 1.75 GiB may be insufficient for this bundle; choose a limit only when total headroom can support its peak RSS, and avoid repeated retries after confirmed heap exhaustion.