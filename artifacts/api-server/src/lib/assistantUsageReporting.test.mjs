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

const { aggregateAssistantUsage, parseAssistantUsageDateRange } =
  await import("./assistantUsageReporting.ts");

test("date filters are strict UTC calendar dates and include the whole end date", () => {
  const range = parseAssistantUsageDateRange("2026-11-01", "2026-11-30");
  assert.ok(range);
  assert.equal(range.start.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(range.endExclusive.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(parseAssistantUsageDateRange("2026-02-30", "2026-03-01"), null);
  assert.equal(parseAssistantUsageDateRange("2026-11-02", "2026-11-01"), null);
  assert.equal(parseAssistantUsageDateRange("2025-01-01", "2026-01-02"), null);
});

test("one prompt with multiple provider calls reports prompt and request counts separately", () => {
  const { totals, byAccount } = aggregateAssistantUsage([
    { accountId: "account-a", status: "completed" },
    { accountId: "account-a", status: "failed" },
    { accountId: "account-b", status: "cancelled" },
  ], [
    {
      accountId: "account-a",
      status: "succeeded",
      count: 2,
      inputTokens: 18,
      outputTokens: 7,
      totalTokens: 25,
      usageReported: 2,
      usageUnavailable: 0,
    },
    {
      accountId: "account-a",
      status: "failed",
      count: 1,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      usageReported: 0,
      usageUnavailable: 1,
    },
    {
      accountId: "account-b",
      status: "cancelled",
      count: 1,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      usageReported: 0,
      usageUnavailable: 1,
    },
  ]);

  assert.equal(totals.prompts, 3);
  assert.equal(totals.providerRequests, 4);
  assert.equal(totals.inputTokens, 18);
  assert.equal(totals.outputTokens, 7);
  assert.equal(totals.totalTokens, 25);
  assert.equal(totals.failedPrompts, 1);
  assert.equal(totals.cancelledPrompts, 1);
  assert.equal(totals.failedRequests, 1);
  assert.equal(totals.cancelledRequests, 1);
  assert.equal(totals.usageUnavailableRequests, 2);
  assert.equal(byAccount.get("account-a").prompts, 2);
  assert.equal(byAccount.get("account-a").providerRequests, 3);
  assert.equal(byAccount.get("account-b").prompts, 1);
  assert.equal(byAccount.get("account-b").inputTokens, null);
  assert.equal(byAccount.get("account-b").totalTokens, null);
});
