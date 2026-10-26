---
name: Sitemap page scope
description: The sitemap lists frontend pages only; API endpoints belong in the OpenAPI spec and must not be re-added.
---

`GET /sitemap.xml` (and its `/api/sitemap.xml` alias) lists only the frontend pages in `FRONTEND_PATHS` in `artifacts/api-server/src/routes/sitemap.ts`. API endpoints are deliberately not listed: a crawler cannot render them, and the machine-readable contract for them is `lib/api-spec/openapi.yaml`.

The router-stack introspection that used to enumerate live `/api` routes (and its `FALLBACK_API_ROUTES` list plus the `setApiRouter` hook in `routes/index.ts`) has been removed. Do not reintroduce it.

`artifacts/robotics-interview-dashboard/public/sitemap.xml` is a checked-in snapshot of the same page list (base `http://localhost`) that the Vite dev server serves; the API server's dynamic handler takes precedence in production. Keep the two in sync — `artifacts/api-server/src/lib/sitemapRoutes.test.mjs` fails when they drift.

**Why:** The user asked for the API endpoints to leave the sitemap; listing them only invites crawlers to fetch JSON nobody can index.

**How to apply:** Add a page by adding it to the `<Switch>` in `artifacts/robotics-interview-dashboard/src/App.tsx` and to `FRONTEND_PATHS`, then refresh `public/sitemap.xml`. Parameterised paths are written with a harmless `example` segment so every `<loc>` is a valid absolute URL.
