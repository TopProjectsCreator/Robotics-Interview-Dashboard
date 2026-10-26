---
name: Persisted CAD previews
description: A finished CAD preview is stored under a path-derived id so it can be found again after the instance restarts.
---

The progressive CAD preview used to live only in the process's temp directory, behind an in-memory job map. Both died with the instance, so a ten-minute conversion was lost whenever the free instance restarted, and the browser showed an error for work that had already succeeded.

The preview is now written to object storage under `previews/<previewId>/`, where `previewId` is derived deterministically from the object path and source format (`sha1(objectPath:sourceFormat)`). The overview and tile endpoints read the manifest back from storage when the in-memory job is gone.

**Why:** The id has to be reproducible: a random id would make a persisted preview unfindable after a restart, because nothing would know which id the original upload produced.

**How to apply:** Keep the id derived from the stored file's identity, not generated randomly. Persist the manifest (`overviewBytes`, `detailBytes`, `triangles`, `tiles`) alongside the geometry, and look up stored previews on both the primary and secondary storage instances, because an upload may have been served by either.
