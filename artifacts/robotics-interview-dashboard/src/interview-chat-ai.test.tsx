import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { getGetInterviewChatQueryKey, useGetInterviewChat } from "@workspace/api-client-react";
import type { GetInterviewChatParams } from "@workspace/api-client-react";
import { useRealtimeSync } from "./useRealtimeSync";
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
  conversationKey: string | null;
};

type MockEventSource = {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close: ReturnType<typeof vi.fn>;
};
const eventSources: MockEventSource[] = [];

function canonicalPair(left: string, right: string) {
  return [left, right].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())).join("\u001f");
}

function RealtimeChatObserver({ testId, params }: { testId: string; params: GetInterviewChatParams }) {
  const chat = useGetInterviewChat(params, {
    query: { queryKey: getGetInterviewChatQueryKey(params), refetchInterval: false },
  });
  useRealtimeSync(true);
  return (
    <section data-testid={testId}>
      {chat.data?.items.map(item => <p key={item.id}>{item.message}</p>)}
    </section>
  );
}

function RealtimeChatObserverProvider({
  queryClient,
  testId,
  params,
}: {
  queryClient: QueryClient;
  testId: string;
  params: GetInterviewChatParams;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <RealtimeChatObserver testId={testId} params={params} />
      </SettingsProvider>
    </QueryClientProvider>
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("AI replies in interviewer chat", () => {
  let queryClient: QueryClient;
  let observerQueryClients: QueryClient[];

  beforeEach(() => {
    eventSources.length = 0;
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    observerQueryClients = [];
    window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ autoRefresh: false, realtime: true }));
    window.history.replaceState({}, "", "/chat");
  });

  afterEach(() => {
    queryClient.clear();
    for (const client of observerQueryClients) client.clear();
    eventSources.length = 0;
    vi.unstubAllGlobals();
  });

  it.each([
    { label: "shared", scope: "shared" as const, peer: null },
    { label: "direct", scope: "direct" as const, peer: "Jordan" },
  ])("saves and displays an @ai reply in $label chat under the signed-in interviewer", async ({ scope, peer }) => {
    const answerLabel = scope === "shared" ? "Shared AI answer" : "Direct AI answer";
    const miniTool = {
      type: "checklist",
      title: "Build checklist",
      items: ["Check the wheels"],
    };
    const answer = [
      answerLabel,
      "Generated response detail. ".repeat(120),
      "![Generated image](/api/storage/objects/generated-image)",
      "[brief.pdf](/api/storage/objects/brief.pdf)",
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>',
      "```robotics-mini-tool",
      JSON.stringify(miniTool),
      "```",
    ].join("\n\n");
    const persistedMessages: StoredMessage[] = [];
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    const eventSourceConstructor = vi.fn(function MockEventSource() {
      const source: MockEventSource = { onmessage: null, onerror: null, close: vi.fn() };
      eventSources.push(source);
      return source;
    });
    vi.stubGlobal("EventSource", eventSourceConstructor);
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
          idempotencyKey?: string;
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
          conversationKey: body.scope === "direct"
            ? canonicalPair(body.conversationAuthor ?? body.author, body.recipient ?? "")
            : null,
        };
        persistedMessages.push(saved);
        return jsonResponse(saved, 201);
      }
      if (url.pathname === "/api/queue/chat") {
        const requestedScope = (url.searchParams.get("scope") ?? "shared") as ChatScope;
        const requestedAuthor = url.searchParams.get("author") ?? "Alex";
        const requestedPeer = url.searchParams.get("peer");
        const conversationKey = requestedScope === "direct" && requestedPeer
          ? canonicalPair(requestedAuthor, requestedPeer)
          : null;
        const items = persistedMessages.filter(item =>
          item.scope === requestedScope &&
          (requestedScope === "direct" ? item.conversationKey === conversationKey : item.conversationKey === null),
        ).map(item => ({
          ...item,
          peer: requestedScope === "direct" ? requestedPeer : null,
        }));
        return jsonResponse({ items, scope: requestedScope, peer: requestedScope === "direct" ? requestedPeer : null });
      }
      if (url.pathname === "/api/assistant/ask" && init?.method === "POST") {
        return jsonResponse({ answer, activities: [] });
      }
      if (url.pathname === "/api/diagnostics") return jsonResponse({ ok: true });

      return jsonResponse({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    const clipboardWrite = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", { value: { writeText: clipboardWrite }, configurable: true });

    const observerSessions = scope === "shared"
      ? [{ testId: "chat-observer-jordan", params: { limit: 50, scope: "shared" as const, author: "Jordan" } }]
      : [
          { testId: "chat-observer-jordan", params: { limit: 50, scope: "direct" as const, author: "Jordan", peer: "Alex" } },
          { testId: "chat-observer-casey", params: { limit: 50, scope: "direct" as const, author: "Casey", peer: "Alex" } },
        ];
    const observers = observerSessions.map(session => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
      });
      observerQueryClients.push(client);
      return <RealtimeChatObserverProvider key={session.testId} queryClient={client} {...session} />;
    });

    render(
      <>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <SettingsProvider>
              <WouterRouter>
                <InterviewChatPanel applicantIds={[]} />
              </WouterRouter>
            </SettingsProvider>
          </TooltipProvider>
        </QueryClientProvider>
        {observers}
      </>,
    );

    await screen.findByText("Signed in as Alex");
    for (const session of observerSessions) {
      await screen.findByTestId(session.testId);
      await waitFor(() => {
        expect(requests.some(request =>
          request.url.pathname === "/api/queue/chat" &&
          request.url.searchParams.get("author") === session.params.author,
        )).toBe(true);
      });
    }
    if (scope === "direct") {
      fireEvent.click(await screen.findByTestId("button-chat-direct-jordan"));
      await screen.findByText("Direct message · Jordan");
    }

    // EventSource reconnects after an error without the application closing it.
    // The following hint models delivery once that same stream is connected again.
    if (scope === "shared") {
      for (const source of eventSources) source.onerror?.(new Event("error"));
      expect(eventSources.every(source => source.close.mock.calls.length === 0)).toBe(true);
    }

    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "@ai Give me a quick read." },
    });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByText(answerLabel)).toBeInTheDocument();
    expect(await screen.findByTestId("chat-mini-tool")).toHaveTextContent("Build checklist");
    await waitFor(() => {
      expect(persistedMessages.some(item => item.author === "AI assistant" && item.message === answer)).toBe(true);
    });
    const chatRefetchesBeforeHint = requests.filter(request =>
      request.url.pathname === "/api/queue/chat" &&
      request.url.searchParams.get("author") !== "Alex",
    ).length;
    await act(async () => {
      for (const source of eventSources) {
        source.onmessage?.({
          data: JSON.stringify({ table: "interview_chat_messages", event: "INSERT" }),
        } as MessageEvent<string>);
      }
    });
    expect(await within(screen.getByTestId("chat-observer-jordan")).findByText(
      content => content.startsWith(answerLabel),
    )).toBeInTheDocument();
    await waitFor(() => {
      expect(requests.filter(request =>
        request.url.pathname === "/api/queue/chat" &&
        request.url.searchParams.get("author") !== "Alex",
      ).length).toBeGreaterThan(chatRefetchesBeforeHint);
    });
    if (scope === "direct") {
      expect(screen.getByTestId("chat-observer-casey")).not.toHaveTextContent(answer);
      await waitFor(() => {
        expect(requests.filter(request =>
          request.url.pathname === "/api/queue/chat" &&
          request.url.searchParams.get("author") === "Casey",
        ).length).toBeGreaterThan(1);
      });
    }

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
    expect(assistantPost?.idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i);
    const assistantAsk = requests
      .filter(request => request.url.pathname === "/api/assistant/ask" && request.init?.method === "POST")
      .map(({ init }) => JSON.parse(String(init?.body)) as Record<string, unknown>)[0];
    expect(assistantAsk?.chatContext).toEqual(expect.arrayContaining([
      expect.objectContaining({ author: "Alex", message: "@ai Give me a quick read." }),
    ]));
    expect(persistedMessages.at(-1)).toMatchObject({
      author: "AI assistant",
      message: answer,
      scope,
      peer,
    });

    const copyButton = await screen.findByLabelText("Copy response");
    fireEvent.click(copyButton);
    await waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(answer));
  });

  it("retries an ambiguously failed AI reply without resending the prompt or duplicating the answer", async () => {
    const answer = [
      "Generated answer survives retry",
      "Response detail. ".repeat(160),
      "![Generated image](/api/storage/objects/generated-image)",
      "```robotics-mini-tool",
      JSON.stringify({
        type: "counter",
        title: "Parts count",
        label: "Motors",
        initial: 1,
        step: 1,
        min: 0,
        max: 12,
      }),
      "```",
    ].join("\n\n");
    const activities = [{ tool: "applicant_lookup", detail: "Reviewed the active roster" }];
    const persistedMessages: StoredMessage[] = [];
    const assistantPosts: Array<Record<string, unknown>> = [];
    const userPosts: Array<Record<string, unknown>> = [];
    let assistantAttempts = 0;
    const savedByKey = new Map<string, StoredMessage>();
    const eventSourceConstructor = vi.fn(function MockEventSource() {
      const source: MockEventSource = { onmessage: null, onerror: null, close: vi.fn() };
      eventSources.push(source);
      return source;
    });
    vi.stubGlobal("EventSource", eventSourceConstructor);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);
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
          idempotencyKey?: string;
        };
        if (body.author === "AI assistant") {
          assistantPosts.push(body);
          assistantAttempts += 1;
          const key = body.idempotencyKey ?? "";
          let saved = savedByKey.get(key);
          if (!saved) {
            saved = {
              id: key,
              author: body.author,
              message: body.message,
              scope: body.scope,
              peer: body.scope === "direct" ? body.recipient ?? null : null,
              parentMessageId: null,
              pinnedAt: null,
              activities: body.activities ?? [],
              reactions: [],
              createdAt: "2026-09-30T12:00:00.000Z",
              conversationKey: body.scope === "direct"
                ? canonicalPair(body.conversationAuthor ?? body.author, body.recipient ?? "")
                : null,
            };
            savedByKey.set(key, saved);
            persistedMessages.push(saved);
          }
          // The first request commits but loses its response; the first retry
          // also loses its response after reading the already-saved row.
          if (assistantAttempts <= 2) throw new TypeError("Failed to fetch");
          return jsonResponse(saved, 200);
        }
        userPosts.push(body);
        const saved: StoredMessage = {
          id: `user-${userPosts.length}`,
          author: body.author,
          message: body.message,
          scope: body.scope,
          peer: body.scope === "direct" ? body.recipient ?? null : null,
          parentMessageId: null,
          pinnedAt: null,
          activities: [],
          reactions: [],
          createdAt: "2026-09-30T12:00:00.000Z",
          conversationKey: body.scope === "direct"
            ? canonicalPair(body.author, body.recipient ?? "")
            : null,
        };
        persistedMessages.push(saved);
        return jsonResponse(saved, 201);
      }
      if (url.pathname === "/api/queue/chat") {
        const requestedScope = (url.searchParams.get("scope") ?? "shared") as ChatScope;
        const requestedAuthor = url.searchParams.get("author") ?? "Alex";
        const requestedPeer = url.searchParams.get("peer");
        const conversationKey = requestedScope === "direct" && requestedPeer
          ? canonicalPair(requestedAuthor, requestedPeer)
          : null;
        const items = persistedMessages.filter(item =>
          item.scope === requestedScope &&
          (requestedScope === "direct" ? item.conversationKey === conversationKey : item.conversationKey === null),
        ).map(item => ({
          ...item,
          peer: requestedScope === "direct" ? requestedPeer : null,
        }));
        return jsonResponse({ items, scope: requestedScope, peer: requestedScope === "direct" ? requestedPeer : null });
      }
      if (url.pathname === "/api/assistant/ask" && init?.method === "POST") {
        return jsonResponse({ answer, activities });
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
    fireEvent.click(await screen.findByTestId("button-chat-direct-jordan"));
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "@ai Give me a quick read." },
    });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    expect(await screen.findByTestId("button-retry-ai-reply")).toBeInTheDocument();
    expect(screen.getByTestId("ai-reply-retry")).toHaveTextContent("Your prompt is already in chat");
    expect(assistantPosts).toHaveLength(1);
    expect(userPosts).toHaveLength(1);

    fireEvent.click(screen.getByTestId("button-chat-team"));
    fireEvent.click(screen.getByTestId("button-retry-ai-reply"));
    expect(await screen.findByTestId("ai-reply-retry-error")).toHaveTextContent("Retry failed");
    fireEvent.click(screen.getByTestId("button-retry-ai-reply"));
    expect(await screen.findByTestId("ai-reply-retry-success")).toHaveTextContent("direct chat with Jordan");

    expect(assistantPosts).toHaveLength(3);
    expect(new Set(assistantPosts.map(post => post.idempotencyKey)).size).toBe(1);
    for (const post of assistantPosts) {
      expect(post).toMatchObject({
        author: "AI assistant",
        conversationAuthor: "Alex",
        message: answer,
        scope: "direct",
        recipient: "Jordan",
        activities,
      });
    }
    expect(userPosts).toHaveLength(1);
    expect(userPosts[0]).toMatchObject({
      author: "Alex",
      message: "@ai Give me a quick read.",
      scope: "direct",
      recipient: "Jordan",
    });
    expect(persistedMessages.filter(item => item.author === "AI assistant" && item.message === answer)).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([input]) =>
      new URL(input instanceof Request ? input.url : String(input), window.location.origin).pathname === "/api/assistant/ask",
    )).toHaveLength(1);
  });
});