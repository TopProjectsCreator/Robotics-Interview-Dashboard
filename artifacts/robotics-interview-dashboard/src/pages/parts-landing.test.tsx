import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { afterEach, describe, expect, it, vi } from "vitest";

import PartsLanding from "./parts-landing";
import PublicDashboard from "./public-dashboard";

function renderWithRouter(ui: ReactNode) {
  return render(<Router>{ui}</Router>);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("public parts discovery", () => {
  it("adds a public Parts entry without changing the existing platform entries", () => {
    renderWithRouter(<PublicDashboard />);

    expect(screen.getByTestId("link-parts-entry")).toHaveAttribute("href", "/parts-landing");
    expect(screen.getByTestId("link-interview-entry")).toHaveAttribute("href", "/interview-landing");
    expect(screen.getByTestId("link-chat-entry")).toHaveAttribute("href", "/chat-landing");
  });

  it("shows inventory examples and qualifies supplier coverage", () => {
    renderWithRouter(<PartsLanding />);

    expect(screen.getByRole("heading", { level: 1, name: /search the shelves/i })).toBeInTheDocument();
    expect(screen.getByTestId("card-parts-console")).toHaveTextContent("NO CHECKOUT");
    expect(screen.getByTestId("card-parts-vendor-board")).toHaveTextContent("SOURCE MAP");
    expect(screen.getByTestId("section-parts-coverage")).toHaveTextContent(
      "Complete catalog sync is available only for some sources",
    );
    expect(screen.getByTestId("section-parts-coverage")).toHaveTextContent(
      "not as live supplier pricing, current supplier stock, checkout, or an exhaustive catalog",
    );
    expect(document.querySelector('a[href="/parts"]')).toBeNull();
  });

  it("filters static examples locally and does not request workspace data", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderWithRouter(<PartsLanding />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search parts" }), {
      target: { value: "mcmaster" },
    });

    expect(screen.getByTestId("card-part-result-mm-spacer-08")).toBeInTheDocument();
    expect(screen.queryByTestId("card-part-result-rev-hex-12")).not.toBeInTheDocument();
    expect(screen.getByTestId("status-parts-results")).toHaveTextContent("1 matches");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends every team access action to the existing auth route", () => {
    renderWithRouter(<PartsLanding />);

    const page = screen.getByTestId("parts-landing");
    for (const testId of [
      "link-parts-nav-sign-in",
      "link-parts-hero-sign-in",
      "link-parts-coverage-sign-in",
      "link-parts-cta-sign-in",
    ]) {
      expect(within(page).getByTestId(testId)).toHaveAttribute("href", "/auth");
    }
  });

  it("sets and restores page-specific metadata", () => {
    const previousTitle = document.title;
    const previousDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content;

    const { unmount } = renderWithRouter(<PartsLanding />);

    expect(document.title).toBe("Robotics Parts & Inventory Workspace | Wolverines Team 23442");
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toMatch(
      /supplier part discovery.*robot-build reservations/i,
    );

    unmount();
    expect(document.title).toBe(previousTitle);
    expect(document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content).toBe(previousDescription);
  });
});