import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import {
  mergeProviderUsage,
  normalizeProviderUsage,
  providerUsageWasReported,
  type ProviderUsage,
} from "./assistantProviderUsage";

export type AssistantUsageContext = {
  promptId: string;
  teamId: string;
  accountId: string;
};

const usageContext = new AsyncLocalStorage<AssistantUsageContext>();

async function usageDatabase() {
  const [database, tables] = await Promise.all([
    import("@workspace/db"),
    import("@workspace/db/schema"),
  ]);
  return {
    db: database.db,
    prompts: tables.assistantUsagePromptsTable,
    requests: tables.assistantUsageRequestsTable,
    tools: tables.assistantUsageToolsTable,
  };
}

export async function startAssistantUsagePrompt(
  context: AssistantUsageContext,
  source = "interactive",
): Promise<void> {
  const { db, prompts } = await usageDatabase();
  await db.insert(prompts).values({
    id: context.promptId,
    teamId: context.teamId,
    accountId: context.accountId,
    source,
    status: "running",
    finishedAt: null,
  }).onConflictDoUpdate({
    target: prompts.id,
    set: { teamId: context.teamId, accountId: context.accountId, source, status: "running", finishedAt: null },
  });
}

export function enterAssistantUsageContext(context: AssistantUsageContext): void {
  usageContext.enterWith(context);
}

export async function finishAssistantUsagePrompt(
  context: AssistantUsageContext,
  status: "completed" | "failed" | "cancelled",
): Promise<void> {
  const { db, prompts, requests } = await usageDatabase();
  const finishedAt = new Date();
  await db.update(prompts).set({
    status,
    finishedAt,
  }).where(and(
    eq(prompts.id, context.promptId),
    eq(prompts.teamId, context.teamId),
  ));
  await db.update(requests).set({
    status: status === "cancelled" ? "cancelled" : "failed",
    usageReported: false,
    finishedAt,
  }).where(and(
    eq(requests.promptId, context.promptId),
    eq(requests.teamId, context.teamId),
    eq(requests.status, "running"),
  ));
}

export async function runAssistantUsagePrompt<T>(
  context: AssistantUsageContext,
  work: () => Promise<T>,
  options: { source?: string; promptId?: string } = {},
): Promise<T> {
  const scoped = { ...context, promptId: options.promptId ?? context.promptId ?? randomUUID() };
  await startAssistantUsagePrompt(scoped, options.source);
  return usageContext.run(scoped, async () => {
    try {
      const result = await work();
      await finishAssistantUsagePrompt(scoped, "completed");
      return result;
    } catch (error) {
      const cancelled = error instanceof Error &&
        (error.name === "AbortError" || /stopped|cancelled|canceled/i.test(error.message));
      await finishAssistantUsagePrompt(scoped, cancelled ? "cancelled" : "failed").catch(() => undefined);
      throw error;
    }
  });
}

export async function recordAssistantToolInvocation(toolName: string): Promise<void> {
  const context = usageContext.getStore();
  if (!context || !toolName) return;
  const { db, tools } = await usageDatabase();
  await db.insert(tools).values({
    id: randomUUID(),
    promptId: context.promptId,
    teamId: context.teamId,
    accountId: context.accountId,
    toolName,
  });
}

export async function trackAssistantProviderRequest<T>(
  model: string,
  signal: AbortSignal | undefined,
  invoke: () => Promise<T>,
): Promise<T> {
  const context = usageContext.getStore();
  if (!context) return invoke();
  const { db, requests } = await usageDatabase();
  const requestId = randomUUID();
  await db.insert(requests).values({
    id: requestId,
    promptId: context.promptId,
    teamId: context.teamId,
    accountId: context.accountId,
    model,
    status: "running",
  });
  const finish = async (
    status: "succeeded" | "failed" | "cancelled",
    usage: ProviderUsage,
  ) => {
    await db.update(requests).set({
      status,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      usageReported: providerUsageWasReported(usage),
      finishedAt: new Date(),
    }).where(eq(requests.id, requestId));
  };
  try {
    const result = await invoke();
    if (result && typeof result === "object" && Symbol.asyncIterator in result) {
      const source = result as AsyncIterable<unknown>;
      const tracked = (async function* () {
        let usage: ProviderUsage = { inputTokens: null, outputTokens: null, totalTokens: null };
        let completed = false;
        let finalized = false;
        try {
          for await (const chunk of source) {
            usage = mergeProviderUsage(usage, normalizeProviderUsage(chunk));
            yield chunk;
          }
          completed = true;
        } catch (error) {
          finalized = true;
          await finish(signal?.aborted ? "cancelled" : "failed", usage).catch(() => undefined);
          throw error;
        } finally {
          if (completed) await finish("succeeded", usage).catch(() => undefined);
          else if (!finalized) await finish("cancelled", usage).catch(() => undefined);
        }
      })();
      return tracked as T;
    }
    await finish("succeeded", normalizeProviderUsage(result)).catch(() => undefined);
    return result;
  } catch (error) {
    const status = signal?.aborted ? "cancelled" : "failed";
    await finish(status, { inputTokens: null, outputTokens: null, totalTokens: null }).catch(() => undefined);
    throw error;
  }
}
