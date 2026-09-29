# Vendored CAD converter

This source is vendored from <https://github.com/omerbasavul/cadconvert> at
commit `73b37836a55f905ea0f392cf676dff160c745287`. It is licensed under
Apache-2.0; see `LICENSE`.

The local change in `crates/cad-tess/src/edge.rs` narrows short-edge
degeneracy detection to the source tolerance (or identical topological
vertices), so valid short edges still use their endpoint geometry for
orientation. A regression test covers a reversed 0.0765 mm edge at 0.01 mm
tolerance. The malformed-input test's deterministic byte pattern also uses
explicit wrapping arithmetic so the Rust test suite passes in debug builds.

The converter is compiled and run locally by the API server. Uploaded model
bytes are not sent to a conversion service.