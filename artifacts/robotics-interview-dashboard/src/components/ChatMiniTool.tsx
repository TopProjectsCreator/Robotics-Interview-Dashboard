import { useState } from "react";

export type ChatMiniToolData =
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

const MAX_BYTES = 6_000;

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

export function parseChatMiniToolPayload(source: string): ChatMiniToolData | null {
  if (new TextEncoder().encode(source).byteLength > MAX_BYTES) return null;
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string" || typeof value.title !== "string") return null;
  let parsed: ChatMiniToolData;

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

  return new TextEncoder().encode(JSON.stringify(parsed)).byteLength <= MAX_BYTES ? parsed : null;
}

export function ChatMiniTool({ tool }: { tool: ChatMiniToolData }) {
  const [checkedItems, setCheckedItems] = useState<Set<number>>(() => new Set());
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [count, setCount] = useState(tool.type === "counter" ? tool.initial : 0);

  return (
    <section
      aria-label={tool.title}
      data-testid="chat-mini-tool"
      className="my-3 rounded-xl border border-[#c8dedf] bg-[#f7fbfa] p-4 text-[#183a4b] dark:border-[#395563] dark:bg-[#182935] dark:text-[#e5edf3]"
    >
      <h3 className="text-sm font-semibold">{tool.title}</h3>
      {tool.type === "checklist" && (
        <ul className="mt-3 space-y-2">
          {tool.items.map((item, index) => (
            <li key={`${index}-${item}`}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={checkedItems.has(index)}
                  onChange={(event) => setCheckedItems((current) => {
                    const next = new Set(current);
                    if (event.target.checked) next.add(index);
                    else next.delete(index);
                    return next;
                  })}
                  className="mt-0.5 accent-[#16869a]"
                />
                <span className={checkedItems.has(index) ? "text-[#71868c] line-through dark:text-[#9bafb7]" : ""}>{item}</span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {tool.type === "quiz" && (
        <div className="mt-3 space-y-3">
          <p className="text-sm">{tool.prompt}</p>
          <div role="group" aria-label="Answer choices" className="grid gap-2">
            {tool.options.map((option, index) => (
              <button
                key={`${index}-${option}`}
                type="button"
                aria-pressed={selectedOption === index}
                disabled={submitted}
                onClick={() => setSelectedOption(index)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${selectedOption === index ? "border-[#16869a] bg-[#e4f3f2] dark:bg-[#153942]" : "border-[#dce9e8] bg-white dark:border-[#395563] dark:bg-[#1b303b]"}`}
              >
                {option}
              </button>
            ))}
          </div>
          {!submitted && (
            <button
              type="button"
              disabled={selectedOption === null}
              onClick={() => setSubmitted(true)}
              className="rounded-lg bg-[#16869a] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              Check answer
            </button>
          )}
          {submitted && (
            <p role="status" className="text-sm font-medium">
              {selectedOption === tool.answerIndex ? "Correct." : `Not quite. The answer is ${tool.options[tool.answerIndex]}.`}
              {tool.explanation ? ` ${tool.explanation}` : ""}
            </p>
          )}
        </div>
      )}
      {tool.type === "counter" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="min-w-24 text-sm">{tool.label}</span>
          <button
            type="button"
            aria-label={`Decrease ${tool.label}`}
            disabled={count - tool.step < tool.min}
            onClick={() => setCount((current) => Math.max(tool.min, current - tool.step))}
            className="h-11 w-11 rounded-lg border border-[#dce9e8] bg-white text-lg font-semibold disabled:opacity-40 dark:border-[#395563] dark:bg-[#1b303b]"
          >
            −
          </button>
          <output aria-live="polite" className="min-w-10 text-center font-mono text-lg font-semibold" data-testid="chat-mini-tool-count">{count}</output>
          <button
            type="button"
            aria-label={`Increase ${tool.label}`}
            disabled={count + tool.step > tool.max}
            onClick={() => setCount((current) => Math.min(tool.max, current + tool.step))}
            className="h-11 w-11 rounded-lg border border-[#dce9e8] bg-white text-lg font-semibold disabled:opacity-40 dark:border-[#395563] dark:bg-[#1b303b]"
          >
            +
          </button>
        </div>
      )}
    </section>
  );
}

export function InvalidChatMiniTool() {
  return <p role="status" className="my-3 rounded-lg border border-[#e3d5b8] bg-[#fff9e9] px-3 py-2 text-xs text-[#735d2d] dark:border-[#665738] dark:bg-[#302a1b] dark:text-[#e4d3a7]">This interactive preview is unavailable.</p>;
}
