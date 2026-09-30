import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewChatPanel } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";

vi.mock("@google/model-viewer", () => ({}));

type ChatScope = "shared" | "direct";
type StoredMessage = {
  id: string;
  author: string;
  message: string;
  scope: ChatScope;
  peer: string | null;
  parentMessageId: null;
  pinnedAt: null;
  activities: { tool: string; detail: string }[];
  reactions: [];
  createdAt: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AI replies in interviewer chat", () => {
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
  });

  it.each([
    { label: "shared", scope: "shared" as const, answer: "Shared AI answer", peer: null },
    { label: "direct", scope: "direct" as const, answer: "Direct AI answer", peer: "Jordan" },
  ])("saves and displays an @ai reply in $label chat under the signed-in interviewer", async ({ scope, answer, peer }) => {
    const persistedMessages: StoredMessage[] = [];
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);
      requests.push({ url, init });

      if (url.pathname === "/api/auth/session") {
        return jsonResponse({ authenticated: true, label: "Alex", interviewerId: "alex-id" });
      }
      if (url.pathname === "/api/queue" && init?.method !== "POST") {
        return jsonResponse({ interviewerLabels: ["Alex", "Jordan"], currentApplicants: [] });
      }
      if (url.pathname === "/api/queue/chat" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as {
          author: string;
          conversationAuthor?: string;
          message: string;
          scope: ChatScope;
          recipient?: string;
          activities?: { tool: string; detail: string }[];
        };
        if (body.author === "AI assistant" && body.conversationAuthor !== "Alex") {
          return jsonResponse({ error: "Assistant messages must be tied to the signed-in interviewer." }, 403);
        }

        const saved: StoredMessage = {
          id: `ai-chat-${persistedMessages.length + 1}`,
          author: body.author,
          message: body.message,
          scope: body.scope,
          peer: body.scope === "direct" ? body.recipient ?? null : null,
          parentMessageId: null,
          pinnedAt: null,
          activities: body.activities ?? [],
          reactions: [],
          createdAt: "2026-09-30T12:00:00.000Z",
        };
        persistedMessages.push(saved);
        return jsonResponse(saved, 201);
      }
      if (url.pathname === "/api/queue/chat") {
        const requestedScope = (url.searchParams.get("scope") ?? "shared") as ChatScope;
        const requestedPeer = url.searchParams.get("peer");
        const items = persistedMessages.filter(item =>
          item.scope === requestedScope && item.peer === (requestedScope === "direct" ? requestedPeer : null),
        );
        return jsonResponse({ items, scope: requestedScope, peer: requestedScope === "direct" ? requestedPeer : null });
      }
      if (url.pathname === "/api/assistant/ask" && init?.method === "POST") {
        return jsonResponse({ answer, activities: [] });
      }
      if (url.pathname === "/api/diagnostics") return jsonResponse({ ok: true });

      return jsonResponse({ items: [] });
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

    await screen.findByText("Signed in as Alex");
    if (scope === "direct") {
      fireEvent.click(await screen.findByTestId("button-chat-direct-jordan"));
      await screen.findByText("Direct message · Jordan");
    }

    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "@ai Give me a quick read." },
    });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByText(answer)).toBeInTheDocument();
    await waitFor(() => {
      expect(persistedMessages.some(item => item.author === "AI assistant" && item.message === answer)).toBe(true);
    });

    const assistantPost = requests
      .filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST")
      .map(({ init }) => JSON.parse(String(init?.body)) as Record<string, unknown>)
      .find(body => body.author === "AI assistant");
    expect(assistantPost).toMatchObject({
      author: "AI assistant",
      conversationAuthor: "Alex",
      scope,
      ...(peer ? { recipient: peer } : {}),
    });
    expect(persistedMessages.at(-1)).toMatchObject({
      author: "AI assistant",
      message: answer,
      scope,
      peer,
    });
  });
});