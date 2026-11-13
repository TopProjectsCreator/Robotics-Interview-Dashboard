import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  getSettingsNavigationItems,
  SettingsWorkspaceNavigation,
  type SettingsSectionId,
} from "./SettingsWorkspaceNavigation";

function NavigationHarness({
  canManageAssistant = true,
  canManageBranding = true,
}: {
  canManageAssistant?: boolean;
  canManageBranding?: boolean;
}) {
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("profile");
  const items = getSettingsNavigationItems({ canManageAssistant, canManageBranding });
  return (
    <div className="dark">
      <div data-testid="responsive-layout" className="grid grid-rows-[auto_minmax(0,1fr)] sm:grid-cols-[14rem_minmax(0,1fr)] sm:grid-rows-1">
        <SettingsWorkspaceNavigation
          items={items}
          activeSection={activeSection}
          onSectionChange={setActiveSection}
        />
        <section role="tabpanel" aria-labelledby={`settings-tab-${activeSection}`}>
          <h2>{items.find((item) => item.id === activeSection)?.label}</h2>
        </section>
      </div>
    </div>
  );
}

describe("SettingsWorkspaceNavigation", () => {
  it("shows privileged sections only when the matching permission is available", () => {
    const restricted = getSettingsNavigationItems({ canManageAssistant: false, canManageBranding: false });
    const allowed = getSettingsNavigationItems({ canManageAssistant: true, canManageBranding: true });

    expect(restricted.map((item) => item.id)).not.toContain("assistant");
    expect(restricted.map((item) => item.id)).not.toContain("branding");
    expect(restricted.map((item) => item.id)).toContain("team");
    expect(restricted.map((item) => item.id)).toContain("chat");
    expect(allowed.map((item) => item.id)).toContain("assistant");
    expect(allowed.map((item) => item.id)).toContain("branding");
  });

  it("switches panels using tabs and supports arrow, Home, and End keys", () => {
    render(<NavigationHarness />);
    const profile = screen.getByRole("tab", { name: "Profile" });
    fireEvent.click(screen.getByRole("tab", { name: "Appearance" }));
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Appearance");
    expect(screen.getByRole("tab", { name: "Appearance" })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: "Appearance" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "Assistant" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Assistant" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("tab", { name: "Assistant" }), { key: "End" });
    expect(screen.getByRole("tab", { name: "Operations" })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(screen.getByRole("tab", { name: "Operations" }), { key: "Home" });
    expect(profile).toHaveAttribute("aria-selected", "true");
  });

  it("filters sections and moves to the matching panel when the current section is hidden", () => {
    render(<NavigationHarness />);
    fireEvent.change(screen.getByRole("searchbox", { name: "Search settings sections" }), {
      target: { value: "logo" },
    });
    expect(screen.getByRole("tab", { name: "Branding" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Profile" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("searchbox", { name: "Search settings sections" }), {
      target: { value: "no matching section" },
    });
    expect(screen.getByTestId("settings-no-search-results")).toBeInTheDocument();
  });

  it("uses a horizontally scrollable phone navigation and theme-aware colors", () => {
    render(<NavigationHarness />);
    expect(screen.getByTestId("responsive-layout").className).toContain("sm:grid-cols-");
    const nav = screen.getByTestId("settings-navigation");
    expect(nav.className).toContain("sm:border-r");
    expect(nav.className).toContain("bg-card");
    expect(screen.getByTestId("settings-section-tabs").className).toContain("overflow-x-auto");
    expect(screen.getByRole("tab", { name: "Profile" }).className).toContain("bg-primary");
    expect(document.querySelector(".dark")).toBeInTheDocument();
  });

  it("allows a consumer to observe section selection", () => {
    const onSectionChange = vi.fn();
    const items = getSettingsNavigationItems({ canManageAssistant: true, canManageBranding: false });
    render(
      <SettingsWorkspaceNavigation
        items={items}
        activeSection="profile"
        onSectionChange={onSectionChange}
      />,
    );
    fireEvent.click(screen.getByRole("tab", { name: "Team" }));
    expect(onSectionChange).toHaveBeenCalledWith("team");
  });
});
