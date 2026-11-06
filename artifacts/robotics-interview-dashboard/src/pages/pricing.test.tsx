import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "fs";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import About from "./about";
import Landing from "./landing";
import Pricing from "./pricing";
import PublicDashboard from "./public-dashboard";

const pricingStyles = readFileSync("src/pages/pricing.css", "utf8");
const appShell = readFileSync("index.html", "utf8");

function renderWithRouter(ui: ReactNode) {
  return render(<Router>{ui}</Router>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("team pricing page", () => {
  it("presents one $0 team plan with no card requirement", () => {
    renderWithRouter(<Pricing />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("$0");
    expect(screen.getByRole("complementary", { name: "Team plan price" })).toHaveTextContent("$0");
    expect(screen.getByRole("article", { name: "The robotics team workspace plan" })).toHaveTextContent("$0");
    expect(screen.getAllByText("THE TEAM PLAN")).toHaveLength(2);
    expect(screen.getByTestId("pricing-page")).toHaveTextContent("No payment card required");
    expect(screen.getByTestId("pricing-page")).toHaveTextContent(/Made by Team 23442, for robotics teams like yours/i);
    expect(screen.getByTestId("pricing-page")).not.toHaveTextContent(/checkout|billing|subscription|interview|applicant/i);
    expect(document.querySelectorAll(".pricing-page__plan-card")).toHaveLength(1);
  });

  it("describes chat, shared tools, CAD, code, parts, and team collaboration", () => {
    renderWithRouter(<Pricing />);

    const page = screen.getByTestId("pricing-page");
    for (const feature of ["Team chat", "CAD & 3D", "Shared code", "Parts & inventory", "Shared tools", "Team coordination"]) {
      expect(within(page).getByText(feature)).toBeInTheDocument();
    }
    expect(page).toHaveTextContent("team");
  });

  it("sends each get-started action to the existing team sign-in flow", () => {
    renderWithRouter(<Pricing />);

    for (const testId of [
      "link-pricing-nav-auth",
      "link-pricing-hero-auth",
      "link-pricing-panel-auth",
      "link-pricing-plan-auth",
      "link-pricing-closing-auth",
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute("href", "/auth");
    }
  });

  it("keeps mobile navigation keyboard-operable and provides responsive theme styles", () => {
    renderWithRouter(<Pricing />);

    const menu = screen.getByTestId("button-pricing-menu");
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("link-pricing-included")).toBeVisible();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();

    expect(pricingStyles).toContain("@media (max-width: 700px)");
    expect(pricingStyles).toContain(".pricing-page__hero { grid-template-columns: 1fr;");
    expect(pricingStyles).toContain(".dark .pricing-page");
    expect(pricingStyles).toContain(".pricing-page a:focus-visible");
    expect(pricingStyles).toContain(".pricing-page button:focus-visible");
  });

  it("links pricing from the public marketing navigation and footer", () => {
    renderWithRouter(<PublicDashboard />);

    expect(screen.getByTestId("link-public-pricing")).toHaveAttribute("href", "/pricing");
    expect(screen.getByTestId("link-footer-pricing")).toHaveAttribute("href", "/pricing");
  });

  it("serves /pricing publicly without requesting private workspace data", () => {
    window.history.replaceState({}, "", "/pricing");
    const fetchSpy = vi.fn();
    const eventSourceConstructor = vi.fn();
    const webSocketConstructor = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("EventSource", eventSourceConstructor);
    vi.stubGlobal("WebSocket", webSocketConstructor);

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("The work behind the robot.");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(eventSourceConstructor).not.toHaveBeenCalled();
    expect(webSocketConstructor).not.toHaveBeenCalled();
  });

  it("sets and restores pricing metadata", () => {
    const previousTitle = document.title;
    const previousDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;

    const { unmount } = renderWithRouter(<Pricing />);

    expect(document.title).toBe("Pricing · Robotics Team Workspace");
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toMatch(
      /one free shared workspace.*no payment card required/i,
    );

    unmount();
    expect(document.title).toBe(previousTitle);
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(previousDescription);
  });
});

describe("multi-team platform positioning", () => {
  it("describes the shared platform as built for robotics teams everywhere", () => {
    const descriptions = [...appShell.matchAll(/<meta (?:name|property)="(?:description|og:description|twitter:description)" content="([^"]+)"/g)]
      .map((match) => match[1]);

    expect(descriptions).toHaveLength(3);
    expect(new Set(descriptions)).toEqual(new Set([
      "Robotics workspace built by Team 23442 for robotics teams everywhere. Bring planning, team chat, CAD, parts, and project knowledge together in one place.",
    ]));
    expect(descriptions[0]).toHaveLength(153);
    expect(descriptions[0]).not.toMatch(/workspace for Team 23442/i);
  });

  it("credits Team 23442 as the creator while welcoming other robotics teams", () => {
    renderWithRouter(<PublicDashboard />);
    expect(screen.getByTestId("public-dashboard-creator-credit")).toHaveTextContent(
      "Made by Team 23442 for robotics teams like yours",
    );
  });

  it("keeps the about page clear that the workspace is for other robotics teams", () => {
    renderWithRouter(<About />);
    expect(screen.getByRole("heading", { name: /Made by Team 23442 for robotics teams like yours/i })).toBeInTheDocument();
    expect(screen.getByTestId("about-team-23442")).toHaveTextContent(
      "built this workspace to bring robotics engineering, collaboration, and shared knowledge into one place for teams like yours",
    );
  });

  it("frames the tryout page as made for teams beyond Team 23442", () => {
    renderWithRouter(<Landing />);
    expect(screen.getByTestId("landing-creator-credit")).toHaveTextContent(
      "Made by Team 23442 for robotics teams like yours",
    );
  });
});
