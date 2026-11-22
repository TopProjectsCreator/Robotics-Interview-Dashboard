---
name: Local OpenCode v2 plugin shape and loading
description: Local plugins in .opencode/plugins/ auto-load; export a plain object with a type-only @opencode/plugin import to stay dependency-free.
---

A local OpenCode v2 plugin is a file (or directory with `index.ts`) under `.opencode/plugins/`; it loads automatically without an entry in `opencode.jsonc`. Export a plain default object `{ id, setup(ctx) }` (or `effect`) and import the SDK as `import type { Plugin } from "@opencode/plugin"`, typing the object as `Plugin.Plugin`. `Plugin.define` is an identity function, so a value import adds a runtime dependency for nothing.

**Why:** The server's module loader validates the default export as a struct with `id` plus a `setup`/`effect` function, not as an instance of an SDK class. An existing local plugin (`.opencode/plugins/test-mode.ts`) already uses this pattern. A type-only import is erased, so the file loads even though `@opencode/plugin` is not installed in the workspace; a value import would make the loader resolve it at runtime.

**How to apply:** When adding a plugin, write `setup(ctx)`, register hooks with `await ctx.<domain>.hook(...)`, return a cleanup that disposes registrations, and confirm loading by grepping `~/.local/share/opencode/log/opencode.log` for `loading plugin` with the plugin's path. No restart is needed; the loader watches the plugin file and reloads on save.
