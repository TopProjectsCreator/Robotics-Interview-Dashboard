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
): { payload: { channels: Record<string, { name: string; messages: { at: string; text: string }[] }> }; includedMessages: Map<string, { at: string; text: string }[]> } {
  const channels: Record<string, { name: string; messages: { at: string; text: string }[] }> = {};
  const ordered = conversations.map((conversation) => ({
    ...conversation,
    messages: [...conversation.messages]
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

function parseAssessment(value: unknown): ProductivityAssessment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const result = value as Record<string, unknown>;
  if (
    !isIntegerInRange(result.score) ||
    typeof result.summary !== "string" ||
    !result.summary.trim() ||
    result.summary.length > 500 ||
    !Array.isArray(result.activities) ||
    result.activities.length > 20 ||
    !result.activities.every((activity) => {
      if (!activity || typeof activity !== "object" || Array.isArray(activity)) return false;
      const item = activity as Record<string, unknown>;
      return typeof item.activity === "string" && item.activity.trim().length > 0 &&
        item.activity.length <= 240 &&
        typeof item.assessment === "string" && ASSESSMENTS.has(item.assessment);
    }) ||
    !result.breakdown ||
    typeof result.breakdown !== "object" ||
    Array.isArray(result.breakdown)
  ) return null;

  const breakdown = result.breakdown as Record<string, unknown>;
  if (
    !isIntegerInRange(breakdown.projectProgress) ||
    !isIntegerInRange(breakdown.planningCoordination) ||
    !isIntegerInRange(breakdown.focusDiscipline)
  ) return null;

  return {
    score: result.score,
    summary: result.summary.trim(),
    activities: result.activities.map((activity) => {
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
  };
}

/** Validates strict JSON and requires exactly one assessment for every channel. */
export function parseProductivityResults(
  responseText: string,
  expectedKeys: string[],
): Record<string, ProductivityAssessment> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    throw new Error("The AI provider did not return valid JSON.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("The AI provider returned an invalid productivity report.");
  }
  const result = parsed as Record<string, unknown>;
  if (
    Object.keys(result).length !== expectedKeys.length ||
    expectedKeys.some((key) => !(key in result))
  ) {
    throw new Error("The AI provider did not return one result for every shared conversation.");
  }

  const validated: Record<string, ProductivityAssessment> = {};
  for (const key of expectedKeys) {
    const assessment = parseAssessment(result[key]);
    if (!assessment) throw new Error(`The AI provider returned an invalid result for ${key}.`);
    validated[key] = assessment;
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
