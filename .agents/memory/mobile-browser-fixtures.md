---
name: Mobile browser fixtures
description: Styling requirements for standalone browser-test pages that mount dashboard components.
---

Component-level browser fixtures should import the dashboard's shared stylesheet instead of relying on unstyled component markup.

**Why:** Without the actual layout and responsive styles, mobile browser hit testing can report neighboring elements intercepting taps, so the test does not represent the product UI.

**How to apply:** When a Playwright fixture mounts dashboard components directly, load the shared app stylesheet before asserting touch behavior, responsive geometry, or pointer interactions.
