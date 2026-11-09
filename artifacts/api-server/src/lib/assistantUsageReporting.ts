const DAY_MS = 24 * 60 * 60 * 1000;

export function parseAssistantUsageDateRange(startDate: string, endDate: string): {
  start: Date;
  endExclusive: Date;
} | null {
  const parse = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  };
  const start = parse(startDate);
  const end = parse(endDate);
  if (!start || !end || start > end) return null;
  const endExclusive = new Date(end.getTime() + DAY_MS);
  if (endExclusive.getTime() - start.getTime() > 366 * DAY_MS) return null;
  return { start, endExclusive };
}

export type AssistantUsageMetrics = {
  prompts: number;
  completedPrompts: number;
  failedPrompts: number;
  cancelledPrompts: number;
  runningPrompts: number;
  providerRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cancelledRequests: number;
  runningRequests: number;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  usageReportedRequests: number;
  usageUnavailableRequests: number;
};

export type AssistantUsagePromptStatus = {
  accountId: string;
  status: string;
};

export type AssistantUsageRequestSummary = {
  accountId: string;
  status: string;
  count: string | number;
  inputTokens: string | number | null;
  outputTokens: string | number | null;
  totalTokens: string | number | null;
  usageReported: string | number;
  usageUnavailable: string | number;
};

export function emptyAssistantUsageMetrics(): AssistantUsageMetrics {
  return {
    prompts: 0,
    completedPrompts: 0,
    failedPrompts: 0,
    cancelledPrompts: 0,
    runningPrompts: 0,
    providerRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cancelledRequests: 0,
    runningRequests: 0,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    usageReportedRequests: 0,
    usageUnavailableRequests: 0,
  };
}

function safeCount(value: string | number): number {
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

function safeTokenSum(value: string | number | null): number | null {
  if (value === null) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function aggregateAssistantUsage(
  prompts: AssistantUsagePromptStatus[],
  requests: AssistantUsageRequestSummary[],
): { totals: AssistantUsageMetrics; byAccount: Map<string, AssistantUsageMetrics> } {
  const byAccount = new Map<string, AssistantUsageMetrics>();
  const metricsFor = (accountId: string) => {
    let metrics = byAccount.get(accountId);
    if (!metrics) {
      metrics = emptyAssistantUsageMetrics();
      byAccount.set(accountId, metrics);
    }
    return metrics;
  };
  for (const prompt of prompts) {
    const metrics = metricsFor(prompt.accountId);
    metrics.prompts += 1;
    if (prompt.status === "completed") metrics.completedPrompts += 1;
    else if (prompt.status === "failed") metrics.failedPrompts += 1;
    else if (prompt.status === "cancelled") metrics.cancelledPrompts += 1;
    else metrics.runningPrompts += 1;
  }
  for (const request of requests) {
    const metrics = metricsFor(request.accountId);
    const count = safeCount(request.count);
    metrics.providerRequests += count;
    if (request.status === "succeeded") metrics.successfulRequests += count;
    else if (request.status === "failed") metrics.failedRequests += count;
    else if (request.status === "cancelled") metrics.cancelledRequests += count;
    else metrics.runningRequests += count;
    metrics.usageReportedRequests += safeCount(request.usageReported);
    metrics.usageUnavailableRequests += safeCount(request.usageUnavailable);
    for (const [key, value] of [
      ["inputTokens", request.inputTokens],
      ["outputTokens", request.outputTokens],
      ["totalTokens", request.totalTokens],
    ] as const) {
      const sum = safeTokenSum(value);
      if (sum !== null) metrics[key] = (metrics[key] ?? 0) + sum;
    }
  }
  const totals = emptyAssistantUsageMetrics();
  for (const metrics of byAccount.values()) {
    for (const key of Object.keys(totals) as (keyof AssistantUsageMetrics)[]) {
      const value = metrics[key];
      if (typeof value === "number") totals[key] = (typeof totals[key] === "number" ? totals[key] as number : 0) + value;
    }
  }
  return { totals, byAccount };
}
