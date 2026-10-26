import { describe, expect, it } from "vitest";
import { assistantWorkspaceGridClass } from "./assistantWorkspaceLayout";

describe("assistant workspace layout", () => {
  it("gives the conversation the released side-pane width outside Parts", () => {
    expect(assistantWorkspaceGridClass(false)).toBe("grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)]");
  });

  it("keeps the separate Parts tools pane beside conversation history", () => {
    expect(assistantWorkspaceGridClass(true)).toBe(
      "grid gap-5 xl:grid-cols-[270px_minmax(0,1fr)_330px]",
    );
  });
});
