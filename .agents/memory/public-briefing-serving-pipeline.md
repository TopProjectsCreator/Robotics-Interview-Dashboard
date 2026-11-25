---
name: How the public AGENTS.md briefing is served
description: The briefing is a Vite public asset with a lowercase alias and a rendered /agents page; a local dist copy must be synced manually.
---

`artifacts/robotics-interview-dashboard/public/AGENTS.md` is exposed several ways: Vite serves it raw at `/AGENTS.md`; `vite.config.ts` adds a lowercase `/agents.md` alias in dev/preview and copies it into the build; the production API server aliases the same path with `sendFile`. Separately, `/agents` is a real React route (`AgentsMdPage`) that fetches the raw file and renders it with `marked` + DOMPurify, with a TOC and copy/download controls.

**Why:** After editing the briefing, a stale `artifacts/robotics-interview-dashboard/dist/public/AGENTS.md` still held the old text. `dist/` is gitignored but present locally, so preview builds can keep serving outdated content even though the tracked source changed.

**How to apply:** After editing the source briefing, copy it to `dist/public/AGENTS.md` for local/preview verification. Check both files when auditing "what the app exposes". Keep the rendered `/agents` page in mind when quoting line numbers from the raw file.
