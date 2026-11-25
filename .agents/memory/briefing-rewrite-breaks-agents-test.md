---
name: AGENTS.md rewrites must update the rendered-page test
description: Rewriting the public briefing breaks agents-md.test.tsx, which hard-codes canonical phrases; update its assertions in the same change.
---

`src/pages/agents-md.test.tsx` asserts that the rendered `/agents` page contains specific hard-coded phrases from `public/AGENTS.md` (e.g. "The server is the referee.", "Cross-team reads return nothing — not filtered, absent.", "How it works, in plain words"). Rewriting the briefing without updating those assertions makes the first test time out and fails the whole frontend suite (1 file / 830 tests).

**Why:** A comprehensive rewrite of `AGENTS.md` (sections restructured, wording changed) left the test asserting removed phrases. The test mocks `fetch` to return the current `AGENTS.md?raw`, so it renders whatever the file now says — but the three literal assertions were never derived from the file and went stale.

**How to apply:** Whenever editing `public/AGENTS.md`, grep `agents-md.test.tsx` for phrases you removed or reworded and update them to equivalent statements present in the new briefing. Keep the assertions meaningful (security/tenancy principles and a real section heading) rather than deleting them. Then run `pnpm --filter @workspace/robotics-interview-dashboard run test`. The separate `dist/public/AGENTS.md` copy also needs a manual sync after source edits.
