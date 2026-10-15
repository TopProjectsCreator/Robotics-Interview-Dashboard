---
name: Vitest React runtime
description: React Testing Library component tests need the development React runtime in this workspace.
---

Run dashboard Vitest component tests with `NODE_ENV=development`. Under the environment's production React runtime, `react-dom/test-utils` expects `React.act`, which is unavailable and causes component renders to fail before the tests run.

**Why:** The same component tests passed after selecting the development runtime; the production-mode failure was a test-environment issue, not an application regression.

**How to apply:** Prefix dashboard Vitest commands with `NODE_ENV=development`, especially when all React Testing Library renders fail with `React.act is not a function`.
