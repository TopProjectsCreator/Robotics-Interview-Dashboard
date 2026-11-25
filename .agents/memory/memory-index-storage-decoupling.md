---
name: Decouple memory index from file layout
description: A flat MEMORY.md can point into topic folders; moving files on disk need not change the index shape.
---

Separate where memory files live from how they are indexed. Files may move into topic subdirectories to reduce write contention or improve human tidiness, while `MEMORY.md` stays flat and still enumerates every memory using `folder/file.md` paths.

**Why:** The proposed "open folder → read that folder's MEMORY.md → find subfolders" design merges storage and indexing, forcing multi-hop discovery and penalizing mis-categorization. Keeping the index complete preserves one-read visibility of every title.

**How to apply:** If reorganizing, move the `.md` files into folders and rewrite only the link paths in the flat index. Update `.opencode/instructions/memory-filing.md` so future filers use the nested path, and keep one-line summaries in the index so relevance can be judged without opening a file.
