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
  editedAt?: null;
  deletedAt?: null;
  poll?: null;
  readBy?: InterviewChatMessage["readBy"];
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

  it("spaces copies when {delayMs} is given and keeps the composer usable", async () => {
    const { persistedMessages, requests } = installFetchMock("coordinator");
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    const input = screen.getByTestId("input-interviewer-chat");
    const sendButton = screen.getByTestId("button-send-interviewer-chat");
    fireEvent.change(input, {
      target: { value: "/multimessage {120} 3 Go team" },
    });
    const startedAt = performance.now();
    fireEvent.click(sendButton);

    // The draft is consumed immediately; the run never blocks the composer —
    // typing a new draft re-enables send while copies are still pending.
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { value: "draft typed while running" } });
    await waitFor(() => expect(sendButton).not.toBeDisabled());
    await waitFor(
      () => expect(screen.getByTestId("multimessage-notice")).toHaveTextContent("Posted 3 copies of your message."),
      { timeout: 3000 },
    );
    // Two intervals at {120} ms must have elapsed — the copies really were spaced out.
    expect(performance.now() - startedAt).toBeGreaterThanOrEqual(200);

    const bulkRequests = requests.filter(request => request.url.pathname === "/api/queue/chat/multimessage");
    expect(bulkRequests).toHaveLength(3);
    for (const request of bulkRequests) {
      expect(JSON.parse(String(request.init?.body))).toMatchObject({ message: "Go team", count: 1, scope: "shared" });
    }
    expect(persistedMessages).toHaveLength(3);
  });

  it("lets the admin send another message while a spaced run is in flight", async () => {
    const { persistedMessages, requests } = installFetchMock("coordinator");
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    const input = screen.getByTestId("input-interviewer-chat");
    const sendButton = screen.getByTestId("button-send-interviewer-chat");
    fireEvent.change(input, {
      target: { value: "/multimessage {150} 2 Go team" },
    });
    fireEvent.click(sendButton);

    // While copies are pending, an ordinary message can be typed and sent.
    expect(input).toHaveValue("");
    fireEvent.change(input, { target: { value: "Meanwhile, a normal message" } });
    await waitFor(() => expect(sendButton).not.toBeDisabled());
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST")).toHaveLength(1);
    });
    await waitFor(
      () => expect(screen.getByTestId("multimessage-notice")).toHaveTextContent("Posted 2 copies of your message."),
      { timeout: 3000 },
    );
    expect(persistedMessages.filter(message => message.message === "Go team")).toHaveLength(2);
    expect(persistedMessages.filter(message => message.message === "Meanwhile, a normal message")).toHaveLength(1);
  });

  it("{0} posts every copy at once through the bulk endpoint", async () => {
    const { requests } = installFetchMock("coordinator");
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "/multimessage {0} 3 Go team" },
    });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByTestId("multimessage-notice")).toHaveTextContent("Posted 3 copies of your message.");
    const bulkRequests = requests.filter(request => request.url.pathname === "/api/queue/chat/multimessage");
    expect(bulkRequests).toHaveLength(1);
    expect(JSON.parse(String(bulkRequests[0].init?.body))).toMatchObject({ message: "Go team", count: 3 });
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
    { draft: "/multimessage Go team", expected: "Usage: /multimessage [{delayMs}] <count> <message>" },
    { draft: "/multimessage {99999999999999999999} 2 Go team", expected: "Delay must be a whole number of milliseconds" },
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

  describe("slash command picker", () => {
    it("opens when the draft starts with / and lists the available commands", async () => {
      installFetchMock("coordinator");
      renderPanel();

      await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
      fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
        target: { value: "/" },
      });

      const menu = await screen.findByTestId("slash-command-menu");
      expect(menu).toBeVisible();
      expect(menu).toHaveClass("dark:bg-[#10212b]");
      expect(menu).toHaveClass("dark:border-[#355663]");
      const option = screen.getByTestId("slash-command-option-multimessage");
      expect(option).toHaveTextContent("/multimessage");
      expect(option).toHaveClass("dark:bg-[#1d3a47]");
      expect(screen.getByTestId("slash-command-admin-badge-multimessage")).toHaveTextContent("Admins");
    });

    it("filters the list as the command name is typed", async () => {
      installFetchMock("coordinator");
      renderPanel();

      await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
      const input = screen.getByTestId("input-interviewer-chat");
      fireEvent.change(input, { target: { value: "/zzz" } });

      const menu = await screen.findByTestId("slash-command-menu");
      expect(menu).toHaveTextContent("No matching commands.");
      expect(screen.queryByTestId("slash-command-option-multimessage")).not.toBeInTheDocument();
    });

    it("closes the picker and inserts the command when Tab is pressed", async () => {
      installFetchMock("coordinator");
      renderPanel();

      await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
      const input = screen.getByTestId("input-interviewer-chat");
      fireEvent.change(input, { target: { value: "/mul" } });
      await screen.findByTestId("slash-command-menu");

      fireEvent.keyDown(input, { key: "Tab" });

      expect(input).toHaveValue("/multimessage ");
      expect(screen.queryByTestId("slash-command-menu")).not.toBeInTheDocument();
    });

    it("inserts the command on Enter without submitting the message", async () => {
      const { requests } = installFetchMock("coordinator");
      renderPanel();

      await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
      const input = screen.getByTestId("input-interviewer-chat");
      fireEvent.change(input, { target: { value: "/mul" } });
      await screen.findByTestId("slash-command-menu");

      fireEvent.keyDown(input, { key: "Enter" });

      expect(input).toHaveValue("/multimessage ");
      expect(requests.filter(request => request.init?.method === "POST")).toHaveLength(0);
    });

    it("clicking a command inserts it and closes the picker", async () => {
      installFetchMock("interviewer");
      renderPanel();

      await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
      const input = screen.getByTestId("input-interviewer-chat");
      fireEvent.change(input, { target: { value: "/" } });

      fireEvent.click(await screen.findByTestId("slash-command-option-multimessage"));

      expect(input).toHaveValue("/multimessage ");
      expect(screen.queryByTestId("slash-command-menu")).not.toBeInTheDocument();
    });

    it("closes the picker once a space is typed (arguments mode) and on Escape", async () => {
      installFetchMock("coordinator");
      renderPanel();

      await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
      const input = screen.getByTestId("input-interviewer-chat");
      fireEvent.change(input, { target: { value: "/multimessage 5 Go team" } });
      expect(screen.queryByTestId("slash-command-menu")).not.toBeInTheDocument();

      fireEvent.change(input, { target: { value: "/" } });
      await screen.findByTestId("slash-command-menu");
      fireEvent.keyDown(input, { key: "Escape" });
      expect(screen.queryByTestId("slash-command-menu")).not.toBeInTheDocument();
    });
  });
});
