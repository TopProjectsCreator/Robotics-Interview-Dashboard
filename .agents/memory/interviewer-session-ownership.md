---
name: Interviewer session ownership
description: Security boundary for interviewer identity across the robotics dashboard
---

The authenticated interviewer identity must come from the signed server session. Client-selected interviewer labels and localStorage values may be display hints at most; they must not authorize queue views, chat authorship, direct-chat scope, reactions, or chart ownership.

**Why:** The dashboard is embedded and shared by multiple interviewers. A browser-controlled identity selector would let one interviewer impersonate another or access another person's private charts.

**How to apply:** Keep the cookie plus bearer-token session fallback, validate the signed interviewer ID server-side, and assign/filter ownership in API routes. Treat legacy queue labels without password hashes as setup-required accounts gated by the event passcode.

The authentication UI is intentionally staged: event passcode first, then choose an existing interviewer or add one, then enter or create the personal password. Do not collapse these into one form.

**Why:** The event passcode gates access to the interviewer roster and separates shared event access from each interviewer's private credential.

**How to apply:** Preserve the separate screens and carry the event passcode through the final login, setup, or account-creation request; the server must validate it again.