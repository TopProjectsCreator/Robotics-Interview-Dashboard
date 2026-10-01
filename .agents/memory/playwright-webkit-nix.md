---
name: Playwright WebKit on Nix
description: Diagnose and launch Playwright's Safari engine when its Linux bundle cannot see Nix libraries.
---

Playwright's Linux WebKit bundle may fail host validation or report missing shared libraries in this Nix environment even after the dependencies are present. Its bundled WPE launcher replaces `LD_LIBRARY_PATH` with only its private library directories.

**Why:** The browser bundle targets Ubuntu library names while Nix packages live in separate store paths; the built-in launcher can hide those paths from the browser process.

**How to apply:** For local WebKit runs, use a direct MiniBrowser wrapper that exports the required Nix library directories and WebKit bundle variables before starting the bundled binary. Keep this workaround outside the app source; the browser test supports a custom WebKit executable path.