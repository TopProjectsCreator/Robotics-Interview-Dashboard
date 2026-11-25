---
name: Public AGENTS.md briefing drifts from shipped code
description: The public product briefing at artifacts/robotics-interview-dashboard/public/AGENTS.md must be audited against code, not trusted as source of truth.
---

The public briefing `artifacts/robotics-interview-dashboard/public/AGENTS.md` (served at `/AGENTS.md`, rendered at `/agents`) is a marketing/product snapshot, not a verified contract. Treat concrete numbers, UI strings, vendor names, route lists and "feature exists" claims as claims to check in code before repeating them to a user.

**Why:** Auditing it in Nov 2026 found it 4+ days and 50+ commits behind the app while still claiming "every route this app serves." Concrete drift included "14 suppliers" vs 15, "~100 permissions" vs 52, "per-channel slow mode" vs a team-wide setting, per-file upload cancel that does not exist, a quoted builder progress string that does not exist, demo teammate names from an unrouted dead page, and a "1–12 tabs" contract that is really 2–12. A tracked `dist/public/AGENTS.md` copy can also hold stale copies of the same text, so check both.

**How to apply:** When asked to refresh it, split the audit by section (routes, chat, AI, parts/CAD/code, marketing/legal, settings/security) and verify each falsifiable claim with file:line evidence. `git log 21128b67..HEAD --oneline` is a fast way to spot features added since the last briefing edit; compare commit messages against what the doc actually documents — some commits claim to document features that the diff never added. Keep user-requested scope boundaries (e.g. omit interview-era features) explicit, and keep the file short when asked.
