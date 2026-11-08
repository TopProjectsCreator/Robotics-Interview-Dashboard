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

  it("shows the real Chat, Parts, and CAD screens with isolated fictional fixtures", async () => {
    window.history.replaceState({}, "", "/demo");
    const fetchSpy = vi.fn();
    const eventSourceConstructor = vi.fn();
    const webSocketConstructor = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("EventSource", eventSourceConstructor);
    vi.stubGlobal("WebSocket", webSocketConstructor);
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);

    fireEvent.click(screen.getByTestId("link-demo-view-chat"));
    expect(screen.getByTestId("demo-real-chat")).toHaveAttribute("inert");
    expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Sample identity");
    expect(screen.getByText("The new intake bracket clears the front crossbar.")).toBeInTheDocument();
    expect(screen.getByText("Great. I added the updated side plate to the CAD library.")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("link-demo-view-parts"));
    expect(screen.getByTestId("demo-real-parts")).toHaveAttribute("inert");
    expect(screen.getByRole("heading", { name: "Parts" })).toBeInTheDocument();
    expect(screen.getByText("Strafer Chassis 96mm Wheel")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("link-demo-view-cad"));
    expect(screen.getByTestId("demo-real-cad")).toHaveAttribute("inert");
    expect(await screen.findByRole("heading", { name: "Models" })).toBeInTheDocument();
    expect(await screen.findByText("Drivebase side plate")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(eventSourceConstructor).not.toHaveBeenCalled();
    expect(webSocketConstructor).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("link-demo-view-overview"));

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
