import { QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getGetSessionQueryKey } from "@workspace/api-client-react";
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

function sseResponse(events: unknown[], delayMs = 0): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      void (async () => {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        controller.close();
      })();
    },
  });
  return new Response(stream, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

type ConnectionMode = "api-key" | "oauth" | "failed-confirmation" | "continuation-fails-once" | "direct";

function createContinuationFixture(mode: ConnectionMode) {
  const savedMessages: Array<{ id: string; question: string; answer: string; activities: unknown[]; createdAt: string }> = [];
  const askBodies: Array<Record<string, unknown>> = [];
  const connectionBodies: Array<Record<string, unknown>> = [];
  let connected = false;
  let connectionAttempts = 0;
  let continuationAttempts = 0;
  let messageResponses = 0;
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
        }, {
          id: "conv-2",
          title: "Another chat",
          createdAt: "2026-10-02T00:00:00.000Z",
          updatedAt: "2026-10-02T00:00:00.000Z",
          messageCount: 0,
        }],
      });
    }
    if (url.pathname === "/api/assistant/conversations/conv-1/messages" ||
        url.pathname === "/api/assistant/conversations/conv-2/messages") {
      await new Promise(resolve => setTimeout(resolve, 80));
      messageResponses += 1;
      return jsonResponse({
        items: url.pathname.endsWith("/conv-1/messages") ? savedMessages : [],
      });
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
    if (url.pathname === "/api/assistant/custom-mcp/connection" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      connectionBodies.push(body);
      connectionAttempts += 1;
      if (mode === "api-key" && !body.apiKey) {
        return jsonResponse({
          connected: false,
          apiKeyRequired: true,
          endpointUrl: ENDPOINT,
          apiKeyHeader: "X-API-Key",
          apiKeyPrefix: "",
        });
      }
      if (mode === "oauth") {
        window.setTimeout(() => { connected = true; }, 100);
        return jsonResponse({ connected: false, authorizationUrl: "https://tools.example.com/authorize" });
      }
      if (mode === "failed-confirmation" && connectionAttempts === 1) {
        return jsonResponse({ connected: true, endpointUrl: ENDPOINT });
      }
      connected = true;
      return jsonResponse({ connected: true, endpointUrl: ENDPOINT });
    }
    if (url.pathname === "/api/assistant/custom-mcp/connection") {
      return jsonResponse({ connected, endpointUrl: connected ? ENDPOINT : "" });
    }
    if (url.pathname === "/api/assistant/ask/stream" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as Record<string, unknown> & { question: string };
      askBodies.push(body);
      if (body.mcpContinuation) {
        continuationAttempts += 1;
        if (mode === "continuation-fails-once" && continuationAttempts === 1) {
          return sseResponse([{ error: "The MCP tool failed temporarily." }]);
        }
        const answer = "The connected MCP tool found three matching records.";
        const activities = [{ tool: "custom_mcp_lookup", detail: "Found 3 records" }];
        savedMessages[0] = { ...savedMessages[0], answer, activities };
        return sseResponse([
          { activity: activities[0] },
          { delta: answer },
          { done: true, answer, activities },
        ], 70);
      }
      const answer = body.question === QUESTION ? ANSWER : "Manual answer";
      savedMessages.push({
        id: `message-${savedMessages.length + 1}`,
        question: body.question,
        answer,
        activities: [],
        createdAt: `2026-10-01T00:0${savedMessages.length + 1}:00.000Z`,
      });
      return sseResponse([
        ...(body.question === QUESTION ? [{ connectionRequest: { type: "custom_mcp_connection", endpointUrl: ENDPOINT } }] : []),
        { done: true, answer, activities: [] },
      ]);
    }
    return jsonResponse({ items: [] });
  });
  return { fetchMock, savedMessages, askBodies, connectionBodies, get messageResponses() { return messageResponses; } };
}

function renderAssistant() {
  return render(
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

async function submitMcpRequest() {
  await screen.findByTestId("button-assistant-conversation-conv-1");
  await waitFor(() => expect(screen.getByTestId("input-assistant-question")).toBeEnabled());
  fireEvent.change(screen.getByTestId("input-assistant-question"), { target: { value: QUESTION } });
  const ask = screen.getByTestId("button-ask-assistant");
  await waitFor(() => expect(ask).toBeEnabled());
  fireEvent.click(ask);
  await screen.findByTestId("assistant-mcp-connection-prompt");
}

async function connectMcpFromSettings() {
  fireEvent.click(screen.getByTestId("assistant-tools-gear"));
  fireEvent.change(await screen.findByTestId("assistant-custom-mcp-endpoint"), { target: { value: ENDPOINT } });
  fireEvent.click(screen.getByTestId("assistant-custom-mcp-toggle"));
  await waitFor(() => expect(screen.getByTestId("assistant-custom-mcp-setting")).toHaveTextContent("Connected"));
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

  it("resumes once after an API-key connection and updates the original transcript turn", async () => {
    const fixture = createContinuationFixture("api-key");
    vi.stubGlobal("fetch", fixture.fetchMock);
    vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
    renderAssistant();
    await submitMcpRequest();

    fireEvent.click(screen.getByTestId("button-connect-assistant-mcp"));
    const apiKey = await screen.findByTestId("assistant-mcp-api-key");
    fireEvent.change(apiKey, { target: { value: "test-key" } });
    fireEvent.click(screen.getByTestId("button-connect-assistant-mcp"));

    await screen.findByTestId("assistant-mcp-continuing");
    await waitFor(() => expect(fixture.askBodies).toHaveLength(2));
    expect(fixture.askBodies[1]).toMatchObject({
      question: QUESTION,
      conversationId: "conv-1",
      model: fixture.askBodies[0].model,
      mcpContinuation: { endpointUrl: ENDPOINT },
    });
    await waitFor(() => expect(screen.getByTestId("assistant-answer-0")).toHaveTextContent(
      "The connected MCP tool found three matching records.",
    ));
    expect(screen.getAllByTestId("assistant-question-0")).toHaveLength(1);
    expect(await screen.findByTestId("assistant-activities")).toHaveTextContent("Found 3 records");
    expect(fixture.savedMessages).toHaveLength(1);
  });

  it("resumes after OAuth polling confirms the endpoint and ignores later duplicate status checks", async () => {
    const fixture = createContinuationFixture("oauth");
    vi.stubGlobal("fetch", fixture.fetchMock);
    vi.spyOn(window, "open").mockReturnValue({
      closed: true,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
    renderAssistant();
    await submitMcpRequest();

    fireEvent.click(screen.getByTestId("button-connect-assistant-mcp"));
    await waitFor(() => expect(fixture.askBodies).toHaveLength(2), { timeout: 5000 });
    await waitFor(() => expect(fixture.askBodies.filter(body => body.mcpContinuation)).toHaveLength(1));
    expect(fixture.askBodies[1]).toMatchObject({
      question: QUESTION,
      conversationId: "conv-1",
      mcpContinuation: { endpointUrl: ENDPOINT },
    });
    await waitFor(() => expect(screen.getByTestId("assistant-answer-0")).toHaveTextContent(
      "The connected MCP tool found three matching records.",
    ));
    expect(fixture.savedMessages).toHaveLength(1);
  });

  it("keeps the original request retryable when the server does not confirm the connection", async () => {
    const fixture = createContinuationFixture("failed-confirmation");
    vi.stubGlobal("fetch", fixture.fetchMock);
    vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
    renderAssistant();
    await submitMcpRequest();

    fireEvent.click(screen.getByTestId("button-connect-assistant-mcp"));
    expect(await screen.findByRole("alert")).toHaveTextContent("could not be confirmed");
    expect(fixture.askBodies).toHaveLength(1);
    expect(screen.getByTestId("assistant-mcp-connection-prompt")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-connect-assistant-mcp"));
    await screen.findByTestId("assistant-mcp-continuing");
    await waitFor(() => expect(fixture.askBodies).toHaveLength(2));
    expect(fixture.askBodies[1]).toHaveProperty("mcpContinuation");
  });

  it("lets the coordinator retry a failed continuation without duplicating it", async () => {
    const fixture = createContinuationFixture("continuation-fails-once");
    vi.stubGlobal("fetch", fixture.fetchMock);
    vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
    renderAssistant();
    await submitMcpRequest();

    fireEvent.click(screen.getByTestId("button-connect-assistant-mcp"));
    await waitFor(() => expect(fixture.askBodies.filter(body => body.mcpContinuation)).toHaveLength(1));
    const retry = await screen.findByTestId("button-retry-assistant-mcp-continuation");
    fireEvent.click(retry);
    fireEvent.click(retry);

    await waitFor(() => expect(fixture.askBodies.filter(body => body.mcpContinuation)).toHaveLength(2));
    await waitFor(() => expect(screen.getByTestId("assistant-answer-0")).toHaveTextContent(
      "The connected MCP tool found three matching records.",
    ));
    expect(fixture.savedMessages).toHaveLength(1);
  });

  it("does not resume a dismissed request after a successful settings connection", async () => {
    const fixture = createContinuationFixture("direct");
    vi.stubGlobal("fetch", fixture.fetchMock);
    vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
    renderAssistant();
    await submitMcpRequest();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss MCP connection request" }));
    expect(screen.queryByTestId("assistant-mcp-connection-prompt")).not.toBeInTheDocument();
    await connectMcpFromSettings();

    expect(fixture.askBodies).toHaveLength(1);
    expect(fixture.askBodies.every(body => !body.mcpContinuation)).toBe(true);
  });

  it("does not resume after the coordinator starts a competing question", async () => {
    const fixture = createContinuationFixture("direct");
    vi.stubGlobal("fetch", fixture.fetchMock);
    vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
    renderAssistant();
    await submitMcpRequest();

    fireEvent.change(screen.getByTestId("input-assistant-question"), { target: { value: "A different question" } });
    fireEvent.click(screen.getByTestId("button-ask-assistant"));
    await waitFor(() => expect(fixture.askBodies).toHaveLength(2));
    expect(fixture.askBodies.every(body => !body.mcpContinuation)).toBe(true);
    expect(fixture.savedMessages).toHaveLength(2);
  });

  it("does not resume after switching conversations while the connection prompt is pending", async () => {
    const fixture = createContinuationFixture("direct");
    vi.stubGlobal("fetch", fixture.fetchMock);
    vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
    renderAssistant();
    await submitMcpRequest();

    fireEvent.click(screen.getByTestId("button-assistant-conversation-conv-2"));
    await connectMcpFromSettings();

    expect(fixture.askBodies).toHaveLength(1);
    expect(fixture.askBodies.every(body => !body.mcpContinuation)).toBe(true);
  });

  it("does not resume after the signed-in account changes", async () => {
    const fixture = createContinuationFixture("direct");
    vi.stubGlobal("fetch", fixture.fetchMock);
    vi.spyOn(window, "open").mockReturnValue({
      closed: false,
      location: { href: "" },
      close: vi.fn(),
    } as unknown as Window);
    renderAssistant();
    await submitMcpRequest();

    const statusRequestsBefore = fixture.fetchMock.mock.calls.filter(([input, init]) =>
      new URL(input instanceof Request ? input.url : String(input), window.location.origin).pathname ===
        "/api/assistant/custom-mcp/connection" &&
      init?.method !== "POST",
    ).length;
    queryClient.setQueryData(getGetSessionQueryKey(), {
      authenticated: true,
      label: "Morgan",
      interviewerId: "morgan-id",
      role: "coordinator",
      teamId: "team-2",
    });
    await waitFor(() => expect(fixture.fetchMock.mock.calls.filter(([input, init]) =>
      new URL(input instanceof Request ? input.url : String(input), window.location.origin).pathname ===
        "/api/assistant/custom-mcp/connection" &&
      init?.method !== "POST",
    ).length).toBeGreaterThan(statusRequestsBefore));
    await connectMcpFromSettings();

    expect(fixture.askBodies).toHaveLength(1);
    expect(fixture.askBodies.every(body => !body.mcpContinuation)).toBe(true);
  });
});
