import { describe, expect, it } from "vitest";
import appSource from "./App.tsx?raw";

describe("workspace chooser create action", () => {
  it("shows the create-workspace link only to coordinators and routes to the protected builder", () => {
    // The link is gated on the coordinator role (or a custom role that was
    // granted the manage-custom-workspaces permission) and never in the demo.
    expect(appSource).toContain('const isCoordinator = !demoMode && session.data?.role === "coordinator";');
    expect(appSource).toMatch(
      /\{\(isCoordinator \|\| canManageCustomWorkspaces\) && !demoMode && \(\s*<Link\s+href="\/custom-workspaces"[\s\S]*?data-testid="link-create-workspace"[\s\S]*?Create workspace[\s\S]*?<\/Link>\s*\)\}/,
    );
    expect(appSource).toContain(
      '<Route path="/custom-workspaces"><Shell><AdminOnlyRoute>',
    );
  });
});
