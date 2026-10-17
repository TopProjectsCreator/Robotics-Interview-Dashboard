export type ChatMiniTool =
  | {
      type: "quiz";
      title: string;
      prompt: string;
      options: string[];
      answerIndex: number;
      explanation?: string;
    }
  | {
      type: "checklist";
      title: string;
      items: string[];
    }
  | {
      type: "counter";
      title: string;
      label: string;
      initial: number;
      step: number;
      min: number;
      max: number;
    };

export const CHAT_MINI_TOOL_MAX_BYTES = 6_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function safeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/.test(value);
}

function safeTextList(value: unknown, minItems: number, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) &&
    value.length >= minItems &&
    value.length <= maxItems &&
    value.every((item) => safeText(item, maxLength));
}

export function parseChatMiniTool(value: unknown): ChatMiniTool | null {
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.title !== "string") return null;
  let parsed: ChatMiniTool;

  if (value.type === "quiz") {
    if (
      !hasOnlyKeys(value, ["type", "title", "prompt", "options", "answerIndex", "explanation"]) ||
      !safeText(value.title, 100) ||
      !safeText(value.prompt, 240) ||
      !safeTextList(value.options, 2, 4, 100) ||
      !Number.isInteger(value.answerIndex) ||
      (value.answerIndex as number) < 0 ||
      (value.answerIndex as number) >= value.options.length ||
      (value.explanation !== undefined && !safeText(value.explanation, 240))
    ) return null;
    parsed = {
      type: "quiz",
      title: value.title.trim(),
      prompt: value.prompt.trim(),
      options: value.options.map((option) => option.trim()),
      answerIndex: value.answerIndex as number,
      ...(value.explanation === undefined ? {} : { explanation: (value.explanation as string).trim() }),
    };
  } else if (value.type === "checklist") {
    if (
      !hasOnlyKeys(value, ["type", "title", "items"]) ||
      !safeText(value.title, 100) ||
      !safeTextList(value.items, 1, 12, 120)
    ) return null;
    parsed = { type: "checklist", title: value.title.trim(), items: value.items.map((item) => item.trim()) };
  } else if (value.type === "counter") {
    if (
      !hasOnlyKeys(value, ["type", "title", "label", "initial", "step", "min", "max"]) ||
      !safeText(value.title, 100) ||
      !safeText(value.label, 100) ||
      !Number.isInteger(value.initial) ||
      !Number.isInteger(value.step) ||
      !Number.isInteger(value.min) ||
      !Number.isInteger(value.max) ||
      (value.initial as number) < -10_000 ||
      (value.initial as number) > 10_000 ||
      (value.step as number) < 1 ||
      (value.step as number) > 1_000 ||
      (value.min as number) < -10_000 ||
      (value.max as number) > 10_000 ||
      (value.min as number) >= (value.max as number) ||
      (value.initial as number) < (value.min as number) ||
      (value.initial as number) > (value.max as number)
    ) return null;
    parsed = {
      type: "counter",
      title: value.title.trim(),
      label: value.label.trim(),
      initial: value.initial as number,
      step: value.step as number,
      min: value.min as number,
      max: value.max as number,
    };
  } else {
    return null;
  }

  return Buffer.byteLength(JSON.stringify(parsed), "utf8") <= CHAT_MINI_TOOL_MAX_BYTES ? parsed : null;
}

export function chatMiniToolMarkdown(tool: ChatMiniTool): string {
  return `\`\`\`robotics-mini-tool\n${JSON.stringify(tool)}\n\`\`\``;
}
