import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConversationAssistant, queryClient } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";

vi.mock("@google/model-viewer", () => ({}));

const ENDPOINT = "https://tools.example.com/mcp";
const QUESTION = "Connect the tools.example.com MCP server please.";
const ANSWER = "Review the proposed destination below.";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(events: unknown[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

describe("assistant MCP connection prompt", () => {
  let savedMessages: Array<{ id: string; question: string; answer: string; activities: unknown[]; createdAt: string }>;
  let messageResponses: number;

  beforeEach(() => {
    savedMessages = [];
    messageResponses = 0;
    window.localStorage.clear();
    queryClient.clear();
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  it("shows the connect prompt when the assistant asks to connect an MCP server", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
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
        return jsonResponse({
          items: [{
            id: "conv-1",
            title: "Chat",
            createdAt: "2026-10-01T00:00:00.000Z",
            updatedAt: "2026-10-01T00:00:00.000Z",
            messageCount: savedMessages.length,
          }],
        });
      }
      if (url.pathname === "/api/assistant/conversations/conv-1/messages") {
        // A real round trip takes longer than the frame in which the stream
        // ends, so the transcript is reconciled against the stale copy first.
        await new Promise(resolve => setTimeout(resolve, 100));
        messageResponses += 1;
        return jsonResponse({ items: savedMessages });
      }
      if (url.pathname === "/api/assistant/config") {
        return jsonResponse({ textModel: "test-model", visionModel: "test-model" });
      }
      if (url.pathname === "/api/assistant/models") {
        return jsonResponse({ items: [{ id: "test-model", name: "Test model" }] });
      }
      if (url.pathname === "/api/onshape-mcp/status") {
        return jsonResponse({ connected: false });
      }
      if (url.pathname === "/api/assistant/custom-mcp/connection") {
        return jsonResponse({ connected: false, endpointUrl: "" });
      }
      if (url.pathname === "/api/assistant/ask/stream" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { question: string };
        savedMessages.push({
          id: "message-1",
          question: body.question,
          answer: ANSWER,
          activities: [],
          createdAt: "2026-10-01T00:01:00.000Z",
        });
        return sseResponse([
          { connectionRequest: { type: "custom_mcp_connection", endpointUrl: ENDPOINT } },
          { done: true, answer: ANSWER, activities: [] },
        ]);
      }
      return jsonResponse({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);

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

    await screen.findByTestId("button-assistant-conversation-conv-1");
    // Wait for the transcript to finish loading so the refetch that follows
    // the turn is a separate request.
    await waitFor(() => expect(messageResponses).toBe(1));
    const input = await screen.findByTestId("input-assistant-question");
    fireEvent.change(input, { target: { value: QUESTION } });
    const ask = screen.getByTestId("button-ask-assistant");
    await waitFor(() => expect(ask).toBeEnabled());
    fireEvent.click(ask);

    const prompt = await screen.findByTestId("assistant-mcp-connection-prompt");
    expect(prompt).toHaveTextContent("Connect a custom MCP server?");
    expect(prompt).toHaveTextContent(ENDPOINT);

    // The transcript is rebuilt from the server copy once the turn is saved.
    // The prompt belongs to that turn, so it has to survive the rebuild.
    await waitFor(() => expect(messageResponses).toBe(2));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 50)); });
    expect(screen.getByTestId("assistant-mcp-connection-prompt")).toBeInTheDocument();
    expect(screen.getByTestId("assistant-mcp-connection-endpoint")).toHaveTextContent(ENDPOINT);
  });
});
