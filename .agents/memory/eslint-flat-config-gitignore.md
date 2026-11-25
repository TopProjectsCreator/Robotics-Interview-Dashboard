---
name: ESLint flat config does not honor .gitignore
description: Add gitignored local directories (e.g. .dev-secrets/) to eslint.config.mjs ignores or pnpm run lint fails on vendored code.
---

ESLint's flat config (`eslint.config.mjs`) does NOT automatically skip paths listed in `.gitignore`. Any gitignored directory that is present locally and contains source-ish files will be linted by `pnpm run lint` (which runs `eslint .`).

**Why:** `.dev-secrets/` is gitignored (credentials restored by `start-servers.sh`) and holds `cli-creds/dashjs/00f700dcc596.js`, a vendored minified dash.js bundle. Lint reported dozens of false `no-undef`/`no-func-assign`/`no-unused-expressions` errors from it, making `pnpm run lint` fail even though every real source file was clean. `npx eslint . --ignore-pattern '.dev-secrets/**'` produced zero errors, confirming the cause.

**How to apply:** Add `**/.dev-secrets/**` to the `ignores` array at the top of `eslint.config.mjs` alongside `**/node_modules/**`, `**/dist/**`, etc. When lint fails, check which file paths actually appear in the report before treating errors as real — vendored bundles are a common false-positive source.
