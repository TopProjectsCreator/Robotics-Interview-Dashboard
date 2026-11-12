import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "@/App";
import { DEMO_ASSISTANT_RUNS } from "@/pages/demo-assistant-data";

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
    expect(screen.getByTestId("workspace-header")).not.toHaveTextContent("Fictional demo · read-only");
    expect(within(screen.getByTestId("brand-robotics")).getByText("Acme Robotics")).toBeInTheDocument();
    expect(screen.getByTestId("workspace-header")).toHaveTextContent("Demo Robotics");
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
    const unexpectedRequests: string[] = [];
    fetchSpy.mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/demo/drivebase-side-plate.stl")) {
        return Promise.resolve(new Response(
          "solid demo\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid demo",
          { status: 200 },
        ));
      }
      unexpectedRequests.push(url);
      return Promise.reject(new Error(`Unexpected demo request: ${url}`));
    });
    const eventSourceConstructor = vi.fn();
    const webSocketConstructor = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("EventSource", eventSourceConstructor);
    vi.stubGlobal("WebSocket", webSocketConstructor);
    vi.stubGlobal("scrollTo", vi.fn());
    render(<App />);

    fireEvent.click(screen.getByTestId("link-demo-view-chat"));
    expect(screen.getByTestId("demo-real-chat")).not.toHaveAttribute("inert");
    expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Sample identity");
    expect(screen.getByText("The new intake bracket clears the front crossbar.")).toBeInTheDocument();
    expect(screen.getByText("Great. I added the updated side plate to the CAD library.")).toBeInTheDocument();
    const conversationPicker = screen.getByTestId("select-chat-conversation");
    expect(conversationPicker).toHaveTextContent("pit-crew");
    expect(conversationPicker).toHaveTextContent("build-log");
    expect(conversationPicker).toHaveTextContent("strategy");
    const demoChannels = [
      {
        id: "demo-channel-pit-crew",
        message: "The spare wheel set is ready.",
      },
      {
        id: "demo-channel-build-log",
        message: "Drivebase test passed at low speed.",
      },
      {
        id: "demo-channel-strategy",
        message: "We have room for one more autonomous test.",
      },
    ];
    for (const channel of demoChannels) {
      fireEvent.change(conversationPicker, { target: { value: `channel:${channel.id}` } });
      expect(await screen.findByText(channel.message)).toBeInTheDocument();
    }

    expect(conversationPicker).toHaveTextContent("To Leo Park");
    expect(conversationPicker).toHaveTextContent("To Avery Kim");
    expect(conversationPicker).toHaveTextContent("To Noah Patel");
    const demoDirectMessages = [
      {
        peer: "Leo Park",
        message: "Perfect—I'll add it to the packing checklist.",
      },
      {
        peer: "Avery Kim",
        message: "The revised path keeps us clear of the center stage.",
      },
      {
        peer: "Noah Patel",
        message: "I'll check the wheel alignment before the next run.",
      },
    ];
    for (const conversation of demoDirectMessages) {
      fireEvent.change(conversationPicker, { target: { value: `direct:${conversation.peer}` } });
      expect(await screen.findByText(conversation.message)).toBeInTheDocument();
    }

    fireEvent.click(screen.getByTestId("link-demo-view-parts"));
    expect(screen.getByTestId("demo-real-parts")).not.toHaveAttribute("inert");
    expect(screen.getByRole("heading", { name: "Parts" })).toBeInTheDocument();
    expect(screen.getByText("Strafer Chassis 96mm Wheel")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Find parts" }));
    fireEvent.change(screen.getByLabelText("Part, SKU, or material"), { target: { value: "JST" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(await screen.findByText("JST-PH 3-pin Cable")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to draft" }));
    expect(await screen.findByText("JST-PH 3-pin Cable added to the draft order. No purchase has been placed.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Stockroom" }));
    fireEvent.click(screen.getByRole("button", { name: "Open details for Strafer Chassis 96mm Wheel" }));
    const inventoryDetails = await screen.findByRole("dialog");
    expect(within(inventoryDetails).getByText("Supplier quote history")).toBeInTheDocument();
    expect(within(inventoryDetails).getByLabelText("Saved unit cost")).toBeDisabled();
    fireEvent.click(within(inventoryDetails).getAllByRole("button", { name: "Close" })[0]);
    fireEvent.click(screen.getByRole("tab", { name: "Robot builds" }));
    fireEvent.click(screen.getByRole("button", { name: "Open build details for Rover 2026" }));
    expect(await screen.findByTestId("dialog-robot-details")).toBeInTheDocument();
    expect(screen.getByText("Saved build cost")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("link-demo-view-cad"));
    expect(screen.getByTestId("demo-real-cad")).not.toHaveAttribute("inert");
    expect(await screen.findByRole("heading", { name: "Models" })).toBeInTheDocument();
    expect(await screen.findByText("Drivebase side plate")).toBeInTheDocument();
    fireEvent.doubleClick(screen.getByRole("button", { name: "Preview Drivebase side plate" }));
    expect(await screen.findByTestId("cad-preview-dialog")).toBeInTheDocument();
    expect(screen.getByText("Read-only preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close preview" }));

    fireEvent.click(screen.getByTestId("link-demo-view-code"));
    expect(screen.getByTestId("demo-real-code")).not.toHaveAttribute("inert");
    expect(await screen.findByTestId("code-workspace", {}, { timeout: 15000 })).toBeInTheDocument();
    expect(await screen.findByTestId("code-project-name")).toHaveTextContent("BioBuzz FTC");
    expect(screen.getByTestId("code-collab-status")).toHaveTextContent("Sample");
    const codeEditor = await screen.findByTestId("code-textarea");
    expect(codeEditor).toHaveProperty("readOnly", true);
    expect(codeEditor.getAttribute("aria-label")).toContain("BioBuzzTeleOp.java");
    fireEvent.click(screen.getByTestId("code-side-git"));
    fireEvent.click(screen.getByTestId("code-git-clone"));
    expect(screen.getByTestId("code-notice")).toHaveTextContent(/disabled in this read-only demo/i);

    expect(unexpectedRequests).toEqual([]);
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
    expect(unexpectedRequests).toEqual([]);
  });

  it("replays five completed assistant conversations without live service calls", () => {
    window.history.replaceState({}, "", "/demo?view=assistant");
    const fetchSpy = vi.fn();
    const eventSourceConstructor = vi.fn();
    const webSocketConstructor = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("EventSource", eventSourceConstructor);
    vi.stubGlobal("WebSocket", webSocketConstructor);
    vi.stubGlobal("scrollTo", vi.fn());

    render(<App />);

    expect(screen.getByTestId("demo-assistant")).toBeInTheDocument();
    expect(screen.getByTestId("demo-assistant-notice")).toHaveTextContent(/fictional sample replays/i);
    expect(screen.getByTestId("demo-assistant-composer")).toBeDisabled();
    expect(screen.getByTestId("demo-assistant-send")).toBeDisabled();
    expect(DEMO_ASSISTANT_RUNS).toHaveLength(5);

    for (const run of DEMO_ASSISTANT_RUNS) {
      expect(run.activities.length).toBeGreaterThanOrEqual(20);
      fireEvent.click(screen.getByTestId(`demo-assistant-run-button-${run.id}`));

      const activeRun = screen.getByTestId(`demo-assistant-active-run-${run.id}`);
      expect(within(activeRun).getByTestId("demo-assistant-question")).toHaveTextContent(run.prompt);
      expect(within(activeRun).getByTestId("demo-assistant-completion-status")).toHaveTextContent("Completed");
      expect(within(activeRun).getByText("Successful sample completion")).toBeInTheDocument();

      const activityList = within(activeRun).getByTestId("assistant-activities");
      expect(activityList).toHaveTextContent(`${run.activities.length} tool calls`);
      expect(within(activityList).getAllByTestId("assistant-activity-row")).toHaveLength(run.activities.length);

      const firstDetails = within(activityList).getAllByText("Tool call details")[0];
      fireEvent.click(firstDetails);
      expect(within(activityList).getAllByText(/sampleReplay/).length).toBeGreaterThanOrEqual(2);
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(eventSourceConstructor).not.toHaveBeenCalled();
    expect(webSocketConstructor).not.toHaveBeenCalled();
  });
});
