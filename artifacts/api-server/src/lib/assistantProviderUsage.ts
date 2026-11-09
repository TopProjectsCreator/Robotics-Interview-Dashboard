export type ProviderUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export function normalizeProviderUsage(value: unknown): ProviderUsage {
  const usage = value && typeof value === "object" && "usage" in value
    ? (value as { usage?: unknown }).usage
    : null;
  if (!usage || typeof usage !== "object") {
    return { inputTokens: null, outputTokens: null, totalTokens: null };
  }
  const row = usage as Record<string, unknown>;
  const read = (...keys: string[]): number | null => {
    for (const key of keys) {
      const candidate = row[key];
      if (typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate >= 0) return candidate;
    }
    return null;
  };
  return {
    inputTokens: read("prompt_tokens", "input_tokens"),
    outputTokens: read("completion_tokens", "output_tokens"),
    totalTokens: read("total_tokens"),
  };
}

export function mergeProviderUsage(previous: ProviderUsage, next: ProviderUsage): ProviderUsage {
  return {
    inputTokens: next.inputTokens ?? previous.inputTokens,
    outputTokens: next.outputTokens ?? previous.outputTokens,
    totalTokens: next.totalTokens ?? previous.totalTokens,
  };
}

export function providerUsageWasReported(usage: ProviderUsage): boolean {
  return usage.inputTokens !== null || usage.outputTokens !== null || usage.totalTokens !== null;
}
