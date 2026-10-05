---
name: CAD library storage cleanup
description: Chunked CAD uploads must delete their parts and manifest; a shared-object check must consult every referencing table.
---

Large CAD models bypass the API using the chunked-upload endpoints and are stored as several 40 MB parts plus a `chunked_uploads` manifest row, referenced by `/objects/chunk/<uploadId>`. Deleting such a model must remove the parts *and* the manifest row, otherwise deleting a large assembly quietly leaks every uploaded part. `deleteModelFile` in `src/routes/cad.ts` branches on the object-path shape and is shared by single-model and bot deletion.

Deleting a bot unfiles its models rather than cascading, so the rows that survive still need their files removed. Deleting a folder unfiles its models instead of destroying them, so a folder delete cannot lose work.

`isPrivateObjectReferenced` must check `cad_models` as well as `parts_robots` and chat message bodies. One object path can legitimately be referenced from more than one place — a robot preview promoted into the library, or a chat attachment kept as a model — so consult all three tables before allowing a delete.

**Why:** The generic `/storage/objects` delete route is shared by chat, Parts, and the CAD library, so a path-shape assumption written for one caller silently leaks or misbehaves for another.

**How to apply:** Never hand an unrecognised object path to storage; skip and log it instead, because the wrong key would delete an unrelated file. Only the exact shapes this service minted are deletable.