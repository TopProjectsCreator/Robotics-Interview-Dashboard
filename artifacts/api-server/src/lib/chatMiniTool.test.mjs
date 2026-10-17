import assert from "node:assert/strict";
import test from "node:test";
import { chatMiniToolMarkdown, parseChatMiniTool } from "./chatMiniTool.ts";

test("accepts a bounded quiz and produces a persisted Markdown block", () => {
  const miniTool = {
    type: "quiz",
    title: "Safety check",
    prompt: "What should you wear?",
    options: ["Safety glasses", "Sandals"],
    answerIndex: 0,
    explanation: "Protect your eyes while working.",
  };

  assert.deepEqual(parseChatMiniTool(miniTool), miniTool);
  assert.equal(
    chatMiniToolMarkdown(miniTool),
    `\`\`\`robotics-mini-tool\n${JSON.stringify(miniTool)}\n\`\`\``,
  );
});

test("accepts checklist and bounded counter definitions", () => {
  assert.equal(parseChatMiniTool({ type: "checklist", title: "Prep", items: ["Charge battery"] })?.type, "checklist");
  assert.equal(parseChatMiniTool({
    type: "counter",
    title: "Parts",
    label: "Motors",
    initial: 2,
    step: 1,
    min: 0,
    max: 12,
  })?.type, "counter");
});

test("rejects unsupported output, executable or external fields, malformed choices, and out-of-range values", () => {
  assert.equal(parseChatMiniTool({ type: "iframe", title: "External app", url: "https://example.com" }), null);
  assert.equal(parseChatMiniTool({
    type: "quiz",
    title: "Unsafe",
    prompt: "Choose",
    options: ["A", "B"],
    answerIndex: 0,
    script: "fetch('/private')",
  }), null);
  assert.equal(parseChatMiniTool({
    type: "quiz",
    title: "Wrong answer index",
    prompt: "Choose",
    options: ["A", "B"],
    answerIndex: 2,
  }), null);
  assert.equal(parseChatMiniTool({
    type: "counter",
    title: "Bad range",
    label: "Count",
    initial: 5,
    step: 1,
    min: 10,
    max: 2,
  }), null);
});

test("rejects control characters, excessive items, and overlong fields", () => {
  assert.equal(parseChatMiniTool({ type: "checklist", title: "bad\nblock", items: ["one"] }), null);
  assert.equal(parseChatMiniTool({
    type: "checklist",
    title: "Too many",
    items: Array.from({ length: 13 }, (_, index) => `Item ${index}`),
  }), null);
  assert.equal(parseChatMiniTool({
    type: "checklist",
    title: "Long item",
    items: ["x".repeat(121)],
  }), null);
});
