export type ProductivityConversation = {
  scope: "shared" | "channel";
  key: string;
  name: string;
  messages: { message: string; createdAt: Date | string }[];
};

export type ProductivityAssessment = {
  score: number;
  summary: string;
  activities: {
    activity: string;
    assessment: "productive" | "low_value" | "potentially_useful" | "no_recorded_progress";
  }[];
  breakdown: {
    projectProgress: number;
    planningCoordination: number;
    focusDiscipline: number;
  };
};

const ASSESSMENTS = new Set([
  "productive",
  "low_value",
  "potentially_useful",
  "no_recorded_progress",
]);

export function buildProductivityResponseFormat(expectedKeys: string[]) {
  if (
    expectedKeys.length === 0 ||
    expectedKeys.some((key) => !key.trim()) ||
    new Set(expectedKeys).size !== expectedKeys.length
  ) {
    throw new Error("Productivity response keys must be unique and non-empty.");
  }

  const scoreSchema = { type: "integer", minimum: 0, maximum: 10 };
  const assessmentSchema = {
    type: "object",
    properties: {
      score: scoreSchema,
      summary: { type: "string", minLength: 1 },
      activities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            activity: { type: "string", minLength: 1 },
            assessment: {
              type: "string",
              enum: [...ASSESSMENTS],
            },
          },
          required: ["activity", "assessment"],
          additionalProperties: false,
        },
      },
      breakdown: {
        type: "object",
        properties: {
          projectProgress: scoreSchema,
          planningCoordination: scoreSchema,
          focusDiscipline: scoreSchema,
        },
        required: ["projectProgress", "planningCoordination", "focusDiscipline"],
        additionalProperties: false,
      },
    },
    required: ["score", "summary", "activities", "breakdown"],
    additionalProperties: false,
  };

  return {
    type: "json_schema" as const,
    json_schema: {
      name: "team_productivity_review",
      strict: true as const,
      schema: {
        type: "object",
        properties: Object.fromEntries(expectedKeys.map((key) => [key, assessmentSchema])),
        required: [...expectedKeys],
        additionalProperties: false,
      },
    },
  };
}

function analysisError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function timestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Chat message has an invalid timestamp.");
  return date.toISOString();
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (utf8Bytes(value) <= maxBytes) return value;
  let output = "";
  let used = 0;
  for (const character of value) {
    const size = utf8Bytes(character);
    if (used + size > maxBytes) break;
    output += character;
    used += size;
  }
  return output;
}

/**
 * Keeps the newest messages from each conversation in round-robin order.
 * The payload contains conversation names and message text only: no authors,
 * direct messages, attachments, reactions, polls, or deleted messages.
 */
export function buildProductivityInput(
  conversations: ProductivityConversation[],
  maxBytes: number,
  windowStart?: Date,
  windowEnd?: Date,
): { payload: { channels: Record<string, { name: string; messages: { at: string; text: string }[] }> }; includedMessages: Map<string, { at: string; text: string }[]> } {
  const channels: Record<string, { name: string; messages: { at: string; text: string }[] }> = {};
  const ordered = conversations.map((conversation) => ({
    ...conversation,
    messages: [...conversation.messages]
      .filter((message) => {
        const createdAt = new Date(message.createdAt).getTime();
        return (!windowStart || createdAt >= windowStart.getTime()) &&
          (!windowEnd || createdAt <= windowEnd.getTime());
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
  })).sort((left, right) => {
    const leftNewest = left.messages[0]?.createdAt;
    const rightNewest = right.messages[0]?.createdAt;
    return (rightNewest ? new Date(rightNewest).getTime() : 0) -
      (leftNewest ? new Date(leftNewest).getTime() : 0);
  });

  for (const conversation of ordered) channels[conversation.key] = {
    name: conversation.name,
    messages: [],
  };

  const payload = { channels };
  let usedBytes = utf8Bytes(JSON.stringify(payload));
  if (usedBytes > maxBytes) {
    throw new Error("The channel list is too large for the configured model context.");
  }

  const blocked = new Set<string>();
  const maxDepth = Math.max(0, ...ordered.map((conversation) => conversation.messages.length));
  for (let depth = 0; depth < maxDepth; depth += 1) {
    let addedAtDepth = false;
    for (const conversation of ordered) {
      if (blocked.has(conversation.key)) continue;
      const message = conversation.messages[depth];
      if (!message) continue;
      const entry = { at: timestamp(message.createdAt), text: message.message };
      const encoded = JSON.stringify(entry);
      const extraBytes = utf8Bytes(encoded) + (channels[conversation.key]!.messages.length ? 1 : 0);
      if (usedBytes + extraBytes <= maxBytes) {
        channels[conversation.key]!.messages.push(entry);
        usedBytes += extraBytes;
        addedAtDepth = true;
        continue;
      }

      const available = maxBytes - usedBytes - 64;
      if (available > 0 && entry.text.length > 0) {
        const clipped = truncateUtf8(entry.text, available);
        if (clipped) {
          const clippedEntry = { ...entry, text: clipped };
          const clippedBytes = utf8Bytes(JSON.stringify(clippedEntry)) +
            (channels[conversation.key]!.messages.length ? 1 : 0);
          if (usedBytes + clippedBytes <= maxBytes) {
            channels[conversation.key]!.messages.push(clippedEntry);
            usedBytes += clippedBytes;
            addedAtDepth = true;
          }
        }
      }
      blocked.add(conversation.key);
    }
    if (!addedAtDepth) break;
  }

  return {
    payload,
    includedMessages: new Map(Object.entries(channels).map(([key, value]) => [key, value.messages])),
  };
}

function isIntegerInRange(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 10;
}

type AssessmentParseResult =
  | { ok: true; assessment: ProductivityAssessment }
  | { ok: false; code: string };

function parseAssessment(value: unknown): AssessmentParseResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_assessment_shape" };
  }
  const result = value as Record<string, unknown>;
  if (!isIntegerInRange(result.score)) return { ok: false, code: "invalid_assessment_score" };
  if (
    typeof result.summary !== "string" ||
    !result.summary.trim()
  ) return { ok: false, code: "invalid_assessment_summary" };
  const activities = Array.isArray(result.activities)
    ? result.activities
    : result.activities && typeof result.activities === "object"
      ? [result.activities]
      : null;
  if (!activities) {
    return { ok: false, code: "invalid_assessment_activities" };
  }
  if (!activities.every((activity) => {
    if (!activity || typeof activity !== "object" || Array.isArray(activity)) return false;
    const item = activity as Record<string, unknown>;
    return typeof item.activity === "string" && item.activity.trim().length > 0 &&
      typeof item.assessment === "string" && ASSESSMENTS.has(item.assessment);
  })) return { ok: false, code: "invalid_assessment_activity_item" };
  if (!result.breakdown || typeof result.breakdown !== "object" || Array.isArray(result.breakdown)) {
    return { ok: false, code: "invalid_assessment_breakdown" };
  }

  const breakdown = result.breakdown as Record<string, unknown>;
  if (
    !isIntegerInRange(breakdown.projectProgress) ||
    !isIntegerInRange(breakdown.planningCoordination) ||
    !isIntegerInRange(breakdown.focusDiscipline)
  ) return { ok: false, code: "invalid_assessment_breakdown_scores" };

  return { ok: true, assessment: {
    score: result.score,
    summary: result.summary.trim(),
    activities: activities.map((activity) => {
      const item = activity as Record<string, string>;
      return {
        activity: item.activity.trim(),
        assessment: item.assessment as ProductivityAssessment["activities"][number]["assessment"],
      };
    }),
    breakdown: {
      projectProgress: breakdown.projectProgress,
      planningCoordination: breakdown.planningCoordination,
      focusDiscipline: breakdown.focusDiscipline,
    },
  } };
}

/** Validates strict JSON and requires exactly one assessment for every channel. */
export function parseProductivityResults(
  responseText: string,
  expectedKeys: string[],
  conversationNames: Record<string, string> = {},
): Record<string, ProductivityAssessment> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw analysisError("invalid_json", "The AI provider did not return valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw analysisError("invalid_response_shape", "The AI provider returned an invalid productivity report.");
  }
  const topLevel = parsed as Record<string, unknown>;
  const nestedChannels = topLevel.channels && typeof topLevel.channels === "object" &&
    !Array.isArray(topLevel.channels)
    ? topLevel.channels as Record<string, unknown>
    : {};
  const result: Record<string, unknown> = { ...nestedChannels, ...topLevel };
  const responseKeysByName = new Map<string, string | null>();
  for (const actualKey of Object.keys(result)) {
    const normalized = actualKey.trim().toLocaleLowerCase();
    if (responseKeysByName.has(normalized)) responseKeysByName.set(normalized, null);
    else responseKeysByName.set(normalized, actualKey);
  }
  const resultKeyByExpectedKey = new Map<string, string>();
  for (const key of expectedKeys) {
    if (Object.hasOwn(result, key)) {
      resultKeyByExpectedKey.set(key, key);
      continue;
    }
    const name = conversationNames[key]?.trim().toLocaleLowerCase();
    const alias = name ? responseKeysByName.get(name) : undefined;
    if (alias) resultKeyByExpectedKey.set(key, alias);
  }
  if (resultKeyByExpectedKey.size !== expectedKeys.length) {
    throw analysisError("missing_conversation_results", "The AI provider did not return one result for every shared conversation.");
  }

  const validated: Record<string, ProductivityAssessment> = {};
  for (const key of expectedKeys) {
    const resultKey = resultKeyByExpectedKey.get(key)!;
    const parsedAssessment = parseAssessment(result[resultKey]);
    if (!parsedAssessment.ok) {
      throw analysisError(parsedAssessment.code, "The AI provider returned an invalid conversation assessment.");
    }
    validated[key] = parsedAssessment.assessment;
  }
  return validated;
}

export function noActivityAssessment(): ProductivityAssessment {
  return {
    score: 0,
    summary: "No chat activity was available for this review.",
    activities: [{ activity: "No recorded progress", assessment: "no_recorded_progress" }],
    breakdown: { projectProgress: 0, planningCoordination: 0, focusDiscipline: 0 },
  };
}
