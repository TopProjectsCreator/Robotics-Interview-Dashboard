---
name: OpenCode-only agent instructions
description: Change OpenCode behavior through opencode.jsonc instructions under .opencode/, never a root AGENTS.md.
---

When a behavior change is meant only for OpenCode, put it in project `opencode.jsonc` as an `instructions` entry pointing to a file under `.opencode/`. Do not create a root `AGENTS.md`: OpenCode loads it, but so do other coding tools (and `CLAUDE.md` is the fallback when `AGENTS.md` is absent), so it silently changes agents the user did not ask to change. Do not use `agents.build.system` either, because that field replaces the provider's base prompt instead of appending to it.

**Why:** The user explicitly rejected a root `AGENTS.md` for an OpenCode-only rule. Configured `instructions` are OpenCode-specific, load after discovered instruction files, and apply to the `build` agent and subagents. Editing config or removing an `AGENTS.md` is picked up live in the running session, so no restart is needed.

**How to apply:** Keep OpenCode-only rules in a file such as `.opencode/instructions/<topic>.md`, reference it from `opencode.jsonc` with the `$schema` field, and commit both. Use `AGENTS.md` only when the guidance is meant for every coding tool in the repo.
