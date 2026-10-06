import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewChatPanel } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";
import { DialogHost } from "@/lib/dialogs";

vi.mock("@google/model-viewer", () => ({}));

type StoredMessage = {
  id: string;
  author: string;
  message: string;
  scope: "shared";
  peer: null;
  parentMessageId: null;
  pinnedAt: null;
  activities: [];
  reactions: [];
  createdAt: string;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("chat attachment round trip", () => {
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
    vi.restoreAllMocks();
  });

  it("uploads a document and media file, persists their paths, and reloads authenticated inline previews", async () => {
    const persistedMessages: StoredMessage[] = [];
    const uploadedFiles = new Map<string, { body: Blob; contentType: string }>();
    const requests: Array<{ url: URL; init?: RequestInit }> = [];
    let uploadNumber = 0;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);
      requests.push({ url, init });

      if (url.pathname === "/api/queue/chat" && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { author: string; message: string; scope: "shared" };
        const saved: StoredMessage = {
          id: "message-attachment-roundtrip",
          author: body.author,
          message: body.message,
          scope: body.scope,
          peer: null,
          parentMessageId: null,
          pinnedAt: null,
          activities: [],
          reactions: [],
          createdAt: "2026-09-30T12:00:00.000Z",
        };
        persistedMessages.push(saved);
        return jsonResponse(saved, 201);
      }

      if (url.pathname === "/api/queue/chat") {
        return jsonResponse({ items: [...persistedMessages], scope: "shared", peer: null });
      }

      if (url.pathname === "/api/storage/uploads" && init?.method === "POST") {
        const body = init.body;
        if (!(body instanceof Blob)) throw new Error("Chat upload did not send the file bytes.");
        const objectId = `chat-attachment-${++uploadNumber}`;
        const contentType = new Headers(init.headers).get("Content-Type") ?? body.type;
        uploadedFiles.set(objectId, { body, contentType });
        return jsonResponse({ objectPath: `/objects/${objectId}` });
      }

      const objectMatch = url.pathname.match(/^\/api\/storage\/objects\/([^/]+)$/);
      if (objectMatch && init?.method !== "DELETE") {
        const file = uploadedFiles.get(objectMatch[1]);
        if (!file) return jsonResponse({ error: "Object not found" }, 404);
        return new Response(file.body, {
          status: 200,
          headers: { "Content-Type": file.contentType },
        });
      }

      if (url.pathname === "/api/diagnostics") return jsonResponse({ ok: true });

      // Other panel queries (session, queue, whiteboards, and mentions) are
      // not part of this flow and only need an empty successful response.
      return jsonResponse({ items: [], interviewerLabels: [] });
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

    const pdf = new File(["%PDF-1.4\nRobotics interview brief"], "brief.pdf", { type: "application/pdf" });
    const audio = new File(["ID3 robotics audio fixture"], "interview.mp3", { type: "audio/mpeg" });
    fireEvent.change(screen.getByTestId("input-chat-image"), { target: { files: [pdf, audio] } });
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "Please review these interview materials." },
    });

    await screen.findByText("brief.pdf");
    await screen.findByText("interview.mp3");
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    await waitFor(() => {
      expect(screen.getByTitle("brief.pdf")).toBeInTheDocument();
      expect(document.querySelector("audio[controls]")).toBeInTheDocument();
    });

    const uploadRequests = requests.filter(request =>
      request.url.pathname === "/api/storage/uploads" && request.init?.method === "POST",
    );
    expect(uploadRequests).toHaveLength(2);
    expect(uploadRequests.map(({ init }) => new Headers(init?.headers).get("Content-Type"))).toEqual([
      "application/pdf",
      "audio/mpeg",
    ]);
    expect(await (uploadRequests[0].init?.body as Blob).text()).toContain("Robotics interview brief");
    expect(await (uploadRequests[1].init?.body as Blob).text()).toContain("robotics audio fixture");

    const chatPost = requests.find(request =>
      request.url.pathname === "/api/queue/chat" && request.init?.method === "POST",
    );
    expect(chatPost).toBeDefined();
    const postedBody = JSON.parse(String(chatPost?.init?.body)) as { message: string; scope: string };
    expect(postedBody.scope).toBe("shared");
    expect(postedBody.message).toContain("Please review these interview materials.");
    expect(postedBody.message).toContain("[brief.pdf](/api/storage/objects/chat-attachment-1)");
    expect(postedBody.message).toContain("[interview.mp3](/api/storage/objects/chat-attachment-2)");

    expect(persistedMessages).toHaveLength(1);
    expect(requests.filter(request =>
      request.url.pathname === "/api/queue/chat" && request.init?.method === "GET",
    ).length).toBeGreaterThanOrEqual(2);

    const authenticatedPreviewRequests = requests.filter(request =>
      request.url.pathname.startsWith("/api/storage/objects/") && request.init?.method !== "DELETE",
    );
    expect(authenticatedPreviewRequests.map(request => request.url.pathname)).toEqual(
      expect.arrayContaining([
        "/api/storage/objects/chat-attachment-1",
        "/api/storage/objects/chat-attachment-2",
      ]),
    );
    expect(authenticatedPreviewRequests.every(request => request.init?.credentials === "include")).toBe(true);
    expect(document.querySelector('a[href^="/api/storage/objects/"]')).not.toBeInTheDocument();
    expect(document.querySelector("iframe[title='brief.pdf']")?.closest("p")).toBeNull();
    expect(document.querySelector("audio[controls]")?.closest("p")).toBeNull();
  });

  it("cleans up message attachments through the authenticated storage endpoint after message deletion", async () => {
    const order: string[] = [];
    const attachmentMessage: StoredMessage = {
      id: "message-to-delete",
      author: "Interviewer",
      message: "Please review [brief.pdf](/api/storage/objects/chat-delete-1234).",
      scope: "shared",
      peer: null,
      parentMessageId: null,
      pinnedAt: null,
      activities: [],
      reactions: [],
      createdAt: "2026-09-30T12:00:00.000Z",
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);

      if (url.pathname === "/api/queue/chat" && init?.method !== "DELETE") {
        return jsonResponse({ items: [attachmentMessage], scope: "shared", peer: null });
      }
      if (url.pathname === "/api/queue/chat/message-to-delete" && init?.method === "DELETE") {
        order.push("message");
        return new Response(null, { status: 204 });
      }
      if (url.pathname === "/api/storage/objects/chat-delete-1234" && init?.method === "DELETE") {
        order.push("storage");
        return jsonResponse({ ok: true });
      }
      return jsonResponse({ items: [], interviewerLabels: [] });
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
          <DialogHost />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    await screen.findByTestId("button-delete-chat-message-message-to-delete");
    fireEvent.click(screen.getByTestId("button-delete-chat-message-message-to-delete"));
    // The in-app dialog replaces window.confirm.
    await screen.findByTestId("app-dialog");
    fireEvent.click(screen.getByTestId("app-dialog-confirm"));

    await waitFor(() => expect(order).toEqual(["message", "storage"]));
    const storageRequest = fetchMock.mock.calls.find(([input, init]) =>
      String(input).includes("/api/storage/objects/chat-delete-1234") && init?.method === "DELETE",
    );
    expect(storageRequest?.[1]).toMatchObject({ method: "DELETE", credentials: "include" });
  });
});