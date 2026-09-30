import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import PartsLanding from "./parts-landing";
import PublicDashboard from "./public-dashboard";

const privateRecordCanaries = [
  "PRIVATE_PARTS_INVENTORY_RECORD_CANARY",
  "PRIVATE_APPLICANT_RECORD_CANARY",
  "PRIVATE_PRESENCE_RECORD_CANARY",
  "PRIVATE_COLLABORATION_RECORD_CANARY",
];

const privateRecordsResponse = {
  ok: true,
  status: 200,
  headers: { get: () => "application/json" } as unknown as Headers,
  text: async () => JSON.stringify({
    inventory: [{ name: privateRecordCanaries[0] }],
    applicants: [{ name: privateRecordCanaries[1] }],
    presence: [{ name: privateRecordCanaries[2] }],
    collaborators: [{ name: privateRecordCanaries[3] }],
  }),
} as Response;

function renderWithRouter(ui: ReactNode) {
  return render(<Router>{ui}</Router>);
}

function stubNetworkTransports() {
  const fetchSpy = vi.fn(async () => privateRecordsResponse);
  const eventSourceConstructor = vi.fn().mockImplementation(() => ({ close: vi.fn() }));
  const webSocketConstructor = vi.fn().mockImplementation(() => ({
    readyState: 0,
    addEventListener: vi.fn(),
    close: vi.fn(),
    send: vi.fn(),
  }));

  vi.stubGlobal("fetch", fetchSpy);
  vi.stubGlobal("EventSource", eventSourceConstructor);
  vi.stubGlobal("WebSocket", webSocketConstructor);

  return { fetchSpy, eventSourceConstructor, webSocketConstructor };
}

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
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

  it("keeps /parts-landing free of private workspace requests and records", async () => {
    window.history.replaceState({}, "", "/parts-landing");
    const network = stubNetworkTransports();

    render(<App />);

    expect(screen.getByRole("heading", { level: 1, name: /search the shelves/i })).toBeInTheDocument();

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(network.fetchSpy).not.toHaveBeenCalled();
    expect(network.eventSourceConstructor).not.toHaveBeenCalled();
    expect(network.webSocketConstructor).not.toHaveBeenCalled();
    for (const canary of privateRecordCanaries) {
      expect(document.body.textContent).not.toContain(canary);
    }
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