---
name: Site-owner gate means the app creator, not a team coordinator
description: Use requireSiteOwner for creator-only features; team coordinators, including Wolverines ones, are a different and broader class.
---

`requireSiteOwner` in `artifacts/api-server/src/middlewares/adminAuth.ts` is the gate for app-creator-only features. It checks the signed-in account's `isSiteOwner` flag after `requireAdmin`; it is not satisfied by being a coordinator of the default/Wolverines team. The `isSiteOwner()` helper does the same lookup for non-middleware checks. Existing uses: cross-team feature-request inbox, site stats, and (since Nov 2026) the CAD storage failover status route.

**Why:** A creator-only notice was originally gated by `requireWolverinesCoordinator`, which admitted every admin-role account in the default team. That leaked operator information to users who should never see it. The gate was tightened to `requireSiteOwner` and the broader helper was removed as dead code.

**How to apply:** When a feature must be visible only to the app creator, use `requireSiteOwner` and assert in tests that a non-owner coordinator gets 403 "Site owner only". Do not reintroduce team-based gates for operator-only data.
