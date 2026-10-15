---
name: Trackpad panning in 3D viewers
description: OrbitControls discards wheel deltaX, so two-finger trackpad pan needs an explicit handler registered before it.
---

The inline CAD viewers (STEP/IGES/BREP, STL, 3MF, progressive Parasolid) use three.js `OrbitControls`. Two-finger panning was not available on a trackpad because a trackpad does not send touch events — two-finger scrolling arrives as a `wheel` event, and `OrbitControls._handleMouseWheel` reads **only `deltaY`** and dollies, discarding `deltaX`. Touchscreen two-finger pan was already bound by default (`touches.TWO = TOUCH.DOLLY_PAN`) but was swallowed by page scrolling because no canvas set `touch-action: none`.

`src/lib/trackpadPan.ts` handles it. Three ordering constraints are load-bearing:

- Register the handler **before** constructing `OrbitControls`. Listeners on one element fire in registration order, and `stopImmediatePropagation()` is what stops OrbitControls from *also* zooming a gesture already consumed as a pan.
- Set `touch-action: none` on the canvas, or the browser claims two-finger gestures for page scroll and the controls never receive them.
- Set `screenSpacePanning = true` for CAD. The default pans in the ground plane, which is disorienting for a part floating in space; the progressive viewer already did this.

The gesture rule: a pinch arrives as `ctrlKey` + `wheel` and must keep zooming, so only a `deltaX`-dominated gesture pans; plain vertical scroll still zooms. Panning moves the camera and the orbit target together using three's own maths, so it feels identical to a right-drag and preserves the camera-to-target distance.

GLB deliberately stays on `<model-viewer>`, which sets `touch-action: none` and handles pan itself. Do not layer a wheel handler over it.

**Why:** The gap is invisible in code review because panning "works" via right-drag and touch; only trackpad users hit it, and the symptom is two-finger zoom instead of pan.

**How to apply:** Keep the decision as a pure `trackpadWheelAction` function so the rule is unit-testable without a canvas, and cover the rotated-camera case so a future refactor cannot silently switch back to world-axis panning.