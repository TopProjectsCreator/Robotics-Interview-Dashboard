---
name: Object path instance pinning on migration
description: A `/objects/secondary/` path prefix pins a read to secondary storage, so moving files to primary must rewrite those markers too.
---

Copying storage objects is not enough: the stored path itself names the instance, and a pinned path is never probed anywhere else.

**Why:** `objectStorage.ts` resolves a path with `objectStorageInstance()` — `/objects/secondary/` ⇒ `[pinned]` only, while a bare `/objects/...` path is probed across instances in order. `chunkedUploads.ts` does the same with `/objects/chunk/secondary/<uploadId>`. So a secondary→primary migration that copies bytes and rows but leaves those prefixes would make every migrated attachment, profile photo, and CAD upload 404 against the new primary, with no error at copy time.

**How to apply:** For a secondary→primary move, plan four steps together: `pg_dump`/restore the database, copy the `app-uploads` bucket objects, rewrite `object_path` values starting with `/objects/secondary/` to `/objects/` (and the `/objects/chunk/secondary/` manifests) after the copy lands, then verify by fetching a migrated file through the app rather than only checking row counts. Keep secondary storage readable until that verification passes, since unpinned legacy paths still probe both instances.

- [Object path instance pinning on migration](object-path-instance-pinning.md) — /objects/secondary/ prefixes pin reads; rewrite them when moving files to primary.
