import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { Router } from "wouter";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import ChatLanding from "./chat-landing";
import PublicDashboard from "./public-dashboard";

function renderWithRouter(ui: ReactNode) {
  return render(<Router>{ui}</Router>);
}

const privateRecordCanaries = [
  "PRIVATE_CHAT_RECORD_CANARY",
  "PRIVATE_APPLICANT_RECORD_CANARY",
  "PRIVATE_PRESENCE_RECORD_CANARY",
  "PRIVATE_COLLABORATION_RECORD_CANARY",
];

const privateRecordsResponse = {
  ok: true,
  status: 200,
  headers: { get: () => "application/json" } as unknown as Headers,
  text: async () => JSON.stringify({
    authenticated: false,
    messages: [{ text: privateRecordCanaries[0] }],
    items: [{ name: privateRecordCanaries[1] }],
    entries: [{ name: privateRecordCanaries[2] }],
    collaborators: [{ name: privateRecordCanaries[3] }],
  }),
} as Response;

function stubNetworkTransports(fetchImplementation: typeof fetch = async () => privateRecordsResponse) {
  const fetchSpy = vi.fn(fetchImplementation);
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

function requestPath(input: RequestInfo | URL) {
  if (typeof input === "string") return new URL(input, window.location.origin).pathname;
  if (input instanceof URL) return input.pathname;
  return new URL(input.url, window.location.origin).pathname;
}

const privateDataPath = /(?:^|\/)(?:chat|applicants?|presence|events?|whiteboards?|collab(?:oration)?|boards?|documents?|spreadsheets?)(?:\/|$)/i;

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

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

  it.each(["/", "/chat-landing"])(
    "keeps visitor route %s free of private requests and records",
    async (path) => {
      window.history.replaceState({}, "", path);
      const network = stubNetworkTransports();

      render(<App />);

      if (path === "/") {
        expect(screen.getByRole("heading", { level: 1, name: /one home for the whole robotics team/i })).toBeInTheDocument();
      } else {
        expect(screen.getByRole("heading", { level: 1, name: /talk through the work/i })).toBeInTheDocument();
        expect(screen.getByTestId("card-chat-workspace-preview")).toHaveTextContent("STATIC VIEW");
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(network.fetchSpy).not.toHaveBeenCalled();
      expect(network.eventSourceConstructor).not.toHaveBeenCalled();
      expect(network.webSocketConstructor).not.toHaveBeenCalled();
      for (const canary of privateRecordCanaries) {
        expect(document.body.textContent).not.toContain(canary);
      }
    },
  );

  it("keeps /chat behind the signed-in workspace shell", async () => {
    window.history.replaceState({}, "", "/chat");
    const unauthorizedSession: Response = {
      ok: true,
      status: 200,
      headers: { get: () => "application/json" } as unknown as Headers,
      text: async () => JSON.stringify({ authenticated: false }),
    } as Response;
    const network = stubNetworkTransports(async () => unauthorizedSession);

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/auth"));
    expect(screen.queryByRole("heading", { name: "Team chat" })).not.toBeInTheDocument();
    expect(screen.queryByText("Coordinator workspace")).not.toBeInTheDocument();
    expect(network.fetchSpy.mock.calls.map(([input]) => requestPath(input))).not.toContainEqual(
      expect.stringMatching(privateDataPath),
    );
    expect(network.eventSourceConstructor).not.toHaveBeenCalled();
    expect(network.webSocketConstructor).not.toHaveBeenCalled();
  });
});