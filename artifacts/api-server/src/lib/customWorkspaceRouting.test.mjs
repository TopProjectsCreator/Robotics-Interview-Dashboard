import test from "node:test";
import assert from "node:assert/strict";
import { shouldForceCustomWorkspaceTool } from "./customWorkspaceRouting.ts";

test("forces the custom app tool for explicit workspace creation requests", () => {
  assert.equal(
    shouldForceCustomWorkspaceTool("Make me a new workspace where there is a git server being hosted and is a copy of GitHub"),
    true,
  );
  assert.equal(shouldForceCustomWorkspaceTool("Build a new app to track our robot parts"), true);
  assert.equal(shouldForceCustomWorkspaceTool("Could you create a custom workspace for our team?"), true);
});

test("does not force creation for informational questions", () => {
  assert.equal(shouldForceCustomWorkspaceTool("How do I create a custom workspace?"), false);
  assert.equal(shouldForceCustomWorkspaceTool("What workspace should our team use?"), false);
  assert.equal(shouldForceCustomWorkspaceTool("Can you explain how apps are sandboxed?"), false);
});
