---
name: Porting the v1 OpenCode GitHub agent to v2
description: Rebuilding issue/PR automation on v2 needs GH_TOKEN for `gh issue create`/`gh pr create` plus manual comment and branch logic.
---

The v1 GitHub agent's features (working comment, GraphQL issue/PR context, attachments, branch creation, PR creation, fork pushes) have no v2 equivalent. Rebuild them in the workflow: `actions/github-script` for comments/context, `opencode run --standalone --auto --archived --format json` with `--file` for attachments, and `gh` for issue/PR creation.

**Why:** v2 has no `opencode github` command or GitHub App/OIDC token. The agent can still create issues and PRs on request because it has a shell — but only if `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` is passed to the run step and `issues: write` / `pull-requests: write` are granted. `GITHUB_TOKEN` cannot push to a fork; that needs a PAT.

**How to apply:** Tell the agent in the prompt which repo and default branch to target, and instruct it to leave no uncommitted changes when it creates an issue/PR itself, otherwise the workflow's own dirty-check will also create a branch/PR. Omit API-key secrets for free models.
