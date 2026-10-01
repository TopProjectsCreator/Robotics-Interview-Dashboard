---
name: Fragment navigation focus
description: Keep keyboard focus useful when compact navigation closes after an in-page link.
---

For compact-menu links that navigate to page fragments, make the destination heading focusable with `tabindex="-1"` and let native fragment navigation move focus there. Do not rely on a timed script focus change back to the menu button.

**Why:** Firefox can finish fragment handling after a delayed focus callback and leave focus on `body` when the target is not focusable. A focusable heading produced consistent, visible destination focus in Chromium, Firefox, and WebKit.

**How to apply:** When an in-page link closes a disclosure menu, test both the final hash and `document.activeElement` in each supported engine. Keep Escape behavior separate: Escape should still return focus to the menu button.