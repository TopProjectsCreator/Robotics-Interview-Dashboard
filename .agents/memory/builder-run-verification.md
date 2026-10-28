---
name: Builder-run verification
description: Avoid false authentication blockers and premature restarts when verifying long custom-workspace reviews.
---

An unsigned screenshot browser is not a blocker to authenticated endpoint tests. With the user's explicit authorization for a disposable account, inspect and use the app's supported setup/login endpoints rather than fabricating a session or bypassing authorization.

**Why:** Browser capture and the user's signed-in session are separate, but the app's normal API authentication flow remains available locally.

**How to apply:** Keep temporary passwords and session tokens out of logs and project files. Preserve an initially reset test account on failure; perform deletion only under the user's stated success condition.

Do not infer that a builder stopped from a test-client timeout. Observe persisted review counts, activity, and heartbeat before restarting the API.

**Why:** Independent reviews and repeated fix verification can legitimately take many minutes. A live server continued making progress after a short-lived test client aborted; restarting interrupted that healthy work.

**How to apply:** Give verification clients enough time for the entire multi-round flow, log activity as it arrives, and resume the same saved draft if a run is interrupted. Do not create duplicate drafts or bypass review counters to obtain a passing result.
