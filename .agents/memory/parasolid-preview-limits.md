---
name: Parasolid preview limits
description: Local conversion constraints and privacy fallback for chat CAD previews
---

Use the local `parasolid-kit` converter for Parasolid chat previews; do not send attachment contents to an external conversion service. Its parser supports documented Parasolid schema and geometry subsets, not every `.x_t` or `.x_b` export.

**Why:** A 173 MB Onshape Parasolid 37.1.212 X_T sample failed at `schema.unknown_base_type` because its embedded schema needs confirmed base-type membership. Raising the byte limit alone will not fix this; a matching schema catalog or a different local Parasolid-capable kernel is needed.

**How to apply:** Keep conversion failures explicit and retain the authenticated original-file download path. Validate claims against real `.x_t` and `.x_b` files; do not describe the current parser as universal or treat larger limits as a schema-compatibility fix.