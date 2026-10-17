---
name: Robotics logo mark
description: Project requirement for the consistent Robotics logo SVG and its presentation.
---

Use the exact favicon served by the production robotics-interview-dashboard `/auth` page as the Robotics logo everywhere.

**Why:** the user explicitly asked to use the live favicon itself because hand-built lookalikes did not match.

**How to apply:** keep a local copy of the fetched favicon in each artifact's public assets and render it as an image; do not redraw its shapes or substitute a Lucide/CircleDot icon.
