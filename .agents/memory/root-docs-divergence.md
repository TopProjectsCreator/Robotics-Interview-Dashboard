---
name: Root README.md and replit.md were reconciled around the public briefing
description: README.md is the product overview and replit.md the ops runbook; both now share one feature inventory and exclude the legacy workflow entirely.
---

The repo root has two overlapping project docs. As of the Nov 2026 doc refresh, `README.md` (restored after deletion) is the exhaustive product catalog and `replit.md` is the operational runbook (commands, env vars, CAD worker, gotchas) plus a complete feature checklist. Both were rebuilt from code-level audits of the router, OpenAPI paths, pages/components, API routes, and commit history. The public briefing was explicitly excluded as a source because it is outdated. Neither doc is authoritative for shipped features — code is.

**Why:** The old README still described the legacy workflow and called the app "no longer" for it, while replit.md was a shorter duplicate that omitted many shipped features. The refresh was explicitly asked to drop that workflow as a feature and enumerate everything else. Even a negated mention ("no longer for interviews") and file/package paths containing the old name read as feature mentions in docs, so both were removed.

**How to apply:** For doc refreshes, update both files together from the same inventory; keep replit.md operational and README.md descriptive. When de-scoping a legacy workflow, strip it from prose, headings, AND dependency/file paths, and avoid saying "we no longer do X" — just describe what ships. Update this memory rather than adding a duplicate when either doc changes scope again.
