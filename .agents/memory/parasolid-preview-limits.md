---
name: Parasolid preview limits
description: Local conversion constraints and privacy fallback for chat CAD previews
---

Use the local `parasolid-kit` converter for Parasolid chat previews; do not send attachment contents to an external conversion service without the user's approval. Parsing and preview conversion have separate limits: a complete, topology-valid parse does not guarantee that OCCT can build a preview within the app's memory or request budget.

**Why:** The 173 MB Onshape X_T sample compact-parses as complete and topology-valid, but whole-model OCCT conversion exceeded 14 minutes and about 4.6 GiB RSS without producing a GLB. The library exposes no bounded body-by-body conversion or preview-merge API; setting `require_complete=False` or `allow_partial=True` does not make conversion incremental and risks exhausting the app's memory.

**How to apply:** Keep local preview input limits conservative, fail before starting conversions known to exceed them, and retain the authenticated original-file download path. Do not treat a valid parse, larger byte/time limits, or partial-preview flags as proof that a large file can render. A different converter or higher-memory service needs separate evaluation and user approval before attachment data leaves the local app.