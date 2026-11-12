import { describe, expect, it } from "vitest";
import appSource from "./App.tsx?raw";

describe("workspace chooser create action", () => {
  it("shows the create-workspace link only to coordinators, admins, and custom-workspace managers, and routes them to the protected builder", () => {
    expect(appSource).toContain(
      'const isCoordinator = !demoMode && (sessionRole === "coordinator" || sessionRole === "admin");',
    );
    expect(appSource).toContain(
      'const canManageCustomWorkspaces = !demoMode && canSessionUsePermission(session.data, "customWorkspaces.manage");',
    );
    expect(appSource).toMatch(
      /\{\(isCoordinator \|\| canManageCustomWorkspaces\) && !demoMode && \(\s*<Link\s+href="\/custom-workspaces"[\s\S]*?data-testid="link-create-workspace"[\s\S]*?Create workspace[\s\S]*?<\/Link>\s*\)\}/,
    );
    expect(appSource).toContain(
      '<Route path="/custom-workspaces"><Shell><AdminOnlyRoute>',
    );
  });
});
