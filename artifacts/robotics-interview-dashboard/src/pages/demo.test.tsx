import { fireEvent, render, screen, within } from "@testing-library/react";
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

    const page = screen.getByTestId("robotics-demo-page");
    expect(page).toBeInTheDocument();
    expect(within(page).getByText("Demo Robotics")).toBeInTheDocument();
    expect(within(page).getByText(/Names, messages, plans, and records are fictional/i)).toBeInTheDocument();
    expect(document.title).toBe("Live demo · Robotics Team Workspace");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(eventSourceConstructor).not.toHaveBeenCalled();
    expect(webSocketConstructor).not.toHaveBeenCalled();
  });

  it("lets visitors browse sample views and filter records without editing them", () => {
    window.history.replaceState({}, "", "/demo");
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);

    fireEvent.click(screen.getByTestId("button-demo-view-chat"));
    expect(screen.getByTestId("text-demo-view-title")).toHaveTextContent("Shop floor");
    fireEvent.click(screen.getByTestId("button-chat-channel"));
    expect(screen.getByTestId("section-demo-chat")).toHaveTextContent("Pit checklist is updated");

    fireEvent.click(screen.getByTestId("button-demo-view-plan"));
    expect(screen.getByTestId("section-demo-tasks")).toBeInTheDocument();
    expect(screen.getByText("2 in progress")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-task-filter"));
    expect(screen.getByTestId("task-drivebase")).toBeInTheDocument();
    expect(screen.queryByTestId("task-intake")).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /send|edit|delete/i })).not.toBeInTheDocument();
  });
});
