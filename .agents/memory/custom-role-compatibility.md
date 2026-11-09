---
name: Custom role compatibility
description: Keep custom permissions separate from the existing account role.
---

Persist a custom-role assignment in a separate nullable field scoped to the account's team. Keep the legacy account role unchanged so setup, invitations, and feature-level ownership checks continue to read their existing role values. Resolve custom permissions from the matching team role; missing or unknown assignments grant nothing.

**Why:** Replacing legacy role values would change assumptions throughout authentication and resource ownership checks, while reusing those values could grant Admin behavior.

**How to apply:** When changing role assignment or authorization, resolve the custom role by both its ID and the account's team. Keep account/role administration and platform-owner authority outside the delegable permission catalog.
