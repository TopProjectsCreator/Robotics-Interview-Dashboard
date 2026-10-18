---
name: Vitest source-file reads
description: Reading source CSS or other fixtures from Vitest tests in the Vite app.
---

**Rule:** In Vitest tests, use a package-root-relative path to read source fixtures when Vite transforms `import.meta.url` into a non-file URL.

**Why:** `readFileSync(new URL(..., import.meta.url))` can fail because the transformed URL does not use the `file:` scheme, while the Vitest process runs with the app package as its working directory.

**How to apply:** For tests that inspect source CSS or other files, resolve them from the app package working directory and run the test through the artifact's package filter. Import Node's file-system module as `fs` rather than `node:fs`; the latter is externalized by this runner and fails to resolve in Vitest.