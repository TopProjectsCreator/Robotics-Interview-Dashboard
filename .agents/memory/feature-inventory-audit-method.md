---
name: Build feature inventories from code, not from product briefings
description: When asked to enumerate every shipped feature, split the audit by subsystem and verify against router, OpenAPI, components, routes, and commits; ignore AGENTS.md.
---

The reliable way to catalogue this repo's features is a parallel four-part code audit: (1) chat/collaboration via dashboard `src/App.tsx`, chat components and `lib/*`, plus `routes/robotics.ts`; (2) parts/CAD/code via the three workspace pages, their dialogs/viewers, and `routes/parts.ts`, `cad.ts`, `code.ts`, `storage.ts`; (3) assistant/custom workspaces via model/provider/governance/skill/MCP components, builder pages, and assistant tool/policy libs; (4) settings/public surfaces via `SettingsWorkspaceNavigation`, public pages, `routes/auth.ts`, `system.ts`, `presence.ts`, `broadcasts.ts`, `tinyUrls.ts`, `ftcEvents.ts`, `sitemap.ts`, plus `git log` since the last briefing edit.

**Why:** The user stated the public `AGENTS.md` is outdated and must not be used as a source, and rejected a first doc pass built from it as "not enough features". Code-level auditing surfaced hundreds of distinct user-visible behaviors the briefing omitted, plus false claims that had to be excluded.

**How to apply:** Ask for file:line evidence for each claimed feature; check negative claims separately (absence of a search endpoint, diff/restore, etc.). Exclude the legacy hiring/recruiting workflow entirely when the user asks for it to be dropped, including negated mentions, legacy chart axes, notification titles, and package/file paths. Keep the resulting docs consistent: `README.md` exhaustive product catalog, `replit.md` ops runbook plus a complete feature checklist.
