import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
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

const routePath = fileURLToPath(new URL("../routes/robotics.ts", import.meta.url));
const builderPagePath = fileURLToPath(new URL("../../../robotics-interview-dashboard/src/pages/CustomWorkspacesPage.tsx", import.meta.url));

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
  assert.match(continuation, /assets\/icon\.svg/);
});

test("only custom workspace build and revision prompts enter the builder queue", () => {
  assert.equal(isCustomWorkspaceBuilderPrompt("Build a custom workspace app for the team. Requirements: planner"), true);
  assert.equal(isCustomWorkspaceBuilderPrompt("Revise custom workspace draft draft-1. Continue reviews."), true);
  assert.equal(isCustomWorkspaceBuilderPrompt("Summarize our chat"), false);
});

test("builder jobs are persisted before the API delegates execution", async () => {
  const source = await readFile(routePath, "utf8");
  assert.ok(source.includes('router.post("/assistant/custom-workspace-builder/runs"'));
  assert.ok(source.includes("await tx.insert(assistantBuilderRunsTable)"));
  assert.ok(source.includes("await tx.insert(assistantPromptRunsTable)"));
  assert.ok(source.includes('"x-assistant-builder-run-id": builderRunId'));
  assert.ok(source.includes("delegatedRun ? requestedBuilderRunId : randomUUID()"));
  assert.ok(source.includes("customWorkspaceBuilderRunId(delegatedRun.payload) !== requestedBuilderRunId"));
});

test("builder recovery requeues from the saved draft and saved coordinator answers", async () => {
  const source = await readFile(routePath, "utf8");
  assert.ok(source.includes("customWorkspaceRecoveryPrompt(originalQuestion, workspaceId, builderRun?.answers ?? {})"));
  assert.ok(source.includes('status: "queued"'));
  assert.ok(source.includes("await continueCustomWorkspaceBuilder(run, builderRunId)"));
  assert.ok(source.includes("await retryCustomWorkspaceBuilderPrompt(run, \"The server restarted before the builder retry was queued.\")"));
});

test("the custom workspace UI only enqueues and observes durable builder runs", async () => {
  const source = await readFile(builderPagePath, "utf8");
  assert.ok(source.includes('"/api/assistant/custom-workspace-builder/runs"'));
  assert.ok(source.includes("runs/${encodeURIComponent(normalizedRun.id)}"));
  assert.ok(!source.includes('"/api/assistant/ask/stream"'), "the page must not own the assistant stream");
  assert.ok(!source.includes("for (let attempt = 0; attempt < 5; attempt += 1)"), "critique continuation belongs to the server worker");
});

