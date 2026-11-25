---
name: Health probes must start before schema migration
description: Auto-failover silently fails if health probes start only after schema completes and every successful DDL resets the failure count.
---

Instance failover has two easy-to-miss gating bugs.

**Why:** On 2026-11-23 a startup `ALTER TABLE` lock storm saturated the primary's 4-connection pool. `ACTIVE_TEAM_DATABASE=primary` was supposed to auto-fall back, but it never did: (1) `startInstanceHealthProbes()` lived inside `startBackgroundWork()`, which only runs after `ensureSchema()` resolves and the active DB is ready — a stalled schema pass means no probes at all; (2) every successful schema statement called `markInstanceSuccess()`, resetting the probe's failure count and forcing `healthy = true`; (3) pg-pool's `timeout exceeded when trying to connect` was not classified as a connection error by `isDatabaseConnectionError()`.

**How to apply:** Start health probes immediately at app bootstrap, before the schema attempt, and keep them independent of background-work gating. Let only probes own health state — do not mark healthy from arbitrary successful queries. Classify pg-pool acquisition timeouts as connection errors (but not `statement timeout`, which is a slow-query signal). Verify with `pg_stat_activity` lock chains and by checking that a saturated pool causes the probe to fail within its timeout.
