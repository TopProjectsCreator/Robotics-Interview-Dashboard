import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourcePath = fileURLToPath(
  new URL("../routes/robotics.ts", import.meta.url),
);
const source = readFileSync(sourcePath, "utf8");

test("builder answer poll only downloads the columns it inspects", () => {
  const start = source.indexOf("const answerPoll = builderRunId ?");
  assert.notEqual(start, -1, "answer poll must exist");
  const poll = source.slice(start, start + 1600);
  assert.match(poll, /status: assistantBuilderRunsTable\.status/);
  assert.match(poll, /questionId: assistantBuilderRunsTable\.questionId/);
  assert.match(poll, /questions: assistantBuilderRunsTable\.questions/);
  assert.match(poll, /answers: assistantBuilderRunsTable\.answers/);
  assert.doesNotMatch(
    poll,
    /db\.select\(\)\.from\(assistantBuilderRunsTable\)/,
    "full-row select would re-download prompt/activities/result every tick",
  );
  assert.match(source, /const BUILDER_ANSWER_POLL_MS = 3_000;/);
  assert.match(poll, /BUILDER_ANSWER_POLL_MS\) : undefined/);
});

test("settled-run recovery is bounded to a recent window and projected", () => {
  const start = source.indexOf("const settledBuilderPrompts = await runWithInstance");
  assert.notEqual(start, -1, "settled-run recovery scan must exist");
  const scan = source.slice(start, start + 1100);
  assert.match(scan, /db\.select\(\{/);
  assert.match(scan, /gt\(assistantPromptRunsTable\.updatedAt, recoveryWindowStart\)/);
  assert.doesNotMatch(
    scan,
    /db\.select\(\)\.from\(assistantPromptRunsTable\)/,
    "unbounded full-row scans re-download historical failures forever",
  );
  assert.match(source, /const ASSISTANT_RECOVERY_LOOKBACK_MS = 10 \* 60_000;/);
});

test("recovery dispatcher is throttled and disconnects abort open questions", () => {
  assert.match(source, /const ASSISTANT_RECOVERY_POLL_MS = 15_000;/);
  assert.match(source, /lastAssistantRecoveryAt\.get\(instance\)/);
  assert.match(
    source,
    /res\.on\("close", \(\) => \{\s*if \(!res\.writableEnded\) promptAbort\.abort\(\);/,
    "an abandoned SSE stream must clear its answer poll",
  );
});
