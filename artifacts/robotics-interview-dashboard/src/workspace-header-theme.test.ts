import { describe, expect, it } from "vitest";
import appSource from "./App.tsx?raw";

const workspaceHeader = appSource.match(
  /<header data-testid="workspace-header"[\s\S]*?<\/header>/,
)?.[0];

if (!workspaceHeader) {
  throw new Error("Workspace header markup was not found");
}

describe("workspace header theme and responsive styling", () => {
  it("keeps the light surface and translucent sticky treatment while mapping the exact opacity variant in dark mode", () => {
    expect(workspaceHeader).toContain("sticky top-0");
    expect(workspaceHeader).toContain("bg-[#f3f6f5]/95");
    expect(workspaceHeader).toContain("dark:bg-[hsl(var(--background)_/_95%)]");
    expect(workspaceHeader).toContain("dark:border-[#2a3f52]");
    expect(workspaceHeader).toContain("backdrop-blur-md");
  });

  it("retains contrast mappings for header text, controls, and borders in dark mode", () => {
    expect(workspaceHeader).toContain("text-[#7c8c91]");
    expect(workspaceHeader).toContain("text-[#60757c]");
    expect(workspaceHeader).toContain("text-[#365965]");
    expect(workspaceHeader).toContain("border-[#dce5e5]");
    expect(workspaceHeader).toContain("dark:text-[#93a8b2]");
    expect(workspaceHeader).toContain("dark:text-[#e8eef2]");
    expect(workspaceHeader).toContain("dark:text-[#9db2bd]");
    expect(workspaceHeader).toContain("dark:hover:bg-[#1e3340]");
    expect(workspaceHeader).toContain("dark:text-[#6fce8f]");
    expect(workspaceHeader).toContain("dark:text-[#e89890]");
    expect(appSource).toContain("dark:border-[#31495a]");
    expect(appSource).toContain("dark:bg-[#16262f]");
    expect(appSource).toContain("dark:text-[#c3d3db]");
    expect(appSource).toContain("dark:hover:border-[#6fc3cf]");
    expect(appSource).toContain("dark:bg-[#1d3a47]");
    expect(appSource).toContain("dark:text-[#6fc3cf]");
    expect(workspaceHeader).toContain('data-testid="button-notify-permission"');
    expect(appSource).toContain('data-testid="button-fullscreen"');
    expect(appSource).toContain('data-testid="button-theme-toggle"');
    expect(appSource).toContain('data-testid="button-account-menu"');
  });

  it("keeps header controls and labels within the existing mobile and desktop layout", () => {
    expect(workspaceHeader).toContain("h-14");
    expect(workspaceHeader).toContain("sm:h-16");
    expect(workspaceHeader).toContain("lg:h-[72px]");
    expect(workspaceHeader).toContain("px-3");
    expect(workspaceHeader).toContain("sm:px-5");
    expect(workspaceHeader).toContain("lg:px-9");
    expect(workspaceHeader).toContain('data-testid="button-mobile-menu"');
    expect(workspaceHeader).toContain("lg:hidden");
    expect(workspaceHeader).toContain("sm:flex");
    expect(appSource).toContain("hidden sm:inline");
    expect(workspaceHeader).toContain("{activeTeamName}");
    expect(workspaceHeader).toContain("Team workspace");
  });
});
