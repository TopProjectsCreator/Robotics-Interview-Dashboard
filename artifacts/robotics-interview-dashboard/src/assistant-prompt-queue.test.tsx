import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationAssistant, queryClient } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";

vi.mock("@google/model-viewer", () => ({}));

const conversationId = "conv-queue";
const timestamp = "2026-10-01T00:00:00.000Z";
type QueueItem = {
  id: string;
  conversationId: string;
  prompt: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled" | "interrupted";
  answer: string | null;
  error: string | null;
  activities: unknown[];
  createdAt: string;
  updatedAt: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mountAssistant(): void {
  render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SettingsProvider>
          <WouterRouter>
            <ConversationAssistant />
          </WouterRouter>
        </SettingsProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function runningPrompt(): QueueItem {
  return {
    id: "run-active",
    conversationId,
    prompt: "First prompt",
    status: "running",
    answer: null,
    error: null,
    activities: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("assistant prompt queue controls", () => {
  let items: QueueItem[];
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    items = [runningPrompt()];
    window.localStorage.clear();
    queryClient.clear();
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  function stubApi(): void {
    fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
      if (url.pathname === "/api/auth/session") {
        return jsonResponse({
          authenticated: true,
          label: "Alex",
          interviewerId: "alex-id",
          role: "coordinator",
          teamId: "team-1",
        });
      }
      if (url.pathname === "/api/assistant/conversations") {
        return jsonResponse({ items: [{
          id: conversationId,
          title: "Chat",
          createdAt: timestamp,
          updatedAt: timestamp,
          messageCount: 0,
        }] });
      }
      if (url.pathname === `/api/assistant/conversations/${conversationId}/messages`) {
        return jsonResponse({ items: [] });
      }
      if (url.pathname === `/api/assistant/conversations/${conversationId}/queue` && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { question: string };
        const queued: QueueItem = {
          id: "run-queued",
          conversationId,
          prompt: body.question,
          status: "queued",
          answer: null,
          error: null,
          activities: [],
          createdAt: "2026-10-01T00:01:00.000Z",
          updatedAt: "2026-10-01T00:01:00.000Z",
        };
        items = [...items, queued];
        return jsonResponse(queued, 201);
      }
      if (url.pathname === `/api/assistant/conversations/${conversationId}/queue` && init?.method === "GET") {
        return jsonResponse({ items, isRunning: items.some(item => item.status === "running") });
      }
      if (url.pathname === `/api/assistant/conversations/${conversationId}/stop` && init?.method === "POST") {
        items = items.map(item => item.status === "running" ? { ...item, status: "cancelled" } : item);
        return jsonResponse({ items, isRunning: false });
      }
      if (url.pathname === "/api/assistant/config") {
        return jsonResponse({ textModel: "test-model", visionModel: "test-model" });
      }
      if (url.pathname === "/api/assistant/models") {
        return jsonResponse({ items: [{ id: "test-model", name: "Test model" }] });
      }
      if (url.pathname === "/api/onshape-mcp/status") return jsonResponse({ connected: false });
      if (url.pathname === "/api/assistant/custom-mcp/connection") return jsonResponse({ connected: false, endpointUrl: "" });
      return jsonResponse({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
  }

  it("queues typed text instead of starting a second assistant run", async () => {
    stubApi();
    mountAssistant();

    const input = await screen.findByTestId("input-assistant-question");
    await screen.findByTestId("button-stop-assistant");
    fireEvent.change(input, { target: { value: "Second prompt" } });
    fireEvent.click(screen.getByTestId("button-queue-assistant"));

    await screen.findByText("Second prompt");
    await waitFor(() => {
      const request = fetchMock.mock.calls.find(([input, init]) =>
        new URL(input instanceof Request ? input.url : String(input), window.location.origin).pathname.endsWith("/queue") &&
        init?.method === "POST",
      );
      expect(request).toBeDefined();
      expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ question: "Second prompt", conversationId });
    });
    expect(fetchMock.mock.calls.some(([input]) =>
      new URL(input instanceof Request ? input.url : String(input), window.location.origin).pathname === "/api/assistant/ask/stream",
    )).toBe(false);
    expect(screen.getByTestId("assistant-prompt-run-run-queued")).toHaveTextContent("Queued");
  });

  it("shows the accessible Stop control when the composer is empty and sends a stop request", async () => {
    stubApi();
    mountAssistant();

    const stop = await screen.findByRole("button", { name: "Stop assistant" });
    fireEvent.click(stop);

    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input, init]) =>
        new URL(input instanceof Request ? input.url : String(input), window.location.origin).pathname ===
          `/api/assistant/conversations/${conversationId}/stop` && init?.method === "POST",
      )).toBe(true);
    });
    expect(screen.getByTestId("assistant-prompt-run-run-active")).toHaveTextContent("Stopped");
  });
});
