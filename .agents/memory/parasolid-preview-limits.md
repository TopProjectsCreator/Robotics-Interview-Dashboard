---
name: Parasolid preview limits
description: Local conversion constraints and privacy fallback for chat CAD previews
---

Use the bundled local Rust progressive converter for X_T chat previews above 50 MiB: emit a coarse overview and exact per-geometry tiles at 0.01 mm sag and 8° angle, with Coons approximation disabled and a complete-face gate. Load tiles only when visible at close zoom and dispose them when no longer needed. Keep the local Python worker for smaller X_T files and X_B. Preserve admin-authenticated, no-store preview routes and the authenticated original-file download. Never send attachment contents to an external converter without approval.

If coarse tessellation reports failed faces, replace each affected body's overview mesh with its complete fine mesh; fail closed if a failed body or material cannot be matched. Count triangles stored in each geometry once, not once per repeated scene instance, and verify the sum against the exact conversion report.

**Why:** Whole-model OCCT conversion of the 173 MB Onshape X_T sample exceeded 14 minutes and about 4.6 GiB RSS. The Rust conversion at strict settings produces 41,589/41,589 faces and 10,215,626 triangles; one monolithic GLB was 212.79 MB and too costly to load reliably in a browser. Failed faces were traced to treating endpoints within 10× tolerance as degenerate; one tolerance (or shared vertex identity) preserves geometric orientation. Replit's screenshot browser lacked a WebGL context, while local Chromium with SwiftShader rendered the full GLB.

The coarse tessellator can fail on boundary geometry even when the strict pass is complete. Whole-body exact fallbacks preserve overview coverage while keeping unaffected bodies coarse; GLB scene instances reference stored meshes and must not inflate the manifest's stored-triangle count.

**How to apply:** Keep large conversions serialized, reject any result whose fine-mesh face count is incomplete, and never send the full-detail tile set as one browser download. Preserve the error/download fallback and verify rendering on supported browsers; a screenshot browser without WebGL is not a valid signal of compatibility. Do not lower precision or accept partial faces to make conversion appear successful.