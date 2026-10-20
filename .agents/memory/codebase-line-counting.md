---
name: Codebase line counting
description: Count only hand-written code by diffing against node_modules, dist, generated clients, lock files, and binary assets; the naive recursive count overstates this repo by ~100x.
---

A recursive `find ... -exec cat {} + | wc -l` over this repo returns **~19.6M lines**. The real hand-written code is **~167k lines** (tracked, non-generated, non-binary). The gap is `node_modules` (1.5 GB), tracked `dist/` build output, `artifacts/` binaries (193 MB), `attached_assets/` (186 MB), and a 456 KB `pnpm-lock.yaml`.

**Measured breakdown (git-tracked, 1,803 files, 246,460 lines total):**

| Area | Code lines |
| --- | --- |
| `artifacts/robotics-interview-dashboard/src` (React + TS) | 50,939 |
| `artifacts/api-server` (TypeScript service) | 48,345 |
| `artifacts/api-server/native/cadconvert` (Rust) | 47,340 |
| `artifacts/mockup-sandbox` | 9,089 |
| `artifacts/robotics-chat-tutorial` | 5,844 |
| `lib/*` shared packages (hand-written only) | 3,346 |
| Dashboard tests / HTML / CSS | 2,009 |
| **Code total** | **166,952** |

Non-code that must be excluded: `generated/` codegen (29,041 lines / 352 files, from Orval + openapi), `pnpm-lock.yaml` (12,749) and `uv.lock` (622), `lib/api-spec/openapi.yaml` (7,738, a spec not code), 619 `.p2m` CAD material assets (13,849), plus a 5,129-line `.wasm` and 2,362-line `.sldmat` blobs.

**Counting method that works:**

- Start from `git ls-files` so untracked build output and `node_modules` are already out.
- Filter out `(^|/)dist/`, `(^|/)generated/`, `*.min.*`, `pnpm-lock.yaml`, `uv.lock`, `attached_assets/`, `screenshots/`, `.agents/`, and `*.p2m`.
- Restrict to code extensions: `.ts .tsx .js .jsx .mjs .cjs .rs .py .css .scss .html .sh .sql`.
- Sum per file; never trust `wc -l | tail -1` for a total.

**Why:** Asking "how many lines is this repo" almost always means "how much did the devs actually write", so reporting 19.6M is misleading by two orders of magnitude. The honest number needs the generated/lock/binary exclusions stated explicitly.

**How to apply:** `git ls-files` is the ground truth here — this is a pnpm monorepo whose `artifacts/*` are separate workspace packages, so the interesting code is spread across `artifacts/robotics-interview-dashboard`, `artifacts/api-server`, and `lib/*`, not a single top-level `src/`. Beware two counting traps: (1) `xargs` splits large file lists into multiple `wc` invocations, so `xargs wc -l | tail -1` reports only the *last batch's* total, not the grand total (`git ls-files 'artifacts/api-server/*.ts' | xargs wc -l` gives 39,815, but the same command with `-n 20` gives 13,951); (2) `wc -l` on binaries returns meaningless byte-derived counts, so filter by extension before counting. Note that `lib/*` looks large (39,411 lines) but is 29,041 lines of Orval-generated clients — the hand-written share is only 3,346.
