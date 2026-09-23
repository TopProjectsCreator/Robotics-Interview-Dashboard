---
name: Non-interactive post-merge setup
description: Constraints for dependency installation and database setup after task merges.
---

Post-merge setup runs with stdin closed, so pnpm installation must run with `CI=true` to allow automatic modules-directory cleanup. Database schema pushes can take longer than a short default timeout; keep a reasonable buffer for the install plus schema operation.

**Why:** A merge setup failed when pnpm attempted to remove the modules directory without a TTY, and the first retry timed out while the database schema was still being read.

**How to apply:** Use a CI-aware frozen-lockfile install in the post-merge script and configure at least a two-minute timeout when the script also runs database schema synchronization.