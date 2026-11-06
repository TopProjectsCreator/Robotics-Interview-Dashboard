import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState({}, "", "/");
});

describe("public robotics workspace demo", () => {
  it("shows fictional read-only data without connecting to team services", () => {
    window.history.replaceState({}, "", "/demo");
    const fetchSpy = vi.fn();
    const eventSourceConstructor = vi.fn();
    const webSocketConstructor = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("EventSource", eventSourceConstructor);
    vi.stubGlobal("WebSocket", webSocketConstructor);
    vi.stubGlobal("scrollTo", vi.fn());

    render(<App />);

    expect(screen.getByRole("heading", { name: "Choose a workspace" })).toBeInTheDocument();
    expect(screen.getAllByText("Demo Robotics")).toHaveLength(2);
    expect(screen.getByTestId("demo-sample-notice")).toHaveTextContent(/fictional/i);
    expect(screen.getByTestId("text-custom-workspace-title-build-tracker")).toHaveTextContent("Build Tracker");
    expect(screen.getByTestId("text-custom-workspace-title-field-test-log")).toHaveTextContent("Field Test Log");
    expect(document.body.textContent).not.toMatch(/\binterview\b|\bapplicant\b|\btryout\b/i);
    expect(document.title).toBe("Live demo · Robotics Team Workspace");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(eventSourceConstructor).not.toHaveBeenCalled();
    expect(webSocketConstructor).not.toHaveBeenCalled();
  });

  it("browses real workspace navigation and opens local custom apps", async () => {
    window.history.replaceState({}, "", "/demo");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);

    fireEvent.click(screen.getByTestId("link-demo-view-chat"));
    expect(screen.getByTestId("text-demo-view-title")).toHaveTextContent("Shop floor");
    fireEvent.click(screen.getByTestId("button-chat-channel"));
    expect(screen.getByTestId("section-demo-chat")).toHaveTextContent("Pit checklist is updated");

    fireEvent.click(screen.getByTestId("link-demo-custom-app-build-tracker"));
    expect(await screen.findByTestId("text-custom-app-title-build-tracker")).toHaveTextContent("Build Tracker");
    const buildTracker = screen.getByTestId("iframe-custom-app-build-tracker");
    expect(buildTracker.getAttribute("srcdoc")).toContain("Build milestones");

    fireEvent.click(screen.getByTestId("link-demo-custom-app-field-test-log"));
    expect(await screen.findByTestId("text-custom-app-title-field-test-log")).toHaveTextContent("Field Test Log");
    expect(screen.queryByRole("button", { name: /edit|delete|send/i })).not.toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
