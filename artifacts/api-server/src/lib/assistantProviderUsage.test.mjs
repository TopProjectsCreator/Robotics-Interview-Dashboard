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

const {
  mergeProviderUsage,
  normalizeProviderUsage,
  providerUsageWasReported,
} = await import("./assistantProviderUsage.ts");

test("usage normalization preserves provider-reported fields without estimating missing tokens", () => {
  const usage = normalizeProviderUsage({ usage: { input_tokens: 11 } });
  assert.deepEqual(usage, { inputTokens: 11, outputTokens: null, totalTokens: null });
  assert.equal(providerUsageWasReported(usage), true);
  assert.equal(providerUsageWasReported(normalizeProviderUsage({ choices: [] })), false);
});

test("partial usage chunks accumulate across a multi-request stream without inventing totals", () => {
  const firstRequest = mergeProviderUsage(
    normalizeProviderUsage({ usage: { prompt_tokens: 7, total_tokens: 9 } }),
    normalizeProviderUsage({ usage: { completion_tokens: 2 } }),
  );
  const secondRequest = normalizeProviderUsage({ usage: { input_tokens: 5, output_tokens: 4 } });

  assert.deepEqual(firstRequest, { inputTokens: 7, outputTokens: 2, totalTokens: 9 });
  assert.deepEqual(secondRequest, { inputTokens: 5, outputTokens: 4, totalTokens: null });
  assert.equal(firstRequest.inputTokens + secondRequest.inputTokens, 12);
  assert.equal(firstRequest.outputTokens + secondRequest.outputTokens, 6);
  assert.equal(firstRequest.totalTokens + (secondRequest.totalTokens ?? 0), 9);
});

test("malformed, negative, fractional, and unavailable provider usage stays unavailable", () => {
  assert.deepEqual(
    normalizeProviderUsage({ usage: { input_tokens: -1, output_tokens: 2.5, total_tokens: "9" } }),
    { inputTokens: null, outputTokens: null, totalTokens: null },
  );
});
