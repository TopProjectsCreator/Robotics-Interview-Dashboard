---
name: Memory directory consumers and nesting safety
description: Only the filing instruction, a recursive find in survey.sh, and two prose skill mentions read .agents/memory.
---

`.agents/memory` has very few consumers, and none require a flat file layout: `.local/skills/filesystem-and-git-cleanup/scripts/survey.sh` counts files with `find .agents/memory -type f` (recursive), while `.local/skills/skill-authoring/SKILL.md` and `.local/skills/threat-modeling/SKILL.md` only mention the directory in prose. `.opencode/instructions/memory-filing.md` is the only file coupled to the index path.

**Why:** I initially assumed there might be tooling globbing `.agents/memory/*.md` that would break if files moved into folders. A repository-wide search disproved it, but a plain gitignore-respecting `rg` returned nothing because `.opencode/` and `.local/` are hidden/ignored.

**How to apply:** Before claiming no other consumers, search with `rg --hidden --no-ignore -l 'agents/memory' -g '!node_modules' -g '!dist' -g '!.git' .`. If moving memory files into folders, only the filing instruction needs an edit.
