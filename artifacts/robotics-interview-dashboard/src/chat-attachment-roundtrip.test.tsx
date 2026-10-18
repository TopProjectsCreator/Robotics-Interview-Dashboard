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

function clipboardWithFiles(files: File[], text = "") {
  return {
    files,
    items: files.map(file => ({
      kind: "file",
      type: file.type,
      getAsFile: () => file,
    })),
    getData: (type: string) => type === "text/plain" ? text : "",
  };
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

  it("uploads pasted images and video, persists their paths, and reloads authenticated inline previews", async () => {
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

    const image = new File(["PNG robotics fixture"], "", { type: "image/png" });
    const video = new File(["MP4 robotics fixture"], "", { type: "video/mp4" });
    fireEvent.paste(screen.getByTestId("input-interviewer-chat"), {
      clipboardData: clipboardWithFiles([image, video]),
    });
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), {
      target: { value: "Please review these interview materials." },
    });

    await screen.findByText("clipboard-image-1.png");
    await screen.findByText("clipboard-video-2.mp4");
    expect(document.querySelector('img[alt="clipboard-image-1.png"]')).toBeInTheDocument();
    expect(document.querySelector("video[controls]")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove clipboard-image-1.png" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove clipboard-video-2.mp4" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));

    await waitFor(() => {
      expect(screen.getByAltText("clipboard-image-1.png")).toBeInTheDocument();
      expect(document.querySelector(".chat-message-card video[controls]")).toBeInTheDocument();
    });

    const uploadRequests = requests.filter(request =>
      request.url.pathname === "/api/storage/uploads" && request.init?.method === "POST",
    );
    expect(uploadRequests).toHaveLength(2);
    expect(uploadRequests.map(({ init }) => new Headers(init?.headers).get("Content-Type"))).toEqual([
      "image/png",
      "video/mp4",
    ]);
    expect(await (uploadRequests[0].init?.body as Blob).text()).toContain("PNG robotics fixture");
    expect(await (uploadRequests[1].init?.body as Blob).text()).toContain("MP4 robotics fixture");

    const chatPost = requests.find(request =>
      request.url.pathname === "/api/queue/chat" && request.init?.method === "POST",
    );
    expect(chatPost).toBeDefined();
    const postedBody = JSON.parse(String(chatPost?.init?.body)) as { message: string; scope: string };
    expect(postedBody.scope).toBe("shared");
    expect(postedBody.message).toContain("Please review these interview materials.");
    expect(postedBody.message).toContain("![clipboard-image-1.png](/api/storage/objects/chat-attachment-1)");
    expect(postedBody.message).toContain("[clipboard-video-2.mp4](/api/storage/objects/chat-attachment-2)");

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
    expect(document.querySelector('img[alt="clipboard-image-1.png"]')?.closest("p")).toBeNull();
    expect(document.querySelector(".chat-message-card video[controls]")?.closest("p")).toBeNull();
  });

  it("keeps normal text paste intact and reports unsupported, oversized, or excess pasted files", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const rawUrl = input instanceof Request ? input.url : String(input);
      const url = new URL(rawUrl, window.location.origin);
      if (url.pathname === "/api/queue/chat") return jsonResponse({ items: [], scope: "shared", peer: null });
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

    const input = screen.getByTestId("input-interviewer-chat");
    const textPaste = fireEvent.paste(input, {
      clipboardData: clipboardWithFiles([], "Keep this draft text."),
    });
    expect(textPaste).toBe(true);
    expect(screen.queryByTestId("chat-image-error")).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: "Keep this draft text." } });
    expect(input).toHaveValue("Keep this draft text.");

    const unsupported = new File(["archive"], "archive.zip", { type: "application/zip" });
    expect(fireEvent.paste(input, { clipboardData: clipboardWithFiles([unsupported]) })).toBe(false);
    expect(await screen.findByTestId("chat-image-error")).toHaveTextContent("archive.zip");
    expect(screen.getByTestId("chat-image-error")).toHaveTextContent("Paste an image or video");
    expect(input).toHaveValue("Keep this draft text.");

    const oversized = new File(["small fixture"], "too-large.png", { type: "image/png" });
    Object.defineProperty(oversized, "size", { value: 100 * 1024 * 1024 + 1 });
    fireEvent.paste(input, { clipboardData: clipboardWithFiles([oversized]) });
    expect(await screen.findByTestId("chat-image-error")).toHaveTextContent("too-large.png");
    expect(screen.getByTestId("chat-image-error")).toHaveTextContent("max 100 MB");

    fireEvent.paste(input, {
      clipboardData: clipboardWithFiles([
        new File(["one"], "one.png", { type: "image/png" }),
        new File(["two"], "two.png", { type: "image/png" }),
        new File(["three"], "three.png", { type: "image/png" }),
        new File(["four"], "four.png", { type: "image/png" }),
      ]),
    });
    expect(await screen.findByTestId("chat-image-error")).toHaveTextContent("Up to 3 attachments per message");
    expect(screen.queryByText("one.png")).not.toBeInTheDocument();
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