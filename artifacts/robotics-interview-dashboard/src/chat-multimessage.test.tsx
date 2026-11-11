import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewChatPanel } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";

vi.mock("@google/model-viewer", () => ({}));

type StoredMessage = {
  id: string;
  author: string;
  message: string;
  scope: "shared" | "direct";
  peer: string | null;
  parentMessageId: null;
  pinnedAt: null;
  activities: { tool: string; detail: string }[];
  reactions: [];
  createdAt: string;
  conversationKey: string | null;
  editedAt?: null;
  deletedAt?: null;
  poll?: null;
  readBy?: [];
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("/multimessage chat command", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ autoRefresh: false, realtime: true }));
    window.history.replaceState({}, "", "/chat");
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
  });

  function installFetchMock(role: string) {
    const persistedMessages: StoredMessage[] = [];
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);
      requests.push({ url, init });

      if (url.pathname === "/api/auth/session") {
        return jsonResponse({ authenticated: true, label: "Alex", interviewerId: "alex-id", role });
      }
      if (url.pathname === "/api/queue" && init?.method !== "POST") {
        return jsonResponse({ interviewerLabels: ["Alex", "Jordan"], currentApplicants: [] });
      }
      if (url.pathname === "/api/queue/chat/multimessage" && init?.method === "POST") {
        if (role !== "coordinator" && role !== "admin") {
          return jsonResponse({ error: "Admins only" }, 403);
        }
        const body = JSON.parse(String(init.body)) as {
          message: string;
          count: number;
          scope?: "shared" | "direct";
          recipient?: string | null;
        };
        for (let index = 0; index < body.count; index += 1) {
          persistedMessages.push({
            id: `multi-${persistedMessages.length + 1}`,
            author: "Alex",
            message: body.message,
            scope: body.scope ?? "shared",
            peer: body.scope === "direct" ? body.recipient ?? null : null,
            parentMessageId: null,
            pinnedAt: null,
            activities: [],
            reactions: [],
            createdAt: "2026-09-30T12:00:00.000Z",
            conversationKey: null,
          });
        }
        return jsonResponse({ sent: body.count }, 201);
      }
      if (url.pathname === "/api/queue/chat" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { author: string; message: string; scope?: "shared" | "direct"; recipient?: string | null };
        const saved = {
          id: `regular-${persistedMessages.length + 1}`,
          author: body.author,
          message: body.message,
          scope: body.scope ?? "shared",
          peer: null,
          parentMessageId: null,
          pinnedAt: null,
          editedAt: null,
          deletedAt: null,
          activities: [],
          reactions: [],
          poll: null,
          readBy: [],
          createdAt: "2026-09-30T12:00:00.000Z",
        };
        persistedMessages.push({ ...saved, conversationKey: null });
        return jsonResponse(saved, 201);
      }
      if (url.pathname === "/api/queue/chat") {
        const scope = (url.searchParams.get("scope") ?? "shared") as "shared" | "direct";
        const items = persistedMessages.filter(item => item.scope === scope);
        return jsonResponse({ items, scope, peer: null });
      }
      if (url.pathname === "/api/diagnostics") return jsonResponse({ ok: true });

      return jsonResponse({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    return { persistedMessages, requests };
  }

  function renderPanel() {
    return render(
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
  }

  it.each(["coordinator", "admin"])("posts the requested number of copies for a %s", async (role) => {
    const { persistedMessages, requests } = installFetchMock(role);
    renderPanel();

    // Wait until the session resolves (label appears): the chat draft effect resets the composer when the session-derived draft key changes, so typing before it settles would be wiped.
    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "/multimessage 3 Go team" },
    });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByTestId("multimessage-notice")).toHaveTextContent("Posted 3 copies of your message.");
    const bulkRequests = requests.filter(request => request.url.pathname === "/api/queue/chat/multimessage");
    expect(bulkRequests).toHaveLength(1);
    expect(JSON.parse(String(bulkRequests[0].init?.body))).toMatchObject({
      message: "Go team",
      count: 3,
      scope: "shared",
    });
    // The bulk path must not go through the ordinary single-message endpoint.
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST")).toHaveLength(0);
    expect(persistedMessages).toHaveLength(3);
    expect(await screen.findAllByText("Go team")).toHaveLength(3);
    expect(screen.getByTestId("input-interviewer-chat")).toHaveValue("");
  });

  it("blocks non-admins without sending anything", async () => {
    const { requests } = installFetchMock("interviewer");
    renderPanel();

    // Wait until the session resolves (label appears): the chat draft effect resets the composer when the session-derived draft key changes, so typing before it settles would be wiped.
    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "/multimessage 5 Go team" },
    });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByTestId("chat-error")).toHaveTextContent("Only admins can use /multimessage.");
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat/multimessage")).toHaveLength(0);
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST")).toHaveLength(0);
  });

  it.each([
    { draft: "/multimessage Go team", expected: "Usage: /multimessage <count> <message>" },
    { draft: "/multimessage 0 Go team", expected: "Count must be a whole number of at least 1." },
    { draft: "/multimessage 3", expected: "Add a message to send" },
  ])("shows a usage error for \"$draft\" without sending", async ({ draft, expected }) => {
    const { requests } = installFetchMock("coordinator");
    renderPanel();

    // Wait until the session resolves (label appears): the chat draft effect resets the composer when the session-derived draft key changes, so typing before it settles would be wiped.
    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: draft },
    });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByTestId("chat-error")).toHaveTextContent(expected);
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat/multimessage")).toHaveLength(0);
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST")).toHaveLength(0);
  });

  it("does not route ordinary messages through the bulk endpoint", async () => {
    const { requests } = installFetchMock("coordinator");
    renderPanel();

    // Wait until the session resolves (label appears): the chat draft effect resets the composer when the session-derived draft key changes, so typing before it settles would be wiped.
    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "Go team" },
    });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    await waitFor(() => {
      expect(requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST")).toHaveLength(1);
    });
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat/multimessage")).toHaveLength(0);
  });
});
