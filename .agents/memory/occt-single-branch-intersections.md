---
name: OCCT single-branch intersections
description: Preserve source-point projection when handling a single analytic surface-intersection branch
---

For a single analytic OCCT intersection branch, preserve the curve's native parameter domain. Let the consuming edge project its own trim endpoints and determine direction. If the analytic result misses source samples, try the source-aware fitter at the original body precision with the source anchors.

For source-aware fits, exclude unsupported chart samples only from contiguous ends of an open branch when they miss exactly one nonclosed, nonperiodic bounded B-spline at its parameter boundary, all other supports and two distinct trim anchors satisfy body precision, and at least two supported chart samples remain. For an untrimmed intersection curve used by exactly one topological edge, use that edge's endpoint vertices as anchors; if a two-point chart maps both anchors to the same sample, fit from the validated anchors and exclude only the other chart sample. If direct projection of an anchor misses body precision, accept it only when one chart sample projects within precision to every support and the anchor lies within precision of each resulting surface point. Interior misses, unsupported anchors, ambiguous multi-edge anchor inference, and closed branches remain hard failures; never widen tolerances.

**Why:** Reversing a periodic trimmed intersection can shift its parameter domain away from the source arc. OCCT can also return near-parallel analytic branches slightly off valid source samples, and surface projection can miss a nearby vertex even when a chart sample provides an exact support witness. Source charts may include continuation points beyond a finite NURBS patch; very short direct edges can also have only one useful chart location while their other sample lies outside the patch. Exact topological vertices and conservative distance bounds preserve the finite edge without accepting unsupported geometry.

**How to apply:** Keep direction changes limited to multi-branch composition, where ordering pieces is required. For one branch, preserve native parameters. Derive anchors only from an explicit trim or a unique direct-edge association. Any fit fallback must retain strict support and precision checks; clip only the bounded-support endpoint or two-point collapsed-chart cases above.

Treat type-204 4D UV chart values as discrete paired anchors, not a complete between-anchor p-curve. Sparse spans can interpolate far off the supports even when their endpoints are exact. A candidate midpoint is acceptable only when its distance to each support independently meets the original body precision; disconnected exact branches must not be bridged without source-supported continuation.

**Why:** A sparse source interval can lack any interior intersection sample, and independently interpolating its 4D chart coordinates can depart from both support surfaces. Lowering or loosening the kernel's intersection tolerance does not supply missing branch information.

**How to apply:** Inspect the type-204 node semantics, then validate candidate curves densely against both supports and the source anchors. If the original precision cannot be met, keep conversion as a hard failure and request a better source export.