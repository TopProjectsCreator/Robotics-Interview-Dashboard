---
name: 3MF inline rendering
description: 3MF is a ZIP of XML mesh data, so it needs no CAD kernel; the transform encoding is the easy thing to get wrong.
---

3MF is a ZIP archive whose `3D/3dmodel.model` part holds plain triangles, so it renders in the browser by unzipping and parsing XML. There is no OpenCascade step, unlike STEP/IGES/BREP. Use `fflate` (already a direct dependency) rather than adding a CAD toolchain. Only inflate the geometry part: entry names live uncompressed in ZIP headers, so scanning the raw bytes for `3dmodel.model` is a cheap validity check, and inflating colour textures would be wasted work on large prints.

A 3MF `transform` attribute is **12 values: row-major 3x3 rotation followed by a translation**. Packing those twelve straight into a column-major 4x4 puts the translation at indices 9-11 instead of 12-14, and every build item then lands at the origin with no error. Reorder explicitly: rotation into columns 0-2, translation into column 3.

`units` are per file (micron/millimeter/centimeter/inch/foot/meter) and default to millimetre. Scale to millimetres so the model frames the same as the other viewers. `<build>` items select what is actually printed and each carries its own transform; `type="model"` objects nest through `<components>`, so recurse with the transform matrix composed depth-first. Cap recursion depth and instance count — component graphs can reference their own ancestors.

**Why:** The transform layout error is silent: the file parses, the viewer renders, and geometry simply appears at the wrong place, which reads as a broken model rather than a bad matrix.

**How to apply:** Test with an assembly that nests a component transform inside another, and with a rotation (not just a translation) — a pure-translation fixture passes even with the wrong matrix layout. Keep the malformed-transform fallback to identity so one bad item does not void the whole file.