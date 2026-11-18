import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { InterviewChatMessage } from "@workspace/api-client-react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewChatPanel } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";

vi.mock("@google/model-viewer", () => ({}));

// Local-time timestamps (no trailing Z) so the assertions are independent of
// the machine's timezone.
const SENT_AT = "2026-09-30T12:00:00";
const SAME_DAY_READ_AT = "2026-09-30T15:30:00";
const CROSS_DAY_READ_AT = "2026-10-02T09:15:00";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("read receipts in chat", () => {
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

  function installFetchMock() {
    const persistedMessages: InterviewChatMessage[] = [{
      id: "msg-1",
      author: "Alex",
      message: "Bring water bottles",
      scope: "shared",
      peer: null,
      parentMessageId: null,
      pinnedAt: null,
      activities: [],
      reactions: [],
      poll: null,
      readBy: [
        { readerId: "jordan-id", readerName: "Jordan", readAt: SAME_DAY_READ_AT },
        { readerId: "sam-id", readerName: "Sam", readAt: CROSS_DAY_READ_AT },
      ],
      editedAt: null,
      deletedAt: null,
      createdAt: SENT_AT,
    }];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);

      if (url.pathname === "/api/auth/session") {
        return jsonResponse({ authenticated: true, label: "Alex", interviewerId: "alex-id", role: "coordinator" });
      }
      if (url.pathname === "/api/chat/settings") {
        return jsonResponse({ slowmodeSeconds: 0, multimessageLimit: 0 });
      }
      if (url.pathname === "/api/queue" && init?.method !== "POST") {
        return jsonResponse({ interviewerLabels: ["Alex", "Jordan", "Sam"], currentApplicants: [] });
      }
      if (url.pathname === "/api/queue/chat/conversations") {
        return jsonResponse({ items: [], shared: null, channels: [] });
      }
      if (url.pathname === "/api/queue/chat/channels") {
        return jsonResponse({ items: [] });
      }
      if (url.pathname === "/api/queue/chat") {
        const scope = (url.searchParams.get("scope") ?? "shared") as InterviewChatMessage["scope"];
        const items = persistedMessages.filter(item => item.scope === scope);
        return jsonResponse({ items, scope, peer: null });
      }
      if (url.pathname === "/api/diagnostics") return jsonResponse({ ok: true });

      return jsonResponse({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
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

  it("shows the date only for receipts read on a different day than the message was sent", async () => {
    installFetchMock();
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    const receipt = await screen.findByTestId("chat-read-by-msg-1");

    // Same-day read: time only, no date.
    expect(receipt.textContent).toMatch(/Jordan · [^,]*(AM|PM|\d{1,2}:\d{2})/);
    expect(receipt.textContent).not.toMatch(/Jordan · [^,]*Sep 30/);
    // Cross-day read: the date is included alongside the time.
    expect(receipt.textContent).toMatch(/Sam · Oct 2,/);
  });
});
