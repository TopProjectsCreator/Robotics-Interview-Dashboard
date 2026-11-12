import { randomUUID } from "node:crypto";
import { and, desc, eq, gte, isNull, lt, lte, or } from "drizzle-orm";
import {
  chatChannelsTable,
  chatProductivitySettingsTable,
  chatProductivitySnapshotsTable,
  db,
  DEFAULT_TEAM_ID,
  interviewChatMessagesTable,
} from "@workspace/db";
import {
  getAssistantModelPolicyWithCatalog,
  resolveTeamAssistantModel,
  type AssistantCatalogModel,
} from "./assistantModel";
import { getTeamAssistantProvider } from "./assistantProviderConfiguration";
import { logger } from "./logger";
import { teamAssistantAI } from "./teamAssistantAi";
import {
  buildProductivitySystemPrompt,
  buildProductivityInput,
  buildProductivityResponseFormat,
  chatProductivityRangeStart,
  noActivityAssessment,
  parseProductivityResults,
  type ChatProductivityRange,
  type ProductivityConversation,
} from "./chatProductivityAnalysis";

const REVIEW_INTERVAL_MS = 30 * 60 * 1000;
const DISPATCH_INTERVAL_MS = 60 * 1000;
const MAX_FETCHED_MESSAGES = 5_000;
const MAX_TRANSCRIPT_BYTES = 1_000_000;
const FALLBACK_CONTEXT_TOKENS = 32_000;


type ConversationDefinition = {
  scope: "shared" | "channel";
  key: string;
  name: string;
};

function safeErrorText(error: unknown): string {
  return error instanceof Error ? error.name.slice(0, 100) : "Unknown AI review error";
}

class ProductivityReviewError extends Error {
  readonly stage: string;
  readonly causeName: string;
  readonly status?: number;
  readonly code?: string;

  constructor(stage: string, cause: unknown) {
    super("Scheduled productivity review failed.");
    this.name = "ProductivityReviewError";
    this.stage = stage;
    this.causeName = safeErrorText(cause);
    if (cause && typeof cause === "object") {
      const metadata = cause as { status?: unknown; code?: unknown };
      if (typeof metadata.status === "number" && Number.isInteger(metadata.status) && metadata.status >= 400 && metadata.status <= 599) {
        this.status = metadata.status;
      }
      if (typeof metadata.code === "string" && /^[a-z0-9_-]{1,40}$/i.test(metadata.code)) {
        this.code = metadata.code;
      }
    }
  }
}

function teamMessageFilter(teamId: string) {
  return or(
    eq(interviewChatMessagesTable.teamId, teamId),
    ...(teamId === DEFAULT_TEAM_ID ? [isNull(interviewChatMessagesTable.teamId)] : []),
  );
}

function contextLengthFromCatalog(model: AssistantCatalogModel | undefined): number | undefined {
  const architecture = model?.architecture && typeof model.architecture === "object"
    ? model.architecture as Record<string, unknown>
    : undefined;
  const values = [model?.context_length, model?.contextLength, architecture?.context_length];
  const value = values.find((candidate) =>
    typeof candidate === "number" && Number.isSafeInteger(candidate) && candidate > 0,
  );
  return typeof value === "number" ? value : undefined;
}

function modelReasoningOptions(model: AssistantCatalogModel | undefined): Record<string, unknown> {
  if (!model) return {};
  const parameters = model.supported_parameters ?? model.supportedParameters;
  if (!Array.isArray(parameters)) return {};
  const parameter = parameters.includes("reasoning")
    ? "reasoning"
    : parameters.includes("reasoning_effort")
      ? "reasoning_effort"
      : undefined;
  if (!parameter) return {};
  const levels = model.reasoning_levels ?? model.reasoningLevels ??
    model.reasoning_efforts ?? model.reasoningEfforts;
  if (Array.isArray(levels) && !levels.includes("high")) return {};
  return parameter === "reasoning" ? { reasoning: { effort: "high" } } : { reasoning_effort: "high" };
}

async function resolveModelSettings(teamId: string): Promise<{
  modelId: string;
  contextLength: number;
  reasoningOptions: Record<string, unknown>;
}> {
  const teamProvider = await getTeamAssistantProvider(teamId);
  if (teamProvider) {
    const supportsReasoning = teamProvider.model.reasoning &&
      ["openai-chat-completions", "openai-responses", "openai-compatible"].includes(teamProvider.protocol);
    return {
      modelId: teamProvider.modelId,
      contextLength: teamProvider.model.contextLength ?? FALLBACK_CONTEXT_TOKENS,
      reasoningOptions: supportsReasoning
        ? teamProvider.protocol === "openai-responses"
          ? { reasoning: { effort: "high" } }
          : { reasoning_effort: "high" }
        : {},
    };
  }

  const modelId = await resolveTeamAssistantModel(teamId);
  let model: AssistantCatalogModel | undefined;
  try {
    const { catalog } = await getAssistantModelPolicyWithCatalog(teamId);
    model = catalog.find((entry) => entry.id === modelId);
  } catch (error) {
    logger.warn({ teamId, modelId, err: safeErrorText(error) }, "Could not read configured assistant model capabilities");
  }
  return {
    modelId,
    contextLength: contextLengthFromCatalog(model) ?? FALLBACK_CONTEXT_TOKENS,
    reasoningOptions: modelReasoningOptions(model),
  };
}

function inputBudgetBytes(contextLength: number): number {
  // Reserve about half the context for system instructions and the generated
  // JSON. Two bytes per context token is intentionally conservative; the
  // independent 1 MB ceiling also bounds memory and provider request size.
  return Math.max(2_000, Math.min(MAX_TRANSCRIPT_BYTES, Math.floor(contextLength * 2) - 4_000));
}

async function loadConversations(
  teamId: string,
  windowStart: Date,
  windowEnd: Date,
  selectedConversation?: ConversationDefinition,
): Promise<{
  definitions: ConversationDefinition[];
  conversations: ProductivityConversation[];
}> {
  const channels = selectedConversation
    ? []
    : await db.select({
      id: chatChannelsTable.id,
      name: chatChannelsTable.name,
    }).from(chatChannelsTable)
      .where(eq(chatChannelsTable.teamId, teamId))
      .orderBy(chatChannelsTable.name);

  const definitions: ConversationDefinition[] = selectedConversation
    ? [selectedConversation]
    : [
      { scope: "shared", key: "team", name: "Team conversation" },
      ...channels.map((channel) => ({
        scope: "channel" as const,
        key: channel.id,
        name: channel.name,
      })),
    ];
  const perConversationLimit = Math.max(1, Math.floor(MAX_FETCHED_MESSAGES / definitions.length));
  const queryMessages = (definition: ConversationDefinition, contextOnly: boolean) =>
    db.select({
      message: interviewChatMessagesTable.message,
      createdAt: interviewChatMessagesTable.createdAt,
    }).from(interviewChatMessagesTable)
      .where(and(
        teamMessageFilter(teamId),
        eq(interviewChatMessagesTable.conversationScope, definition.scope),
        definition.scope === "shared"
          ? isNull(interviewChatMessagesTable.conversationPeer)
          : eq(interviewChatMessagesTable.conversationPeer, definition.key),
        contextOnly
          ? lt(interviewChatMessagesTable.createdAt, windowStart)
          : and(
            gte(interviewChatMessagesTable.createdAt, windowStart),
            lte(interviewChatMessagesTable.createdAt, windowEnd),
          ),
        isNull(interviewChatMessagesTable.deletedAt),
      ))
      .orderBy(desc(interviewChatMessagesTable.createdAt))
      .limit(perConversationLimit);

  const messageGroups = await Promise.all(definitions.map((definition) => queryMessages(definition, false)));
  const hasScoringMessages = messageGroups.some((messages) => messages.length > 0);
  const contextGroups = hasScoringMessages
    ? await Promise.all(definitions.map((definition) => queryMessages(definition, true)))
    : definitions.map(() => []);
  const conversations = definitions.map((definition, index) => ({
    ...definition,
    messages: messageGroups[index] ?? [],
    contextMessages: contextGroups[index] ?? [],
  }));
  return { definitions, conversations };
}

async function requestProductivityResults(
  teamId: string,
  modelId: string,
  reasoningOptions: Record<string, unknown>,
  definitions: ConversationDefinition[],
  input: ReturnType<typeof buildProductivityInput>,
  windowStart: Date,
  windowEnd: Date,
  customMessage: string,
): Promise<ReturnType<typeof parseProductivityResults>> {
  const completion = await teamAssistantAI(teamId).chat.completions.create({
    model: modelId,
    messages: [
      { role: "system", content: buildProductivitySystemPrompt(windowStart, windowEnd, customMessage) },
      { role: "user", content: JSON.stringify(input.payload) },
    ],
    response_format: buildProductivityResponseFormat(definitions.map((definition) => definition.key)),
    ...reasoningOptions,
  });
  const text = completion.choices?.[0]?.message?.content;
  if (typeof text !== "string") throw new Error("The AI provider returned no productivity report.");
  return parseProductivityResults(
    text,
    definitions.map((definition) => definition.key),
    Object.fromEntries(definitions.map((definition) => [definition.key, definition.name])),
  );
}

function analysisWindow(
  messages: { at: string; text: string }[],
  windowStart: Date,
  windowEnd: Date,
) {
  if (!messages.length) return { periodStart: null, periodEnd: null };
  return { periodStart: windowStart, periodEnd: windowEnd };
}

async function persistResults(
  teamId: string,
  modelId: string,
  definitions: ConversationDefinition[],
  includedMessages: Map<string, { at: string; text: string }[]>,
  results: ReturnType<typeof parseProductivityResults>,
  windowStart: Date,
  windowEnd: Date,
): Promise<void> {
  for (const definition of definitions) {
    const included = includedMessages.get(definition.key) ?? [];
    const { periodStart, periodEnd } = analysisWindow(included, windowStart, windowEnd);
    const result = results[definition.key] ?? noActivityAssessment();
    await db.insert(chatProductivitySnapshotsTable).values({
      id: randomUUID(),
      teamId,
      conversationScope: definition.scope,
      conversationKey: definition.key,
      conversationName: definition.name,
      score: result.score,
      summary: result.summary,
      activities: result.activities,
      breakdown: result.breakdown,
      periodStart,
      periodEnd,
      modelId,
      createdAt: new Date(),
    });
  }
}

async function reviewTeam(teamId: string): Promise<void> {
  let stage = "resolve model settings";
  try {
    const { modelId, contextLength, reasoningOptions } = await resolveModelSettings(teamId);
    const [settings] = await db.select({ customMessage: chatProductivitySettingsTable.customMessage })
      .from(chatProductivitySettingsTable)
      .where(eq(chatProductivitySettingsTable.teamId, teamId))
      .limit(1);
    const windowEnd = new Date();
    const windowStart = new Date(windowEnd.getTime() - REVIEW_INTERVAL_MS);
    stage = "load shared conversation history";
    const { definitions, conversations } = await loadConversations(teamId, windowStart, windowEnd);
    stage = "prepare context-bounded input";
    const input = buildProductivityInput(
      conversations,
      inputBudgetBytes(contextLength),
      windowStart,
      windowEnd,
    );
    const hasActivity = [...input.includedMessages.values()].some((messages) => messages.length > 0);

    if (!hasActivity) {
      const emptyResults = Object.fromEntries(definitions.map((definition) => [
        definition.key,
        noActivityAssessment(),
      ]));
      stage = "save empty assessments";
      await persistResults(teamId, modelId, definitions, input.includedMessages, emptyResults, windowStart, windowEnd);
      return;
    }

    stage = "request AI assessment";
    const results = await requestProductivityResults(
      teamId,
      modelId,
      reasoningOptions,
      definitions,
      input,
      windowStart,
      windowEnd,
      settings?.customMessage ?? "",
    );
    stage = "save per-conversation assessments";
    await persistResults(teamId, modelId, definitions, input.includedMessages, results, windowStart, windowEnd);
  } catch (error) {
    throw new ProductivityReviewError(stage, error);
  }
}

/** Runs an on-demand assessment for one authorized conversation without persisting it. */
export async function reviewChatProductivityRange(
  teamId: string,
  scope: ConversationDefinition["scope"],
  conversationKey: string,
  conversationName: string,
  range: ChatProductivityRange,
): Promise<{
  conversationName: string;
  score: number;
  summary: string;
  activities: ReturnType<typeof noActivityAssessment>["activities"];
  breakdown: ReturnType<typeof noActivityAssessment>["breakdown"];
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
}> {
  let stage = "resolve model settings";
  try {
    const { modelId, contextLength, reasoningOptions } = await resolveModelSettings(teamId);
    const [settings] = await db.select({ customMessage: chatProductivitySettingsTable.customMessage })
      .from(chatProductivitySettingsTable)
      .where(eq(chatProductivitySettingsTable.teamId, teamId))
      .limit(1);
    const windowEnd = new Date();
    const windowStart = chatProductivityRangeStart(range, windowEnd);
    const definition: ConversationDefinition = { scope, key: conversationKey, name: conversationName };
    stage = "load selected conversation history";
    const { conversations } = await loadConversations(teamId, windowStart, windowEnd, definition);
    stage = "prepare selected-range context";
    const input = buildProductivityInput(
      conversations,
      inputBudgetBytes(contextLength),
      windowStart,
      windowEnd,
    );
    const includedMessages = input.includedMessages.get(conversationKey) ?? [];
    let assessment = noActivityAssessment();
    if (includedMessages.length) {
      stage = "request selected-range AI assessment";
      const results = await requestProductivityResults(
        teamId,
        modelId,
        reasoningOptions,
        [definition],
        input,
        windowStart,
        windowEnd,
        settings?.customMessage ?? "",
      );
      assessment = results[conversationKey] ?? noActivityAssessment();
    }
    const { periodStart, periodEnd } = analysisWindow(includedMessages, windowStart, windowEnd);
    return {
      conversationName,
      ...assessment,
      periodStart,
      periodEnd,
      createdAt: new Date(),
    };
  } catch (error) {
    throw new ProductivityReviewError(stage, error);
  }
}

async function claimDueReview(teamId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - REVIEW_INTERVAL_MS);
  const claimed = await db.update(chatProductivitySettingsTable)
    .set({ lastRunAt: new Date(), lastError: null, updatedAt: new Date() })
    .where(and(
      eq(chatProductivitySettingsTable.teamId, teamId),
      eq(chatProductivitySettingsTable.enabled, true),
      or(isNull(chatProductivitySettingsTable.lastRunAt), lt(chatProductivitySettingsTable.lastRunAt, cutoff)),
    ))
    .returning({ teamId: chatProductivitySettingsTable.teamId });
  return claimed.length > 0;
}

async function runClaimedReview(teamId: string): Promise<void> {
  try {
    await reviewTeam(teamId);
  } catch (error) {
    await db.update(chatProductivitySettingsTable)
      .set({
        lastError: "The latest AI review failed. Another review is scheduled.",
        updatedAt: new Date(),
      })
      .where(eq(chatProductivitySettingsTable.teamId, teamId));
    logger.error({
      teamId,
      stage: error instanceof ProductivityReviewError ? error.stage : "claim review",
      errorType: error instanceof ProductivityReviewError ? error.causeName : safeErrorText(error),
      ...(error instanceof ProductivityReviewError && error.status ? { providerStatus: error.status } : {}),
      ...(error instanceof ProductivityReviewError && error.code ? { providerCode: error.code } : {}),
    }, "Scheduled team productivity review failed");
  }
}

/** Starts an opted-in team's first or explicitly retried review immediately. */
export async function dispatchChatProductivityReviewForTeam(teamId: string): Promise<void> {
  try {
    if (!(await claimDueReview(teamId))) return;
    await runClaimedReview(teamId);
  } catch (error) {
    logger.error({ teamId, err: safeErrorText(error) }, "Could not claim scheduled team productivity review");
  }
}

export async function dispatchDueChatProductivityReviews(): Promise<void> {
  const enabledTeams = await db.select({ teamId: chatProductivitySettingsTable.teamId })
    .from(chatProductivitySettingsTable)
    .where(eq(chatProductivitySettingsTable.enabled, true));

  for (const { teamId } of enabledTeams) {
    try {
      if (!(await claimDueReview(teamId))) continue;
      await runClaimedReview(teamId);
    } catch (error) {
      logger.error({ teamId, err: safeErrorText(error) }, "Could not claim scheduled team productivity review");
    }
  }
}

export function startChatProductivityDispatcher(): void {
  void dispatchDueChatProductivityReviews().catch((error) => {
    logger.error({ err: safeErrorText(error) }, "Initial productivity review dispatch failed");
  });
  const timer = setInterval(() => {
    void dispatchDueChatProductivityReviews().catch((error) => {
      logger.error({ err: safeErrorText(error) }, "Productivity review dispatch failed");
    });
  }, DISPATCH_INTERVAL_MS);
  timer.unref();
}
