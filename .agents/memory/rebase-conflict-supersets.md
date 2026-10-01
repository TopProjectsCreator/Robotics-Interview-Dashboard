---
name: Rebase conflict supersets
description: Resolving repeated rebase conflicts when current main already contains newer versions of incoming functionality.
---

When resolving a replayed commit, compare both sides' behavior and test coverage before accepting incoming wholesale. Current main may already contain the same feature with newer protections or broader tests.

**Why:** In a long rebase, older commits can conflict with newer mainline implementations of the same functionality; taking the incoming side outright can silently remove later safeguards.

**How to apply:** Compare staged versions and tests for the affected behavior. Keep the current-main version when it subsumes the incoming change, and merge only genuinely unique behavior that is still missing.