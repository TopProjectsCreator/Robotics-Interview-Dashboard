---
name: Dummy half-edge FIN geometry
description: Handling source edges whose geometry exists only on a non-dummy half-edge
---

When an edge has no explicit 3D curve, its half-edges may include a dummy twin with no curve before the valid FIN. Find a non-dummy FIN that resolves to a supported trimmed surface-parametric curve instead of assuming the first twin carries geometry.

**Why:** A valid X_T model placed a dummy half-edge first and its trimmed surface-parametric FIN second; position-based selection incorrectly rejected the edge.

**How to apply:** Search the edge's half-edges in source order, skip dummy or curve-less entries, and retain strict trim-endpoint and tolerance validation. Fail explicitly if no supported FIN exists.