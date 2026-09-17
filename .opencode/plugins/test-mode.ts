import type { Plugin } from "@opencode-ai/plugin"

/**
 * test-mode plugin (local-only, gitignored)
 *
 * Introduces a new primary agent `test` (+ alias `test-mode`):
 * - Tab-cycleable primary agent for running tests, analyzing failures,
 *   proposing fixes — without touching production code by default.
 * - Read/explore freely; edits denied except test files (ask); bash
 *   allowed for test runners + read-only git, ask for everything else.
 *
 * Auto-discovered via `.opencode/plugins/` — no `opencode.json` entry needed.
 * Restart opencode after editing this file (config loads once at startup).
 */
export const TestModePlugin: Plugin = async () => {
  const testAgent = {
    description:
      "Test runner — runs test suites, analyzes failures, proposes fixes. Use when verifying changes or debugging tests.",
    mode: "primary" as const,
    color: "#22c55e" as const,
    temperature: 0.2,
    permission: {
      read: "allow" as const,
      glob: "allow" as const,
      grep: "allow" as const,
      list: "allow" as const,
      // Edits: deny everywhere except test files (ask).
      // For strict read-only (no test edits either), change to: edit: "deny"
      edit: {
        "*": "deny",
        "*.test.*": "ask",
        "*.spec.*": "ask",
        "*/__tests__/*": "ask",
        "**/*.test.*": "ask",
        "**/*.spec.*": "ask",
        "**/__tests__/**": "ask",
      },
      // Bash: broad ask-first, then allow-list test runners + read-only git.
      // NOTE: last matching rule wins, so "*" must come first.
      bash: {
        "*": "ask",
        "pnpm test*": "allow",
        "pnpm vitest*": "allow",
        "pnpm jest*": "allow",
        "pnpm playwright*": "allow",
        "npm test*": "allow",
        "npm run test*": "allow",
        "bun test*": "allow",
        "npx vitest*": "allow",
        "npx jest*": "allow",
        "npx playwright*": "allow",
        "git status*": "allow",
        "git diff*": "allow",
        "git log*": "allow",
        "grep *": "allow",
        "ls*": "allow",
      },
      webfetch: "allow" as const,
      websearch: "allow" as const,
    },
    prompt:
      "You are in TEST MODE. Run test suites, report results, and isolate failures by file/test name. " +
      "Never edit production code without explicit approval — test files (*.test.*, *.spec.*, __tests__/) may be edited only after confirmation. " +
      "Prefer read-only investigation (read/grep/glob) and safe test commands (pnpm/npm/bun test, vitest, jest, playwright). " +
      "Summarize pass/fail, failing assertions, and concrete next steps.",
  }

  return {
    config: async (input) => {
      input.agent ??= {}
      input.agent["test"] = { ...testAgent }
      // Alias so both `@test` and `@test-mode` / Tab cycling work.
      input.agent["test-mode"] = { ...testAgent }
    },
  }
}

export default TestModePlugin
