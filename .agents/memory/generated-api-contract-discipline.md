---
name: Generated API contract discipline
description: A durable workflow rule for OpenAPI-generated hooks and server response validation.
---

After changing the OpenAPI contract, regenerate the client and Zod packages before implementing route handlers. After a rebase or merge that combines generated files, regenerate them again before trusting tests. Then run the server type check and exercise generated response schemas at runtime.

**Why:** Generated response shapes are easy to misremember, and an auto-merged Orval output can typecheck while containing a forward reference to a later `const`, which fails only when the generated module is imported. Regeneration restores canonical ordering and catches contract mismatches at the API boundary.

**How to apply:** Treat `lib/api-spec/openapi.yaml` as the source of truth, use generated schemas in handlers, and verify the live endpoint after codegen. After merges, run the codegen command before module-import tests; typechecking alone does not catch declaration-order runtime errors. If codegen fails, it cleans the generated folders first; fix the contract and regenerate before running workspace type checks or relying on the dev preview. When a path operation and its query schema generate the same Zod export name, keep the API schema as-is and add an explicit API export plus a query-type alias in `lib/api-zod/src/index.ts`.