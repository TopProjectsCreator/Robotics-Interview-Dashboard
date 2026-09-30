import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";

import ChatLanding from "./chat-landing";
import PublicDashboard from "./public-dashboard";

function renderWithRouter(ui: ReactNode) {
  return render(<Router>{ui}</Router>);
}

describe("public chat discovery", () => {
  it("links from the public platform while preserving the interview landing", () => {
    renderWithRouter(<PublicDashboard />);

    expect(screen.getByTestId("link-chat-entry")).toHaveAttribute("href", "/chat-landing");
    expect(screen.getByTestId("link-interview-entry")).toHaveAttribute("href", "/interview-landing");
  });

  it("renders static collaboration content and keeps workspace data private", () => {
    renderWithRouter(<ChatLanding />);

    expect(screen.getByRole("heading", { level: 1, name: /talk through the work/i })).toBeInTheDocument();
    expect(screen.getByTestId("card-chat-workspace-preview")).toHaveTextContent("STATIC VIEW");
    expect(screen.getByTestId("card-team-conversations")).toHaveTextContent("Focused channels");
    expect(screen.getByTestId("card-direct-conversations")).toHaveTextContent("DIRECT CONVERSATIONS");
    expect(screen.getByTestId("card-file-context")).toHaveTextContent("CONTEXT ATTACHED");
    expect(screen.getByTestId("section-chat-tools")).toHaveTextContent("Work boards");
    expect(screen.queryByTestId("section-chat-boundary")).not.toBeInTheDocument();
  });

  it("sends every sign-in action to the existing auth route", () => {
    renderWithRouter(<ChatLanding />);

    for (const testId of ["link-chat-nav-sign-in", "link-chat-hero-sign-in", "link-chat-cta-sign-in"]) {
      expect(screen.getByTestId(testId)).toHaveAttribute("href", "/auth");
    }
    expect(screen.getByTestId("link-chat-back-platform")).toHaveAttribute("href", "/");
  });
});