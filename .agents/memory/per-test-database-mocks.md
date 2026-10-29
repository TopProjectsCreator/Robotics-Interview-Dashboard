---
name: Per-test database mocks
description: Preserve test-harness-specific database mocks across helpers imported through shared module paths.
---

In API tests that dynamically import a route with a fresh mocked database for each harness, keep any shared helper independent of a module-level `pool` singleton. Pass the test-local query adapter into the helper instead; otherwise a cached helper can keep the pool from a prior harness, making tests mutate stale state or miss simulated failures.

**Why:** Route modules are refreshed between test harnesses, but their non-query-qualified helper imports can stay cached and retain an earlier pool mock.

**How to apply:** When extracting database work from a route tested with isolated pool mocks, inject a query callback into the helper. Keep the helper free of imported pool instances and verify that failure injection uses the current harness.
