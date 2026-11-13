import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { InterviewChatMessage } from "@workspace/api-client-react";
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
  reactions: NonNullable<InterviewChatMessage["reactions"]>;
  createdAt: string;
  conversationKey: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("/roll, /coin and /spinner chat commands", () => {
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
    vi.restoreAllMocks();
  });

  function installFetchMock() {
    const persistedMessages: StoredMessage[] = [];
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);
      requests.push({ url, init });

      if (url.pathname === "/api/auth/session") {
        return jsonResponse({ authenticated: true, label: "Alex", interviewerId: "alex-id", role: "coordinator" });
      }
      if (url.pathname === "/api/queue" && init?.method !== "POST") {
        return jsonResponse({ interviewerLabels: ["Alex", "Jordan"], currentApplicants: [] });
      }
      if (url.pathname === "/api/queue/chat" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { author: string; message: string; scope?: "shared" | "direct"; recipient?: string | null };
        const saved = {
          id: `decision-${persistedMessages.length + 1}`,
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

  async function waitForComposer() {
    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
  }

  async function runCommandAndPost(draft: string) {
    const input = screen.getByTestId("input-interviewer-chat");
    fireEvent.change(input, { target: { value: draft } });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));
    // The animation overlay opens and owns the composer's "attention"; the
    // admin can dismiss it with the close button to post immediately.
    expect(await screen.findByTestId("decision-overlay")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("decision-close"));
    await waitFor(() => {
      expect(screen.queryByTestId("decision-overlay")).not.toBeInTheDocument();
    });
  }

  it("/roll posts the dice result to chat", async () => {
    const { persistedMessages, requests } = installFetchMock();
    renderPanel();
    await waitForComposer();

    await runCommandAndPost("/roll 2d6");

    const posted = persistedMessages.map(message => message.message).join("\n");
    expect(posted).toMatch(/🎲 Rolled \*\*2d6\*\* — \d, \d = \*\*(\d{1,2})\*\*/);
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST")).toHaveLength(1);
    expect(screen.getByTestId("input-interviewer-chat")).toHaveValue("");
  });

  it("/coin posts a heads/tails result to chat", async () => {
    const { persistedMessages } = installFetchMock();
    renderPanel();
    await waitForComposer();

    await runCommandAndPost("/coin");

    expect(persistedMessages.map(message => message.message).join("\n")).toMatch(/🪙 Coin flip — \*\*(Heads|Tails)\*\*/);
  });

  it("/coin 3 posts the multi-flip summary", async () => {
    const { persistedMessages } = installFetchMock();
    renderPanel();
    await waitForComposer();

    await runCommandAndPost("/coin 3");

    expect(persistedMessages.map(message => message.message).join("\n")).toMatch(/🪙 Coin flip ×3 — [HT], [HT], [HT] → \*\*\d heads?, \d tails?\*\*/);
  });

  it("/spinner with options lands on one of them", async () => {
    const { persistedMessages } = installFetchMock();
    renderPanel();
    await waitForComposer();

    await runCommandAndPost("/spinner pizza, tacos, sushi");

    expect(persistedMessages.map(message => message.message).join("\n")).toMatch(/🎡 Spinner landed on \*\*(pizza|tacos|sushi)\*\* \(from pizza · tacos · sushi\)/);
  });

  it("/spinner without options is a Yes/No wheel", async () => {
    const { persistedMessages } = installFetchMock();
    renderPanel();
    await waitForComposer();

    await runCommandAndPost("/spinner");

    expect(persistedMessages.map(message => message.message).join("\n")).toMatch(/🎡 Spinner landed on \*\*(Yes|No)\*\* \(Yes \/ No spinner\)/);
  });

  it("shows the usage error for a malformed /roll without posting anything", async () => {
    const { persistedMessages, requests } = installFetchMock();
    renderPanel();
    await waitForComposer();

    const input = screen.getByTestId("input-interviewer-chat");
    fireEvent.change(input, { target: { value: "/roll 99d9999" } });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByTestId("chat-error")).toHaveTextContent("Roll at most 8 dice at a time.");
    expect(screen.queryByTestId("decision-overlay")).not.toBeInTheDocument();
    expect(persistedMessages).toHaveLength(0);
    expect(requests.filter(request => request.init?.method === "POST")).toHaveLength(0);
  });

  it("shows the 3D dice animation overlay while /roll is in flight", async () => {
    installFetchMock();
    renderPanel();
    await waitForComposer();

    const input = screen.getByTestId("input-interviewer-chat");
    fireEvent.change(input, { target: { value: "/roll 1d20" } });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByTestId("decision-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("decision-die-0")).toBeInTheDocument();
    expect(screen.getByTestId("decision-result")).toHaveTextContent("…");
    // Dismiss to avoid leaking the auto-post into unrelated tests.
    fireEvent.click(screen.getByTestId("decision-close"));
  });

  it("lists the decision commands in the slash picker", async () => {
    installFetchMock();
    renderPanel();
    await waitForComposer();

    fireEvent.change(screen.getByTestId("input-interviewer-chat"), { target: { value: "/" } });

    const menu = await screen.findByTestId("slash-command-menu");
    expect(menu).toBeVisible();
    expect(screen.getByTestId("slash-command-option-coin")).toHaveTextContent("/coin");
    expect(screen.getByTestId("slash-command-option-roll")).toHaveTextContent("/roll");
    expect(screen.getByTestId("slash-command-option-spinner")).toHaveTextContent("/spinner");
  });
});
