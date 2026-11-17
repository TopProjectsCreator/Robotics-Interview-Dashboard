---
name: Workflow orphaned processes
description: Diagnose duplicate managed Vite servers that keep old workflow ports occupied.
---

When a managed workflow reports `EADDRINUSE`, inspect process ownership and bound ports before changing the configured port. Previous workflow starts can leave processes serving traffic even while the workflow status says failed; another restart may create a duplicate and fail again. Stop the managed workflow first, then terminate only process groups verified to run that artifact, and restart it once.

**Why:** Stale mockup-sandbox Vite copies occupied ports 8081–8085, and dashboard/API processes can likewise remain available through the proxy after a failed duplicate start.

**How to apply:** Compare workflow logs with proxy requests and match process arguments and listening sockets to the exact artifact. Never use broad `pkill` patterns that can match the diagnostic shell or unrelated services. Confirm one intended listener and a clean startup log after restarting.
