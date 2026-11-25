---
name: Breached passwords require a multi-step override dialog
description: Exposed passwords are allowed only after four risk dialogs and typing an exact acknowledgement phrase; the API honors the existing confirmLowExposure flag.
---

`assessPasswordExposure(count, confirmLowExposure)` previously blocked counts >= 3 unconditionally. It now returns `safe` whenever `confirmLowExposure` is true, for any count. No API schema change was needed — all relevant endpoints already accept `confirmLowExposure`.

**Why:** users legitimately need to reuse a known-breached password in an offline competition environment. On 2026-11-25 the UI gained `acknowledgeExposedPassword(count)`: four sequential `confirmAction` dialogs explaining breach count, credential-stuffing, data exposure and a last-chance cancel — each with a "Choose a different password" exit — followed by `askValue` requiring exact phrase `I UNDERSTAND THIS PASSWORD IS COMPROMISED`. Only then does the client retry with `confirmLowExposure: true`. Wired into all three flows: admin password change, self setup, account creation.

**How to apply:** never let the client send `confirmLowExposure` without completing the whole dialog chain. `PASSWORD_CHECK_UNAVAILABLE` must never be bypassed. Password reset to "no password" is `password_hash = NULL` in `interviewer_accounts` — the app then shows Setup required; verify the team code first by scrypt against `teams.code_hash`.
