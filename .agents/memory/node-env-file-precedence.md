---
name: Node env-file precedence
description: `node --env-file-if-exists` never overrides variables already present in the process environment.
---

A file-based env load is the *lowest* priority: whatever the launcher inherited wins, so repointing `.env` changes nothing for keys the platform already injects.

**Why:** Replit injects `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` and every `SECONDARY_*` into the process environment. After `.env` was repointed at a new Supabase project, a bare `pnpm --filter @workspace/api-server run start` would still have run against the old project — silently, with a 200 health check. Confirmed with `FOO=from_process node --env-file-if-exists=prec.env -e 'console.log(process.env.FOO)'`, which printed `from_process`.

**How to apply:** Check `/proc/<pid>/environ` of the running server to see the values it actually has, and prefer keys the platform does *not* inject (that is why `PRIMARY_DATABASE_URL` works while `SUPABASE_URL` did not). Launch through `start-servers.sh`, which does `set -a; source .env; set +a` so `.env` explicitly overwrites inherited values, and keep `.env` gitignored (line 74 of `.gitignore`).

- [Node env-file precedence](node-env-file-precedence.md) — env-file loses to inherited env; verify via /proc/<pid>/environ and source .env with set -a.
