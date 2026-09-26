---
name: Parasolid preview limits
description: Local conversion constraints and privacy fallback for chat CAD previews
---

Use the local `parasolid-kit` converter for Parasolid chat previews; do not send attachment contents to an external conversion service. Its parser supports documented Parasolid schema and geometry subsets, not every `.x_t` or `.x_b` export.

**Why:** No representative user model was available for an end-to-end conversion check, and the converter's supported profiles are intentionally limited. Private downloads must remain available when parsing or conversion fails.

**How to apply:** Keep conversion failures explicit and retain the authenticated original-file download path. Validate new format-coverage claims against actual `.x_t` and `.x_b` files before describing support as universal.