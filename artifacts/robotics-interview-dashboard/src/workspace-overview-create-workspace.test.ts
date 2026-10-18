import { describe, expect, it } from "vitest";
import appSource from "./App.tsx?raw";

describe("workspace chooser create action", () => {
  it("shows the create-workspace link only to coordinators and routes to the protected builder", () => {
    expect(appSource).toContain('const isCoordinator = sessionRole === "coordinator";');
    expect(appSource).toMatch(
      /\{isCoordinator && \(\s*<Link\s+href="\/custom-workspaces"[\s\S]*?data-testid="link-create-workspace"[\s\S]*?Create workspace[\s\S]*?<\/Link>\s*\)\}/,
    );
    expect(appSource).toContain(
      '<Route path="/custom-workspaces"><Shell><AdminOnlyRoute>',
    );
  });
});
