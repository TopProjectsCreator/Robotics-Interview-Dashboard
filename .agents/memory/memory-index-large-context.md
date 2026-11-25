---
name: Flat memory index under large context
description: With generous context, keep one flat complete memory index instead of a folder-tree index.
---

When context is effectively unlimited, keep `.agents/memory/MEMORY.md` as a single flat list of every memory with its path. Do not replace it with a list of folder names that the agent must descend into: a folder tree adds navigation hops and makes mis-filed memories invisible, with no token savings to justify it.

**Why:** At 107 entries (~5k tokens) the index was already trivial for a 1M-context model. Token cost and context pressure were the only arguments for shrinking the index; once those are removed, the flat index wins on recall and simplicity. The deciding cost is navigation, not length.

**How to apply:** Revisit the layout only at roughly 500 entries or when concurrent writes start causing merge conflicts. Before recommending an index structure, recompute the cost model under the user's actual context/token constraints instead of assuming token scarcity.
