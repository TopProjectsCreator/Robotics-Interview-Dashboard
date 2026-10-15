import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewChatPanel } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("chat scheduled time interpretation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ autoRefresh: false }));
    window.history.replaceState({}, "", "/chat");
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("replaces quick picks with an AI time prompt and fills local date/time fields", async () => {
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);
      requests.push({ url, init });
      if (url.pathname === "/api/queue/chat/scheduled/interpret" && init?.method === "POST") {
        return jsonResponse({ date: "2030-04-15", time: "09:00" });
      }
      if (url.pathname === "/api/queue/chat") {
        return jsonResponse({ items: [], scope: "shared", peer: null });
      }
      return jsonResponse({ items: [], interviewerLabels: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <SettingsProvider>
            <WouterRouter>
              <InterviewChatPanel applicantIds={[]} />
            </WouterRouter>
          </SettingsProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "Review the robot update." },
    });
    fireEvent.click(screen.getByTestId("button-chat-schedule"));

    expect(screen.queryByTestId("button-schedule-in-1h")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-schedule-tomorrow-9am")).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId("input-schedule-natural-language"), {
      target: { value: "tomorrow at 9am" },
    });
    fireEvent.click(screen.getByTestId("button-interpret-schedule-time"));

    await waitFor(() => {
      expect(screen.getByTestId("input-schedule-date")).toHaveValue("2030-04-15");
      expect(screen.getByTestId("input-schedule-time")).toHaveValue("09:00");
    });
    const interpretationRequest = requests.find(request =>
      request.url.pathname === "/api/queue/chat/scheduled/interpret" && request.init?.method === "POST",
    );
    expect(JSON.parse(String(interpretationRequest?.init?.body))).toMatchObject({
      text: "tomorrow at 9am",
      timeZone: expect.any(String),
    });
  });
});
