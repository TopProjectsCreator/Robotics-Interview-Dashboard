import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Router as WouterRouter } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InterviewChatPanel } from "./App";
import { TooltipProvider } from "./components/ui/tooltip";
import { SettingsProvider } from "./workspaceSettings";

vi.mock("@google/model-viewer", () => ({}));

const EXPORT_TRANSCRIPT = 'id,created_at,author,parent_message_id,edited_at,deleted_at,activities,message\r\nmsg-1,2026-08-01T14:23:05.000Z,Alex,,,,"[]",Hello world\r\n';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("/export chat command", () => {
  let queryClient: QueryClient;
  let exportStatus: number;
  let exportBody: string;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ autoRefresh: false, realtime: true }));
    window.history.replaceState({}, "", "/chat");
    exportStatus = 200;
    exportBody = EXPORT_TRANSCRIPT;
  });

  afterEach(() => {
    queryClient.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    // Drop the per-test clipboard stub so the next test sees a clean navigator.
    delete (window.navigator as { clipboard?: unknown }).clipboard;
  });

  function installFetchMock(role: string) {
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
      if (url.pathname === "/api/queue/chat") {
        const scope = (url.searchParams.get("scope") ?? "shared") as "shared" | "direct";
        return jsonResponse({ items: [], scope, peer: null });
      }
      if (url.pathname === "/api/queue/chat/export") {
        if (exportStatus !== 200) {
          return jsonResponse({ error: "Couldn't export the chat history. Try again." }, exportStatus);
        }
        return new Response(exportBody, {
          status: 200,
          headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="chat-export.csv"' },
        });
      }
      if (url.pathname === "/api/diagnostics") return jsonResponse({ ok: true });

      return jsonResponse({ items: [] });
    });
    vi.stubGlobal("fetch", fetchMock);
    return { requests };
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

  function spyAnchorClicks() {
    const clicked: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.href);
    });
    return clicked;
  }

  function stubClipboard() {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
    return writeText;
  }

  async function typeAndSend(draft: string) {
    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), { target: { value: draft } });
    fireEvent.click(screen.getByTestId("button-send-interviewer-chat"));
  }

  it("downloads a Markdown file of the full history by default", async () => {
    const { requests } = installFetchMock("coordinator");
    const clicked = spyAnchorClicks();
    renderPanel();

    await typeAndSend("/export");

    expect(await screen.findByTestId("export-notice")).toHaveTextContent("Chat export started");
    expect(clicked).toHaveLength(1);
    const url = new URL(clicked[0]);
    expect(url.pathname).toBe("/api/queue/chat/export");
    expect(url.searchParams.get("format")).toBe("md");
    expect(url.searchParams.get("scope")).toBe("shared");
    expect(url.searchParams.get("last")).toBeNull();
    // The composer must not post anything as a message.
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat" && request.init?.method === "POST")).toHaveLength(0);
    expect(screen.getByTestId("input-interviewer-chat")).toHaveValue("");
  });

  it("passes {last} and the chosen format through to the download URL", async () => {
    installFetchMock("coordinator");
    const clicked = spyAnchorClicks();
    renderPanel();

    await typeAndSend("/export {50} csv");

    expect(clicked).toHaveLength(1);
    const url = new URL(clicked[0]);
    expect(url.searchParams.get("format")).toBe("csv");
    expect(url.searchParams.get("last")).toBe("50");
  });

  it("accepts options in any order and the markdown/txt aliases", async () => {
    installFetchMock("coordinator");
    const clicked = spyAnchorClicks();
    renderPanel();

    await typeAndSend("/export txt {7}");

    expect(clicked).toHaveLength(1);
    const url = new URL(clicked[0]);
    expect(url.searchParams.get("format")).toBe("txt");
    expect(url.searchParams.get("last")).toBe("7");
  });

  it("copies the transcript to the clipboard when asked", async () => {
    const { requests } = installFetchMock("coordinator");
    const writeText = stubClipboard();
    const clicked = spyAnchorClicks();
    renderPanel();

    await typeAndSend("/export {5} csv clipboard");

    expect(await screen.findByTestId("export-notice")).toHaveTextContent("copied to the clipboard");
    const exportRequests = requests.filter(request => request.url.pathname === "/api/queue/chat/export");
    expect(exportRequests).toHaveLength(1);
    expect(exportRequests[0].url.searchParams.get("last")).toBe("5");
    expect(exportRequests[0].url.searchParams.get("format")).toBe("csv");
    expect(writeText).toHaveBeenCalledWith(EXPORT_TRANSCRIPT);
    // Clipboard mode must not also trigger a download.
    expect(clicked).toHaveLength(0);
  });

  it("rejects malformed commands before touching the network", async () => {
    const { requests } = installFetchMock("coordinator");
    renderPanel();

    await typeAndSend("/export nonsense");

    expect(await screen.findByTestId("chat-error")).toHaveTextContent("Unknown option");
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat/export")).toHaveLength(0);
  });

  it("rejects a zero {last}", async () => {
    const { requests } = installFetchMock("coordinator");
    renderPanel();

    await typeAndSend("/export {0}");

    expect(await screen.findByTestId("chat-error")).toHaveTextContent("{last} must be a whole number of at least 1.");
    expect(requests.filter(request => request.url.pathname === "/api/queue/chat/export")).toHaveLength(0);
  });

  it("surfaces clipboard failures instead of claiming a copy", async () => {
    installFetchMock("coordinator");
    const writeText = vi.fn().mockRejectedValue(new Error("clipboard unavailable"));
    Object.defineProperty(window.navigator, "clipboard", { value: { writeText }, configurable: true });
    renderPanel();

    await typeAndSend("/export clipboard");

    expect(await screen.findByTestId("chat-error")).toHaveTextContent("clipboard rejected it");
    expect(screen.queryByTestId("export-notice")).not.toBeInTheDocument();
  });

  it("shows the server's error when the export request fails", async () => {
    installFetchMock("coordinator");
    exportStatus = 500;
    stubClipboard();
    renderPanel();

    await typeAndSend("/export clipboard");

    expect(await screen.findByTestId("chat-error")).toHaveTextContent("Couldn't export the chat history. Try again.");
  });

  it("offers /export in the slash-command picker", async () => {
    installFetchMock("coordinator");
    renderPanel();

    await waitFor(() => expect(screen.getByTestId("chat-signed-in")).toHaveTextContent("Alex"));
    fireEvent.change(screen.getByTestId("input-interviewer-chat"), { target: { value: "/exp" } });

    const option = await screen.findByTestId("slash-command-option-export");
    expect(option).toHaveTextContent("/export");
    expect(screen.queryByTestId("slash-command-admin-badge-export")).not.toBeInTheDocument();
  });
});
