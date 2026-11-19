---
name: Playwright WebKit on Nix
description: Diagnose and launch Playwright's Safari engine when its Linux bundle cannot see Nix libraries.
---

Playwright's Linux WebKit bundle may fail host validation or report missing shared libraries in this Nix environment even after the dependencies are present. Its bundled WPE launcher replaces `LD_LIBRARY_PATH` with only its private library directories, and WPE headless can fail with `Could not create EGL display`.

**Why:** The browser bundle targets Ubuntu library names while Nix packages live in separate store paths. The headless WPE backend may lack a usable EGL platform here, while the GTK bundle can load incompatible system HarfBuzz or libpng versions unless matching Nix libraries are prioritized.

**How to apply:** For local WebKit runs, try a direct wrapper around the bundled GTK `MiniBrowser` on the available X display, removing Playwright's `--headless` argument. Set `WEBKIT_EXEC_PATH`, `WEBKIT_INJECTED_BUNDLE_PATH`, `WEBKIT_INSPECTOR_RESOURCES_PATH`, and `WEBKIT_FORCE_COMPLEX_TEXT`; prioritize compatible Nix directories for HarfBuzz, HarfBuzz ICU, GBM, and libpng in `LD_LIBRARY_PATH`. Smoke-test one page before the full cross-browser suite. Keep the wrapper outside app source; the browser test accepts a custom WebKit executable path.