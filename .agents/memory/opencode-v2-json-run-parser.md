---
name: OpenCode v2 run JSON output is delta text
description: `opencode run --format json` emits NDJSON with incremental text parts; concatenate per part.id to recover the answer.
---

`opencode run --standalone --auto --archived --format json --model <model> "prompt"` writes NDJSON to stdout. Assistant text events have `type == "text"` with `part.text` holding an **incremental delta** (not the full message), a stable `part.id`, and a top-level `sessionID`. Other events include `step_start`, `step_finish`, `tool_use`, and `error`.

**Why:** Verified locally on v2.2.6 — a simple prompt produced 3 lines (`step_start`, `text`, `step_finish`) and `part.text` was only `"TEST_OK"`. The v2 CLI source (`packages/cli/src/run/noninteractive.ts`) slices emitted text with `previous.length`, confirming deltas.

**How to apply:** Extract the answer with `jq -r -s '[.[] | select(.type == "text")] | group_by(.part.id) | map(map(.part.text) | join("")) | join("\n")'`. Get the session with `.[0].sessionID // empty`. `jq -s` on an empty stream still returns `[]`, so the parser is safe on a failed/empty run.
