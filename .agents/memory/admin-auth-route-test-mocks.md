---
name: adminAuth middleware mocks must track route imports
description: Node route tests stub adminAuth named exports; changing a gate used by storage.ts requires updating every stub or route registration breaks.
---

Several API node tests stub `../middlewares/adminAuth` with an explicit `namedExports` map — notably `chatUploadTypes.test.mjs`, `cadRoutes.test.mjs` and `storageRouteObjectCache.test.mjs` under `artifacts/api-server/src/lib/`. When a route starts importing a different gate from that module, every stub must gain the new export.

**Why:** Replacing `requireWolverinesCoordinator` with `requireSiteOwner` on `/api/storage/cad-status` would have left the stubs returning `undefined` middleware for that route; the old key was harmless dead weight. Updating all three stubs together kept 28 targeted tests passing.

**How to apply:** Grep `requireSiteOwner|requireWolverinesCoordinator|middlewares/adminAuth` under `src/lib/*.test.mjs` before changing a middleware import in `routes/storage.ts` or other route modules, then run the targeted node tests with `--experimental-transform-types --experimental-test-module-mocks`.
