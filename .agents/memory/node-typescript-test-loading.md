---
name: Node TypeScript test loading
description: Constraints when API-server tests dynamically import TypeScript with Node's built-in strip-only mode.
---

When tests use `node --experimental-strip-types`, dynamically imported TypeScript must use erasable syntax. Parameter properties such as `constructor(readonly value: number)` are rejected; declare the property and assign it in the constructor instead. Extensionless directory imports also need a resolver fallback to `index.ts`.

**Why:** The API-server test runner relies on Node's built-in type stripping rather than a full TypeScript transpiler, so route imports can fail before tests execute even when the application build handles the syntax.

**How to apply:** Before dynamically importing a route from an `.mjs` test, check that the route uses syntax supported by the type stripper and that the test's resolve hook handles both sibling `.ts` modules and directory barrels.
