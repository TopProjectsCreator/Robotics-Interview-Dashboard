---
name: OBJ and PLY inline rendering
description: three.js ships both loaders; their inputs are untrusted, so declared sizes must be checked before parsing.
---

OBJ and PLY are plain triangle meshes with no CAD kernel involved, and `three/examples/jsm/loaders/OBJLoader.js` and `PLYLoader.js` already ship with three. Do not add a conversion toolchain for them. Both are handled by `CadMeshViewer` through the shared scaffolding in `threePreviewSession.ts`.

The loaders trust the file, which is the whole reason for the pre-parse checks in `meshHeader.ts`:

- `PLYLoader`'s binary path loops `element face N` times with no bounds checking beyond a `DataView` throw. A header declaring millions of faces spins the tab instead of erroring, so parse the ASCII header (the header is ASCII even for binary bodies) and reject on the declared counts before handing over the bytes.
- `OBJLoader` reads the text, so it cannot hang, but OBJ permits n-gons. Bound **corner count**, not face count: an n-gon fan yields `corners - 2` triangles, so capping corners bounds triangles without trusting the topology. Scan the whole file — truncating the scan would undercount a large file and silently never trip the budget.
- Cap these at the mesh budget (100 MiB, 3M triangles), not the more generous B-Rep budget. Photogrammetry PLY and verbose OBJ are both routinely huge.

Two deliberate omissions:

- **No MTL loader.** OBJ's `mtllib` can name a remote file; loading it would let a chat attachment trigger a fetch nobody asked for. Faces are shaded with the house material instead.
- **No PLY colour passthrough beyond vertex colours.** `PLYLoader` may return a geometry that was converted with `toNonIndexed()`, so check `getAttribute("color")` on the returned geometry rather than assuming the file's properties survived.

**Why:** Both formats have no widely-registered media type, so browsers send `application/octet-stream` or `text/plain`. The extension has to be authoritative, and a content-type fallback like `text/plain -> obj` would misclassify ordinary text files.

**How to apply:** `PLYLoader.parse` needs a standalone `ArrayBuffer`, not a view — copy into one. Remember that `OBJLoader` emits non-indexed geometry, so an n-gon already arrives triangulated; asserting on vertex count rather than index count avoids a confusing test failure.