---
name: Dashboard build memory
description: Production Vite build memory behavior in the shared workspace runner
---

The dashboard's production bundle build can need substantially more memory than its dev server, typecheck, or unit tests. A default-sized build has aborted at the 2 GiB V8 heap during transformation while the API and dashboard workflows were active, and it can still exceed that limit before app workflows start. Adding a second HTML entry for a browser fixture can also push the build over that limit.

**Why:** The large dashboard bundle has a high heap floor, while the shared runner also hosts a development server, API service, language servers, and browser processes.

**How to apply:** Before a production build, account for current container usage and active language servers/workflows, not just the configured Node heap. A cap at or below 2 GiB may be insufficient for this bundle; only retry after freeing services and confirming total headroom can support peak RSS. For isolated browser tests, prefer serving the fixture through Vite's dev server and the relevant API middleware rather than adding another input to the full production build. Avoid repeated retries after confirmed heap exhaustion.