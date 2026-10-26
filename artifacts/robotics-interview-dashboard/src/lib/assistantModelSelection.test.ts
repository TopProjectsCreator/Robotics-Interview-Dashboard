import { describe, expect, it } from "vitest";

import {
  DEFAULT_ASSISTANT_MODEL,
  LEGACY_IMPLICIT_ASSISTANT_MODEL,
  resolveAssistantModelSelection,
} from "./assistantModelSelection";

const models = [
  { id: DEFAULT_ASSISTANT_MODEL },
  { id: "provider/other" },
];

describe("resolveAssistantModelSelection", () => {
  it("selects the configured MiniMax default when no model was saved", () => {
    expect(resolveAssistantModelSelection("", DEFAULT_ASSISTANT_MODEL, models))
      .toBe(DEFAULT_ASSISTANT_MODEL);
  });

  it("replaces only the old implicit default and keeps a distinguishable saved choice", () => {
    expect(resolveAssistantModelSelection(LEGACY_IMPLICIT_ASSISTANT_MODEL, DEFAULT_ASSISTANT_MODEL, models))
      .toBe(DEFAULT_ASSISTANT_MODEL);
    expect(resolveAssistantModelSelection("provider/other", DEFAULT_ASSISTANT_MODEL, models))
      .toBe("provider/other");
  });

  it("falls back to an available catalog option when the configured entry is unavailable", () => {
    expect(resolveAssistantModelSelection("", "missing/model", models))
      .toBe(DEFAULT_ASSISTANT_MODEL);
    expect(resolveAssistantModelSelection("", "missing/model", [{ id: "provider/other" }]))
      .toBe("provider/other");
  });
});
