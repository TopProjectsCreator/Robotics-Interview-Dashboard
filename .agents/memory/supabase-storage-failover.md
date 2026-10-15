---
name: Supabase storage failover
description: CAD uploads need to use secondary Supabase Storage when primary signing or upload operations fail.
---

For CAD uploads, try the team's primary Supabase Storage first and fall back to the configured secondary when primary storage is unavailable. Preserve which instance received the file so previews, downloads, and deletes use the same bucket.

**Why:** the user reported primary storage quota suspension and requested secondary uploads as a fallback.

**How to apply:** Keep object storage routing separate from database ownership; do not inspect or expose secret values while verifying the two configured instances.
