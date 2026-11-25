---
name: CAD failover notice is site-owner-only
description: The CAD backup-storage status endpoint must stay creator-only; ordinary users and Wolverines coordinators must never learn that failover happened.
---

`GET /api/storage/cad-status` is gated by `requireSiteOwner`, and the CAD workspace only renders its `cad-storage-failover` notice from that endpoint. Do not widen it back to `requireWolverinesCoordinator` or any coordinator role.

**Why:** The creator does not want failover to be user-visible behavior — ordinary users (including the creator team's coordinators) should not know uploads fell over to secondary storage. The old gate allowed any admin-role account in the default Wolverines team, which was too broad. The public briefing also dropped its "honest notice" wording so it no longer promises a user-visible indicator.

**How to apply:** When changing storage status or its UI, keep the server gate on `requireSiteOwner` and keep the notice client-side conditional on a successful status fetch. Tests: `cadStorageStatusAuthorization.test.mjs` (site owner allowed, coordinators denied) and `CadWorkspacePage.test.tsx` (notice only when status data is present).
