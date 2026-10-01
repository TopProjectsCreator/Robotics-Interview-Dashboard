---
name: Node TypeScript test loading
description: Constraints when API-server tests dynamically import TypeScript with Node's built-in strip-only mode.
---

When tests use `node --experimental-strip-types`, dynamically imported TypeScript must use erasable syntax. Parameter properties such as `constructor(readonly value: number)` are rejected; declare the property and assign it in the constructor instead. Extensionless directory imports also need a resolver fallback to `index.ts`. Route-level tests that import a broad router or the full Express app may need `node --experimental-transform-types` because a transitive dependency can use non-erasable TypeScript.

**Why:** The API-server unit runner relies on Node's built-in type stripping rather than a full TypeScript transpiler, so importing a route can load non-erasable syntax from unrelated modules before the test executes, even when the application build handles it.

**How to apply:** Before dynamically importing a route from an `.mjs` test, check the full import graph and ensure the resolver handles sibling `.ts` modules and directory barrels. Use transform-types for route tests when a transitive dependency prevents strip-only loading rather than changing unrelated production TypeScript just to satisfy the test loader.
