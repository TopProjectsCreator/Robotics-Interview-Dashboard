---
name: Tailwind dev CSS refresh
description: What to check when a React page renders without its expected Tailwind utilities in the Vite preview.
---

If a newly added or replaced React page renders with base styles but lacks expected Tailwind utilities, compare the generated stylesheet and restart the existing Vite workflow once before changing the markup or replacing the styling approach.

**Why:** On 2026-09-29, a rewritten public dashboard initially appeared unstyled in the preview and the dev stylesheet lacked several page-specific selectors. Restarting the Vite workflow restored the expected styling.

**How to apply:** On a similar preview issue, inspect the generated CSS for a few distinctive selectors, restart the existing workflow once, then verify the page visually at desktop and mobile sizes.