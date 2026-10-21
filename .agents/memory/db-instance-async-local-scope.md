---
name: Database instance pinning scope
description: AsyncLocalStorage must hold a per-request scope object, not a bare instance string, or a nested pin leaks into the caller.
---

`lib/db` resolves every query to a primary or secondary database through an `AsyncLocalStorage` store. `runWithInstance` starts a scope and `enterInstance` re-pins the rest of the current request once the handler knows which team's database it needs.

The store must hold a fresh **scope object** (`{ instance }`) per request, never a bare instance string. `AsyncLocalStorage.run` short-circuits and creates no new async resource when the store it is handed is identical to the one already active, so a string store lets a nested `runWithInstance` reuse the caller's scope and leak into it. A fresh object per scope guarantees a fresh async resource every time, and `enterInstance` mutates only its own request's scope.

**Why:** `enterInstance` writes to the ambient async context. With a shared string store, a request pinned to the secondary database could bleed that pin into an unrelated request that later reuses the same keep-alive connection, sending one team's rows to another team's database.

**How to apply:** Keep the store typed as a scope object. `enterInstance` mutates `scope.instance` on the object it finds and only falls back to `enterWith` when there is no request scope at all (boot, tests, cron). Never write the instance string itself into the store, and never call `enterWith` inside a request that already has a scope.
