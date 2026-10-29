import assert from "node:assert/strict";
import test from "node:test";
import {
  assistantRequestPayload,
  customWorkspaceBuilderAttempt,
  customWorkspaceBuilderContinuation,
  customWorkspaceBuilderRequestPayload,
  customWorkspaceCritiqueContinuationPrompt,
  customWorkspaceDraftId,
  customWorkspaceDraftIdFromPrompt,
  customWorkspaceRecoveryPrompt,
  isCustomWorkspaceBuilderPrompt,
} from "./assistantBuilderJobs.ts";

test("builder request metadata stays server-only when forwarding to the assistant", () => {
  const payload = customWorkspaceBuilderRequestPayload(
    { question: "Build a custom workspace app for the team.", model: "model-a" },
    "run-123",
    { attempt: 2, continuation: 1 },
  );

  assert.equal(payload.question, "Build a custom workspace app for the team.");
  assert.equal(customWorkspaceBuilderAttempt(payload), 2);
  assert.equal(customWorkspaceBuilderContinuation(payload), 1);
  assert.deepEqual(assistantRequestPayload(payload), {
    question: "Build a custom workspace app for the team.",
    model: "model-a",
  });
});

test("a builder run keeps the same draft id through retries and continuations", () => {
  const runId = "run-123";
  const draftId = customWorkspaceDraftId(runId);

  assert.equal(draftId, "builder-run-123");
  assert.equal(customWorkspaceDraftIdFromPrompt("Build a custom workspace app for the team.", runId), draftId);
  assert.equal(customWorkspaceDraftIdFromPrompt(`Revise custom workspace draft ${draftId}.`, runId), draftId);
  assert.equal(customWorkspaceDraftIdFromPrompt(
    "Build a custom workspace app for the team. Existing draft ID: saved-draft-7.",
    runId,
  ), "saved-draft-7");
});

test("server prompts preserve saved answers and target the existing draft", () => {
  const recovery = customWorkspaceRecoveryPrompt(
    "Build a custom workspace app for the team. Requirements: inventory",
    "builder-run-123",
    { audience: "coaches" },
  );
  const continuation = customWorkspaceCritiqueContinuationPrompt("builder-run-123");

  assert.match(recovery, /Existing draft ID: builder-run-123/);
  assert.match(recovery, /"audience":"coaches"/);
  assert.match(continuation, /critique_custom_workspace/);
  assert.match(continuation, /verify_custom_workspace_fixes/);
});

test("only custom workspace build and revision prompts enter the builder queue", () => {
  assert.equal(isCustomWorkspaceBuilderPrompt("Build a custom workspace app for the team. Requirements: planner"), true);
  assert.equal(isCustomWorkspaceBuilderPrompt("Revise custom workspace draft draft-1. Continue reviews."), true);
  assert.equal(isCustomWorkspaceBuilderPrompt("Summarize our chat"), false);
});

