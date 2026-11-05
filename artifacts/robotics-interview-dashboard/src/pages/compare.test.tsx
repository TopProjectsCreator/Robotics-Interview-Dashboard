import { fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "fs";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import ComparePage from "./compare";
import Pricing from "./pricing";
import PublicDashboard from "./public-dashboard";

const compareStyles = readFileSync("src/pages/compare.css", "utf8");

function renderWithRouter(ui: ReactNode) {
  return render(<Router>{ui}</Router>);
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("robotics workspace comparison page", () => {
  it("compares specific workspace, season-management, scouting, and pricing capabilities", () => {
    renderWithRouter(<ComparePage />);

    const page = screen.getByTestId("compare-page");
    expect(within(page).getByRole("columnheader", { name: "Robolyst" })).toBeInTheDocument();
    for (const area of [
      "Core focus",
      "Planning and coordination",
      "Robot engineering",
      "Parts and finances",
      "Scouting and match data",
      "Public presence",
      "Pricing",
    ]) {
      expect(within(page).getAllByText(area).length).toBeGreaterThan(0);
    }
    expect(page).toHaveTextContent("Channels, direct messages, shared notes, and files");
    expect(page).toHaveTextContent("task boards, lists, and timelines with dependencies");
    expect(page).toHaveTextContent("FTC Java");
    expect(page).toHaveTextContent("CAD library with browser 3D previews");
    expect(page).toHaveTextContent("Pit sheets, stand scouting, team questions, picklists, and strategy board");
    expect(page).toHaveTextContent("live match results, and scouting metrics");
    expect(page).toHaveTextContent("Team workspaces are free");
    expect(page).toHaveTextContent("4% plus card-processing fees");
    expect(page).toHaveTextContent("Sources reviewed Nov 4, 2026");
    expect(page).toHaveTextContent("rather than event-wide scouting and match analytics");
    expect(page).not.toHaveTextContent("No feature details are published");
    expect(page).not.toHaveTextContent("AI Driven. Risk Defined.");
    expect(page).not.toHaveTextContent("robolyst.com");
  });

  it("links readers to product details, pricing, and Robolyst's official platform", () => {
    renderWithRouter(<ComparePage />);

    for (const [testId, href] of [
      ["link-compare-our-pricing", "/pricing"],
      ["link-compare-closing-pricing", "/pricing"],
      ["link-compare-closing-platform", "https://robolyst.org/"],
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute("href", href);
    }
    for (const testId of [
      "link-compare-robolyst-note",
      "link-compare-robolyst-icon",
      "link-compare-footer-robolyst",
    ]) {
      expect(screen.getByTestId(testId)).toHaveAttribute("href", "https://robolyst.org/");
      expect(screen.getByTestId(testId)).toHaveAttribute("target", "_blank");
    }
    expect(screen.getByTestId("link-compare-robolyst-features")).toHaveAttribute(
      "href",
      "https://robolyst.org/team-management/features",
    );
    expect(screen.getByRole("link", { name: "FTC metrics" })).toHaveAttribute(
      "href",
      "https://robolyst.org/ftc/scouting-metrics",
    );
  });

  it("keeps the page and metadata free of references outside the comparison scope", () => {
    renderWithRouter(<ComparePage />);

    const page = screen.getByTestId("compare-page");
    const pageContent = [
      page.innerHTML,
      document.title,
      ...Array.from(document.head.querySelectorAll("meta")).map((meta) => meta.content),
    ].join(" ");
    expect(pageContent).not.toMatch(/tryout|interview|applicant|candidate|hiring|recruit/i);
    expect(pageContent).not.toMatch(/selection workflow/i);
  });

  it("keeps the mobile navigation keyboard-operable and adapts the comparison table", () => {
    renderWithRouter(<ComparePage />);

    const menu = screen.getByTestId("button-compare-menu");
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(menu).toHaveAttribute("aria-controls", navigation.id);
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("link-compare-public-info")).toBeVisible();
    screen.getByTestId("link-compare-public-info").focus();
    expect(screen.getByTestId("link-compare-public-info")).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    expect(menu).toHaveFocus();

    expect(compareStyles).toContain("@media (max-width: 700px)");
    expect(compareStyles).toContain(".compare-page__matrix tbody td { display: grid;");
    expect(compareStyles).toContain(".dark .compare-page");
    expect(compareStyles).toContain(".compare-page a:focus-visible");
    expect(compareStyles).toContain(".compare-page button:focus-visible");
    expect(compareStyles).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("makes comparison reachable from the public and pricing navigation", () => {
    renderWithRouter(<PublicDashboard />);
    expect(screen.getByTestId("link-public-compare")).toHaveAttribute("href", "/compare");
    expect(screen.getByTestId("link-footer-compare")).toHaveAttribute("href", "/compare");

    renderWithRouter(<Pricing />);
    expect(screen.getByTestId("link-pricing-compare")).toHaveAttribute("href", "/compare");
  });

  it("serves /compare publicly without requesting private workspace data", () => {
    window.history.replaceState({}, "", "/compare");
    const fetchSpy = vi.fn();
    const eventSourceConstructor = vi.fn();
    const webSocketConstructor = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("EventSource", eventSourceConstructor);
    vi.stubGlobal("WebSocket", webSocketConstructor);
    vi.stubGlobal("scrollTo", vi.fn());

    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Our workspace");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Robolyst");
    expect(screen.getByTestId("section-compare-public-info")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(eventSourceConstructor).not.toHaveBeenCalled();
    expect(webSocketConstructor).not.toHaveBeenCalled();
  });

  it("sets and restores unique comparison metadata", () => {
    const previousTitle = document.title;
    const previousDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;

    const { unmount } = renderWithRouter(<ComparePage />);

    expect(document.title).toBe("Robotics team workspace vs. Robolyst");
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toMatch(
      /compare our FTC team workspace with Robolyst’s season management, scouting, live competition data/i,
    );
    expect(document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.content).toBe(
      "Robotics team workspace vs. Robolyst",
    );

    unmount();
    expect(document.title).toBe(previousTitle);
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(previousDescription);
  });
});
