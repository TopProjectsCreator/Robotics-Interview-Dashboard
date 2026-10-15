---
name: Workspace visibility settings
description: Per-workspace role access is server-enforced from a settings row; do not reintroduce hardcoded role gates in the sidebar.
---

Which roles can open each workspace is admin-configurable and stored as JSON in the single-row `workspace_settings` table, following the `display_settings` convention. Defaults match pre-existing behaviour: Interview is coordinator-only, Chat and Parts are open to every signed-in role, and CAD starts admin-only.

Two rules keep the client and server agreeing:

- The sidebar, the `/dashboard` chooser cards, and route reachability all derive from one `useWorkspaceVisibility` hook. Do not add role conditionals to `Shell` again; filter `getWorkspaceNavigation(area, visibleWorkspaces)` instead.
- Server routes gate with `requireWorkspaceAccess("cad")`. Co-ordinators and treasurers keep their existing reach regardless of settings, so hiding a workspace can never take away something they already had. Use `requireWorkspaceAccessOrCoordinator` for capabilities that predate the settings and are shared by several workspaces, such as the Parasolid preview endpoint.

Normalise visibility on **both** sides. The server discards unknown workspaces and roles so a hand-edited row cannot escalate access; the client does the same because a partial or `{}` response would otherwise throw inside `Shell` and take the whole app down to the error boundary.

The settings query is opt-in (`enabled: authenticated`). An unauthenticated visitor must not trigger it, because a test asserts that no request other than `/auth/session` is issued before sign-in.

**Why:** Visibility was previously hardcoded in the sidebar, so opening a workspace up to another role needed a redeploy, and the server had no matching check to enforce.

**How to apply:** Add a new workspace by extending `WORKSPACE_KEYS` and the default map in `workspaceVisibility.ts` (pure, unit-testable, no database import), then reading `@workspace/db` lazily from `workspaceAccess.ts`. Keeping the pure rules database-free lets them be tested directly and avoids making every auth path depend on the schema module resolving.