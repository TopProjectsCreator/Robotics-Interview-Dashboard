---
name: OpenCode v2 removed the GitHub action
description: v2 has no opencode GitHub action or `opencode github` command; pin v1.19.6 or rebuild the workflow with `opencode run`.
---

OpenCode v2 removed the `anomalyco/opencode/github` composite action (as of v2.2.0) and the `opencode github` CLI command. The action still exists at the v1 tag `v1.19.6`, and `https://opencode.ai/install` deliberately installs only v1, so pinning the action to `@v1.19.6` keeps it working. `github@latest` now resolves to v2 and fails with a missing action file.

**Why:** Verified via GitHub API — `github/action.yml` exists at `v1.19.6` but 404s at `v2.2.6` and `main`; v2 CLI command list has no `github` command and the v2 docs have no GitHub integration page.

**How to apply:** For existing workflows, pin to `@v1.19.6`. For v2, rebuild comment/branch/PR behavior with `opencode run --standalone --auto --archived` plus `gh` and `actions/github-script`; the OIDC app token and session-share links are gone, and fork pushes need a separate PAT.
