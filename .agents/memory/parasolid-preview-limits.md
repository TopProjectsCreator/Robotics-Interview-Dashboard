---
name: Parasolid preview limits
description: Local conversion constraints and privacy fallback for chat CAD previews
---

Use the bundled local Rust `cadconvert` path for X_T chat previews above 50 MiB, with sag 0.01, angle 8, Coons approximation disabled, and a complete-face summary gate. Keep the local Python worker for smaller X_T files and X_B. Never send attachment contents to an external converter without the user's approval.

**Why:** Whole-model OCCT conversion of the 173 MB Onshape X_T sample exceeded 14 minutes and about 4.6 GiB RSS. The local Rust converter completes it at the stated strict settings in about 216 seconds: 41,589/41,589 faces and 10,215,626 triangles, producing a 212.79 MB GLB. The failed faces were traced to treating endpoints within 10× tolerance as degenerate; one tolerance (or shared vertex identity) preserves geometric orientation. Replit's screenshot browser lacked a WebGL context, while local Chromium with SwiftShader rendered the full GLB.

**How to apply:** Keep large conversions serialized, stream the generated GLB, reject any result whose final meshed-face count is incomplete, and retain the authenticated original-file download path. The 212.79 MB result is a heavy browser asset; preserve the error/download fallback and verify rendering on supported browsers. A screenshot browser without WebGL is not a valid signal of model compatibility. Do not lower precision or accept partial faces to make a conversion appear successful.