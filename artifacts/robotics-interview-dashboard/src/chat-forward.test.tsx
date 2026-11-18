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
  scope: "shared" | "direct" | "channel";
  peer: string | null;
  channelId?: string | null;
  parentMessageId: null;
  pinnedAt: null;
  activities: { tool: string; detail: string }[];
  reactions: NonNullable<InterviewChatMessage["reactions"]>;
  poll: InterviewChatMessage["poll"];
  readBy: InterviewChatMessage["readBy"];
  editedAt: null;
  deletedAt: null;
  createdAt: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const SEED_MESSAGE = "Go team\n\nbring water bottles";

describe("forward messages in chat", () => {
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

  function installFetchMock({ withChannel = false, withPoll = false }: { withChannel?: boolean; withPoll?: boolean } = {}) {
    const persistedMessages: StoredMessage[] = [{
      id: "msg-1",
      author: "Alex",
      message: SEED_MESSAGE,
      scope: "shared",
      peer: null,
      parentMessageId: null,
      pinnedAt: null,
      activities: [],
      reactions: [],
      poll: withPoll
        ? {
            messageId: "msg-1",
            question: "Bring water?",
            options: [
              { index: 0, text: "Yes", votes: 2 },
              { index: 1, text: "No", votes: 1 },
            ],
            totalVotes: 3,
            yourVote: null,
            createdBy: "Alex",
          }
        : null,
      readBy: [],
      editedAt: null,
      deletedAt: null,
      createdAt: "2026-09-30T12:00:00.000Z",
    }];
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);
      requests.push({ url, init });

      if (url.pathname === "/api/auth/session") {
        return jsonResponse({ authenticated: true, label: "Alex", interviewerId: "alex-id", role: "coordinator" });
      }
      if (url.pathname === "/api/chat/settings") {
        return jsonResponse({ slowmodeSeconds: 0, multimessageLimit: 0 });
      }
      if (url.pathname === "/api/queue" && init?.method !== "POST") {
        return jsonResponse({ interviewerLabels: ["Alex", "Jordan"], currentApplicants: [] });
      }
      if (url.pathname === "/api/queue/chat/conversations") {
        return jsonResponse({
          items: [],
          shared: null,
          channels: withChannel
            ? [{ channelId: "chan-1", channelName: "Build captains", channelEmoji: null, lastMessageAt: "2026-09-30T12:00:00.000Z", lastMessageAuthor: "Jordan", lastMessage: "hi", isUnread: false }]
            : [],
        });
      }
      if (url.pathname === "/api/queue/chat/channels") {
        return jsonResponse({
          items: withChannel
            ? [{ id: "chan-1", name: "Build captains", emoji: null, createdBy: "Alex", createdAt: "2026-09-30T12:00:00.000Z", updatedAt: "2026-09-30T12:00:00.000Z", members: [], youAreMember: true, canManage: true, lastMessageAt: null }]
            : [],
        });
      }
      if (url.pathname === "/api/queue/chat" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { author: string; message: string; scope?: "shared" | "direct" | "channel"; recipient?: string | null; channelId?: string | null };
        const saved = {
          id: `forwarded-${persistedMessages.length + 1}`,
          author: body.author,
          message: body.message,
          scope: body.scope ?? "shared",
          peer: body.scope === "direct" ? body.recipient ?? null : body.channelId ?? null,
          channelId: body.channelId ?? null,
          parentMessageId: null,
          pinnedAt: null,
          editedAt: null,
          deletedAt: null,
          activities: [],
          reactions: [],
          poll: null,
          readBy: [],
          createdAt: "2026-09-30T12:05:00.000Z",
        };
        persistedMessages.push(saved);
        return jsonResponse(saved, 201);
      }
      if (url.pathname === "/api/queue/chat") {
        const scope = (url.searchParams.get("scope") ?? "shared") as "shared" | "direct" | "channel";
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

  it("forwards a message to a direct conversation with attribution", async () => {
    const { requests } = installFetchMock();
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    await screen.findByText("bring water bottles");

    fireEvent.click(screen.getByTestId("button-forward-msg-1"));

    const dialog = await screen.findByTestId("chat-forward-dialog");
    expect(dialog).toBeVisible();
    // The conversation being viewed cannot be a forward destination.
    expect(screen.getByTestId("forward-destination-team")).toBeDisabled();

    fireEvent.click(screen.getByTestId("forward-destination-direct:Jordan"));
    fireEvent.click(screen.getByTestId("button-confirm-forward"));

    expect(await screen.findByTestId("forward-notice")).toHaveTextContent("Forwarded Alex's message to Direct message · Jordan.");

    const posts = requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST");
    expect(posts).toHaveLength(1);
    const body = JSON.parse(String(posts[0].init?.body)) as { scope?: string; recipient?: string | null; message: string };
    expect(body.scope).toBe("direct");
    expect(body.recipient).toBe("Jordan");
    expect(body.message).toBe(`**Forwarded from Alex · Team conversation**\n${SEED_MESSAGE}`);
    // The dialog closes after a successful forward.
    expect(screen.queryByTestId("chat-forward-dialog")).not.toBeInTheDocument();
  });

  it("forwards a poll message to an invite-only channel and summarizes the options", async () => {
    const { requests } = installFetchMock({ withChannel: true, withPoll: true });
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    await screen.findByText("bring water bottles");

    fireEvent.click(screen.getByTestId("button-forward-msg-1"));
    await screen.findByTestId("chat-forward-dialog");

    fireEvent.click(screen.getByTestId("forward-destination-channel:chan-1"));
    fireEvent.click(screen.getByTestId("button-confirm-forward"));

    expect(await screen.findByTestId("forward-notice")).toHaveTextContent("Forwarded Alex's message to # Build captains.");

    const posts = requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST");
    expect(posts).toHaveLength(1);
    const body = JSON.parse(String(posts[0].init?.body)) as { scope?: string; channelId?: string | null; message: string };
    expect(body.scope).toBe("channel");
    expect(body.channelId).toBe("chan-1");
    expect(body.message).toContain("**Forwarded from Alex · Team conversation**");
    expect(body.message).toContain("**Poll options:** Yes · No");
    expect(body.message).toContain(SEED_MESSAGE);
  });

  it("requires picking a destination and surfaces send failures inside the dialog", async () => {
    installFetchMock();
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    await screen.findByText("bring water bottles");

    fireEvent.click(screen.getByTestId("button-forward-msg-1"));
    await screen.findByTestId("chat-forward-dialog");

    // The pre-selected first available destination matches the radio check.
    expect(screen.getByTestId("forward-destination-direct:Jordan")).toHaveAttribute("aria-checked", "true");
    // The preview shows who authored the original message.
    expect(screen.getByTestId("forward-preview")).toHaveTextContent("From Alex");
  });
});
