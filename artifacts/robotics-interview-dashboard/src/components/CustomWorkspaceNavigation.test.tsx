import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AccessibleCustomWorkspace } from "../lib/customWorkspaces";
import { CustomWorkspaceOverviewCard, CustomWorkspaceSidebarLinks } from "./CustomWorkspaceNavigation";

const workspaces: AccessibleCustomWorkspace[] = [
  {
    id: "team-planner",
    title: "Team planner",
    description: "Plan the event.",
    status: "published",
  },
  {
    id: "draft-app",
    title: "Tryout notes",
    description: "",
    status: "draft",
  },
];

describe("custom workspace navigation", () => {
  it("renders custom apps as dashboard cards with their state and route", () => {
    render(<CustomWorkspaceOverviewCard workspace={workspaces[0]} number={6} />);

    const card = screen.getByTestId("card-custom-workspace-team-planner");
    expect(card).toHaveAttribute("href", "/custom-workspaces/team-planner");
    expect(screen.getByTestId("text-custom-workspace-title-team-planner")).toHaveTextContent("Team planner");
    expect(screen.getByTestId("status-custom-workspace-card-team-planner")).toHaveTextContent("Custom app");
  });

  it("shows server-returned apps in the sidebar and marks the active route", () => {
    const onNavigate = vi.fn();
    render(
      <CustomWorkspaceSidebarLinks
        workspaces={workspaces}
        currentPath="/custom-workspaces/draft-app"
        onNavigate={onNavigate}
      />,
    );

    const activeLink = screen.getByTestId("link-custom-workspace-draft-app");
    expect(activeLink).toHaveAttribute("aria-current", "page");
    expect(screen.getByTestId("status-custom-workspace-nav-draft-app")).toHaveTextContent("Draft");
    fireEvent.click(activeLink);
    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
