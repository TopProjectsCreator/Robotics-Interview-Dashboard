---
name: Dark theme opacity utilities
description: Exact dark overrides for Tailwind arbitrary color classes with opacity modifiers.
---

**Rule:** When dark-mode CSS targets Tailwind arbitrary colors with exact class-token selectors, match the entire token, including opacity modifiers such as `/90`. Prefer semantic theme utilities for new UI.

**Why:** Exact token matching prevents hover variants from leaking into resting states, but an opacity utility is a distinct class token. Matching only the base color leaves that surface in its light theme.

**How to apply:** When changing exact dark selectors, search for arbitrary-color classes with opacity suffixes and add full-token mappings or replace them with semantic utilities such as `bg-background/90`. Verify the affected surface in dark mode.