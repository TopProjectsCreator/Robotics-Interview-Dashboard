---
name: Auto-backgrounding OpenCode tools via hooks
description: Rewrite tool input with tool.execute.before; shell timeout needs OpenCode 2.3+ to move to background, subagents have no timeout field.
---

To auto-background tools in an OpenCode v2 plugin, use `ctx.tool.hook("execute.before", ...)` and mutate `event.input`: set `input.timeout = 1000` for `shell` (the foreground window after which OpenCode moves the command to the background) and `input.background = true` for `subagent`. Skip shell calls that already set `background: true`, because setting a timeout on those would kill a genuinely detached command.

**Why:** `shell.create.before` exposes `timeout` but not the `background` flag, so it cannot distinguish a detached command from a foreground one; `tool.execute.before` sees the full input and runs for every call, including Code Mode. The subagent tool schema has no timeout field at all (only `background`), so "background after 1 second" cannot be implemented literally for subagents — they must be backgrounded up front. On OpenCode 2.2.x subagents default to foreground; 2.3+ always backgrounds them. A 1s shell `timeout` is unsafe here: a live `sleep 3` was killed with `Command exceeded timeout of 1000 ms` instead of being moved to the background, so set `background: true` from the start as the default and only offer the timeout window as an opt-in for builds that background timed-out commands.

**How to apply:** Verify a hook rewrite without a live session by importing the plugin with Node 24's `--experimental-strip-types` (copy the `.ts` to `.mts` if the workspace package is `"type": "commonjs"`) and calling `setup` with a mock `ctx` whose `tool.hook` captures the callback. Then verify end-to-end by calling the tool *without* the flag: the injected argument appears in the tool error/result, and a subagent result reads "The subagent is working in the background (sessionID: ...)" immediately.
