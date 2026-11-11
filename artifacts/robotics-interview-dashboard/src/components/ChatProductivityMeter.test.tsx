import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatProductivityMeter } from "./ChatProductivityMeter";

type ProductivityStatus = {
  enabled: boolean;
  canManage: boolean;
  lastError: string | null;
  latest: null | {
    conversationName: string;
    score: number;
    summary: string;
    activities: { activity: string; assessment: "productive" | "low_value" | "potentially_useful" | "no_recorded_progress" }[];
    breakdown: { projectProgress: number; planningCoordination: number; focusDiscipline: number };
    periodStart: string | null;
    periodEnd: string | null;
    createdAt: string;
  };
};

let status: ProductivityStatus;
const requests: { path: string; method: string; body?: Record<string, unknown> }[] = [];
const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input), window.location.origin);
  const method = (init?.method ?? "GET").toUpperCase();
  const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;
  requests.push({ path: `${url.pathname}${url.search}`, method, body });
  const jsonResponse = (value: unknown, responseStatus = 200) => new Response(JSON.stringify(value), {
    status: responseStatus,
    headers: { "Content-Type": "application/json" },
  });

  if (url.pathname.endsWith("/queue/chat/productivity") && method === "GET") {
    return jsonResponse(status);
  }
  if (url.pathname.endsWith("/queue/chat/productivity/settings") && method === "PUT") {
    status = { ...status, enabled: body?.enabled === true };
    return jsonResponse({ enabled: status.enabled, updatedAt: "2026-11-10T20:00:00.000Z" });
  }
  return jsonResponse({ error: "Not found" }, 404);
});

function renderMeter(props: { scope: "shared" | "channel"; channelId?: string }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ChatProductivityMeter {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  status = { enabled: false, canManage: true, lastError: null, latest: null };
  requests.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
});

describe("ChatProductivityMeter", () => {
  it("shows the processing notice and requires coordinator acknowledgement before enabling", async () => {
    renderMeter({ scope: "channel", channelId: "drive-team" });
    await screen.findByTestId("status-chat-productivity-score");
    fireEvent.click(screen.getByTestId("button-chat-productivity"));

    expect(await screen.findByText("A coordinator has not enabled AI productivity reviews.")).toBeInTheDocument();
    expect(await screen.findByTestId("checkbox-chat-productivity-notice")).toBeInTheDocument();
    expect(screen.getByText(/Stored message text, which may contain names or other personal details/)).toBeInTheDocument();
    expect(screen.getByTestId("button-enable-chat-productivity")).toBeDisabled();
    expect(requests.some((request) =>
      request.method === "GET" && request.path.includes("scope=channel") && request.path.includes("channelId=drive-team"),
    )).toBe(true);

    fireEvent.click(screen.getByTestId("checkbox-chat-productivity-notice"));
    fireEvent.click(screen.getByTestId("button-enable-chat-productivity"));

    await waitFor(() => expect(status.enabled).toBe(true));
    expect(requests.find((request) => request.method === "PUT")?.body).toEqual({
      enabled: true,
      acknowledgeNotice: true,
    });
    expect(await screen.findByTestId("button-disable-chat-productivity")).toBeInTheDocument();
  });

  it("shows the score details but never offers settings to a channel member", async () => {
    status = {
      enabled: true,
      canManage: false,
      lastError: null,
      latest: {
        conversationName: "Drive team",
        score: 7,
        summary: "The team completed a test and agreed on next steps.",
        activities: [{ activity: "Tested the drivetrain", assessment: "productive" }],
        breakdown: { projectProgress: 8, planningCoordination: 7, focusDiscipline: 6 },
        periodStart: "2026-11-10T19:55:00.000Z",
        periodEnd: "2026-11-10T20:00:00.000Z",
        createdAt: "2026-11-10T20:00:00.000Z",
      },
    };
    renderMeter({ scope: "channel", channelId: "drive-team" });
    fireEvent.click(await screen.findByTestId("button-chat-productivity"));

    expect(await screen.findByTestId("panel-chat-productivity-details")).toBeInTheDocument();
    expect(screen.getByTestId("status-chat-productivity-score")).toHaveTextContent("7/10");
    expect(screen.getByText("Tested the drivetrain")).toBeInTheDocument();
    expect(screen.getByText("Planning and coordination")).toBeInTheDocument();
    expect(screen.queryByTestId("button-disable-chat-productivity")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-enable-chat-productivity")).not.toBeInTheDocument();
  });
});
