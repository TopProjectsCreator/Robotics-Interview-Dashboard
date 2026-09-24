---
name: Generated API contract discipline
description: A durable workflow rule for OpenAPI-generated hooks and server response validation.
---

After changing the OpenAPI contract, regenerate the client and Zod packages before implementing route handlers. Then run the server type check and exercise at least one live response through the generated response schema.

**Why:** The generated response shapes are stricter than the route names and easy to misremember; catching a mismatch at the API boundary prevents a frontend that renders a different data model than the server actually returns.

**How to apply:** Treat `lib/api-spec/openapi.yaml` as the source of truth, use generated schemas in handlers, and verify the live endpoint after codegen. If codegen fails, it cleans the generated folders first; fix the contract and regenerate before running workspace type checks or relying on the dev preview. When a path operation and its query schema generate the same Zod export name, keep the API schema as-is and add an explicit API export plus a query-type alias in `lib/api-zod/src/index.ts`.