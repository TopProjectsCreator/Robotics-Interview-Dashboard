---
name: Scoped package installs
description: Workspace package installation behavior for artifact-specific dependencies
---

Artifact dependencies must be installed against the owning workspace package, not the monorepo root. The generic package-install helper may attempt a root-level `pnpm add` and fail with the workspace-root safety check.

**Why:** A root install can fail before changing the intended artifact, while a filtered install updates the correct package manifest and lockfile.

**How to apply:** For a dependency used by one artifact, use the package manager's workspace filter for that artifact and then run its typecheck/build checks.