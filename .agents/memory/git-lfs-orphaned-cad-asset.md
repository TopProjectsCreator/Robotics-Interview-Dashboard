---
name: Git LFS orphaned CAD asset
description: The only account Git LFS object is a 173 MB dead Parasolid .x_t; verify pointers before blaming LFS bandwidth.
---

GitHub LFS for the TopProjectsCreator account contains exactly one object: `attached_assets/0_cad_1790463110676.x_t` (sha256 `7b91e07d…`, 173,477,265 bytes), a Parasolid text CAD export from Onshape added in commit `7d3caa2f` (2026-09-26) and deleted from all GitHub branches in `d73f207c` (2026-10-23). `origin/main:.gitattributes` still carries the stale `filter=lfs` rule, but no GitHub branch contains the pointer, nothing in the app references the file, and `attached_assets/*` is globally gitignored. It is dead data, not a needed asset.

Why: the account burned 100% of its 10 GB monthly LFS bandwidth. ~58 downloads of this single 173 MB object (e.g. repeated workspace clones while it lived in main) fully explain 10 GB, and the object keeps occupying LFS storage until history/storage is purged.

How to apply: enumerate LFS repos with `gh search code 'filter=lfs' --owner <acct>`; inspect local objects with `find .git/lfs/objects -type f -printf '%s %p\n'`; find pointer files with `git grep -l 'git-lfs.github.com/spec/v1' $(git for-each-ref --format='%(refname)')`. Confirm the path is still in remote trees (`git ls-tree <remote>/<branch> <path>`) before assuming an LFS file is needed — a leftover `.gitattributes` rule alone causes no downloads. Cleanup: remove the stale rule, purge history/LFS storage, or set a $0 LFS budget to block further charges.
