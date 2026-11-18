import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts") && !specifier.endsWith(".js")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const { trackProductivityReviewRequest } = await import("./chatProductivityUsage.ts");

test("scheduled and on-demand review requests each store provider usage once", async () => {
  for (const source of ["scheduled", "on_demand"]) {
    const started = [];
    const finished = [];
    const response = {
      choices: [{ message: { content: JSON.stringify({ team: {}, channel: {} }) } }],
      usage: { prompt_tokens: 31, completion_tokens: 12, total_tokens: 43 },
    };
    const result = await trackProductivityReviewRequest({
      teamId: "team-a",
      modelId: "review-model",
      source,
      request: async () => response,
      startEvent: async (event) => started.push(event),
      finishEvent: async (id, usage) => finished.push({ id, usage }),
      onTrackingError: (stage, error) => assert.fail(`${stage}: ${error}`),
    });

    assert.equal(result, response);
    assert.equal(started.length, 1, "multiple conversation scores still start only one request event");
    assert.equal(started[0].teamId, "team-a");
    assert.equal(started[0].source, source);
    assert.equal(finished.length, 1);
    assert.equal(finished[0].id, started[0].id);
    assert.deepEqual(finished[0].usage, { inputTokens: 31, outputTokens: 12, totalTokens: 43 });
  }
});

test("missing provider token counts remain unavailable instead of being estimated", async () => {
  const finished = [];
  await trackProductivityReviewRequest({
    teamId: "team-a",
    modelId: "review-model",
    source: "on_demand",
    request: async () => ({ choices: [{ message: { content: "{}" } }] }),
    startEvent: async () => undefined,
    finishEvent: async (_id, usage) => finished.push(usage),
    onTrackingError: (stage, error) => assert.fail(`${stage}: ${error}`),
  });
  assert.deepEqual(finished, [{ inputTokens: null, outputTokens: null, totalTokens: null }]);
});

test("failed provider requests keep an unavailable usage event and preserve the error", async () => {
  const finished = [];
  const requestError = new Error("provider unavailable");
  await assert.rejects(trackProductivityReviewRequest({
    teamId: "team-a",
    modelId: "review-model",
    source: "scheduled",
    request: async () => { throw requestError; },
    startEvent: async () => undefined,
    finishEvent: async (_id, usage) => finished.push(usage),
    onTrackingError: (stage, error) => assert.fail(`${stage}: ${error}`),
  }), requestError);
  assert.deepEqual(finished, [null]);
});
