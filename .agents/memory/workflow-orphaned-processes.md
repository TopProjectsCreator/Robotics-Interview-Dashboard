---
name: Workflow orphaned processes
description: Diagnose duplicate managed Vite servers that keep old workflow ports occupied.
---

When a managed workflow reports `EADDRINUSE`, inspect process ownership and bound ports before changing the configured port. Previous workflow starts can leave multiple processes from the same artifact holding ports even when only one managed workflow appears in the list. Stop the managed workflow first, then terminate only process groups verified to run that artifact, and restart it once.

**Why:** Several stale mockup-sandbox Vite copies occupied ports 8081–8085 and caused fallback warnings. Restarting alone did not clear every old process.

**How to apply:** Match process arguments and listening sockets to the exact artifact; never use broad `pkill` patterns that can match the diagnostic shell or unrelated services. Confirm one intended listener and a clean startup log after restarting.
