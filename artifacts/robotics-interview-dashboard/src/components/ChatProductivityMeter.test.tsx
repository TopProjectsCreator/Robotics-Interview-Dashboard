import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatProductivityMeter } from "./ChatProductivityMeter";

type ProductivityStatus = {
  enabled: boolean;
  canManage: boolean;
  lastRunAt: string | null;
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

type ProductivityHistory = {
  range: "7d" | "30d" | "90d";
  reviewCount: number;
  truncated: boolean;
  points: {
    score: number;
    summary: string;
    breakdown: { projectProgress: number; planningCoordination: number; focusDiscipline: number };
    periodStart: string | null;
    periodEnd: string | null;
    createdAt: string;
  }[];
  daily: { date: string; averageScore: number; maxScore: number; reviewCount: number }[];
};

const emptyHistory: ProductivityHistory = {
  range: "30d",
  reviewCount: 0,
  truncated: false,
  points: [],
  daily: [],
};

let status: ProductivityStatus;
let history: ProductivityHistory;
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
  if (url.pathname.endsWith("/queue/chat/productivity/history") && method === "GET") {
    return jsonResponse(history);
  }
  if (url.pathname.endsWith("/queue/chat/productivity/review") && method === "POST") {
    return jsonResponse({
      ...status,
      latest: {
        conversationName: "Drive team",
        score: 8,
        summary: "Recent range review.",
        activities: [{ activity: "Completed a motor test", assessment: "productive" }],
        breakdown: { projectProgress: 8, planningCoordination: 8, focusDiscipline: 7 },
        periodStart: "2026-11-10T20:00:00.000Z",
        periodEnd: "2026-11-11T20:00:00.000Z",
        createdAt: "2026-11-11T20:00:00.000Z",
      },
    });
  }
  if (url.pathname.endsWith("/queue/chat/productivity/settings") && method === "PUT") {
    status = { ...status, enabled: body?.enabled === true, lastError: null, lastRunAt: null };
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
  status = { enabled: false, canManage: true, lastRunAt: null, lastError: null, latest: null };
  history = emptyHistory;
  requests.length = 0;
  fetchMock.mockClear();
  vi.stubGlobal("fetch", fetchMock);
  // recharts' ResponsiveContainer measures with ResizeObserver, which jsdom does not provide.
  if (typeof ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  }
});

describe("ChatProductivityMeter", () => {
  it("shows the processing notice and requires coordinator acknowledgement before enabling", async () => {
    renderMeter({ scope: "channel", channelId: "drive-team" });
    await screen.findByTestId("status-chat-productivity-score");
    expect(screen.getByTestId("button-chat-productivity")).toHaveTextContent("Productivity Score");
    expect(screen.getByTestId("button-chat-productivity")).toHaveAccessibleName("Open productivity meter");
    fireEvent.click(screen.getByTestId("button-chat-productivity"));

    expect(await screen.findByText("A coordinator has not enabled AI productivity reviews.")).toBeInTheDocument();
    expect(await screen.findByTestId("checkbox-chat-productivity-notice")).toBeInTheDocument();
    expect(screen.getByText(/selected message text may contain personal details/)).toBeInTheDocument();
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
    expect(await screen.findByText("Review is queued to start shortly.")).toBeInTheDocument();
  });

  it("shows when an assessment has started instead of leaving the user with a queued state", async () => {
    status = { enabled: true, canManage: false, lastRunAt: "2026-11-10T19:55:00.000Z", lastError: null, latest: null };
    renderMeter({ scope: "shared" });
    fireEvent.click(await screen.findByTestId("button-chat-productivity"));

    expect(await screen.findByTestId("status-chat-productivity-empty")).toHaveTextContent("Review started at");
    expect(screen.getByTestId("status-chat-productivity-empty")).not.toHaveTextContent("queued");
  });

  it("shows the score details but never offers settings to a channel member", async () => {
    status = {
      enabled: true,
      canManage: false,
      lastRunAt: "2026-11-10T19:55:00.000Z",
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

  it("requests a one-time assessment for the selected range and channel", async () => {
    status = { enabled: true, canManage: false, lastRunAt: null, lastError: null, latest: null };
    renderMeter({ scope: "channel", channelId: "drive-team" });
    fireEvent.click(await screen.findByTestId("button-chat-productivity"));

    const rangeSelect = await screen.findByTestId("select-chat-productivity-range");
    expect(screen.getByRole("option", { name: "Last hour" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last day" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last 3 days" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last 5 days" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last week" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Last month" })).toBeInTheDocument();

    fireEvent.change(rangeSelect, { target: { value: "1d" } });

    expect(await screen.findByText("Recent range review.")).toBeInTheDocument();
    expect(requests.find((request) => request.method === "POST" && request.path.endsWith("/queue/chat/productivity/review"))?.body).toEqual({
      scope: "channel",
      channelId: "drive-team",
      range: "1d",
    });
    expect(screen.getByTestId("panel-chat-productivity-details")).toBeInTheDocument();
  });

  it("charts retained automatic reviews and lists previous scores in the history tab", async () => {
    status = {
      enabled: true,
      canManage: false,
      lastRunAt: "2026-11-11T19:55:00.000Z",
      lastError: null,
      latest: null,
    };
    history = {
      range: "30d",
      reviewCount: 12,
      truncated: false,
      points: [
        {
          score: 5,
          summary: "Mostly banter about drive tuning.",
          breakdown: { projectProgress: 4, planningCoordination: 6, focusDiscipline: 5 },
          periodStart: "2026-11-10T19:30:00.000Z",
          periodEnd: "2026-11-10T20:00:00.000Z",
          createdAt: "2026-11-10T20:00:00.000Z",
        },
        {
          score: 9,
          summary: "Shipped the intake validation fix.",
          breakdown: { projectProgress: 9, planningCoordination: 8, focusDiscipline: 9 },
          periodStart: "2026-11-11T19:30:00.000Z",
          periodEnd: "2026-11-11T20:00:00.000Z",
          createdAt: "2026-11-11T20:00:00.000Z",
        },
      ],
      daily: [
        { date: "2026-11-09", averageScore: 6, maxScore: 7, reviewCount: 7 },
        { date: "2026-11-10", averageScore: 7, maxScore: 8, reviewCount: 3 },
        { date: "2026-11-11", averageScore: 9, maxScore: 10, reviewCount: 2 },
      ],
    };
    renderMeter({ scope: "channel", channelId: "drive-team" });
    fireEvent.click(await screen.findByTestId("button-chat-productivity"));
    fireEvent.click(await screen.findByTestId("tab-productivity-history"));

    expect(await screen.findByTestId("panel-productivity-history")).toBeInTheDocument();
    expect(await screen.findByTestId("stat-history-average")).toHaveTextContent("6.8/10");
    expect(screen.getByTestId("stat-history-best-day")).toHaveTextContent("11");
    expect(screen.getByTestId("stat-history-peak-score")).toHaveTextContent("10/10");
    expect(screen.getByTestId("chart-productivity-daily")).toBeInTheDocument();
    expect(screen.getByTestId("chart-productivity-trend")).toBeInTheDocument();
    expect(screen.getByTestId("list-productivity-history")).toBeInTheDocument();
    expect(screen.getByTestId("row-productivity-history-0")).toHaveTextContent("Shipped the intake validation fix.");
    expect(screen.getByTestId("row-productivity-history-0")).toHaveTextContent("9/10");
    expect(screen.getByTestId("row-productivity-history-1")).toHaveTextContent("Mostly banter about drive tuning.");
    const historyRequest = requests.find((request) => request.method === "GET" && request.path.includes("/queue/chat/productivity/history"));
    expect(historyRequest?.path).toContain("scope=channel");
    expect(historyRequest?.path).toContain("channelId=drive-team");
    expect(historyRequest?.path).toContain("range=30d");
  });

  it("shows the empty state in the history tab when no reviews are retained yet", async () => {
    status = { enabled: true, canManage: false, lastRunAt: null, lastError: null, latest: null };
    renderMeter({ scope: "shared" });
    fireEvent.click(await screen.findByTestId("button-chat-productivity"));
    fireEvent.click(await screen.findByTestId("tab-productivity-history"));

    expect(await screen.findByTestId("status-productivity-history-empty")).toHaveTextContent("No reviews retained yet");
  });

  it("lets a coordinator retry a failed review without changing the opt-in setting", async () => {
    status = { enabled: true, canManage: true, lastRunAt: "2026-11-10T19:55:00.000Z", lastError: "The latest AI review failed. Another review is scheduled.", latest: null };
    renderMeter({ scope: "shared" });
    fireEvent.click(await screen.findByTestId("button-chat-productivity"));
    expect(await screen.findByTestId("button-retry-chat-productivity")).toBeInTheDocument();
    expect(screen.getByTestId("status-chat-productivity-empty")).toHaveTextContent("There is no usable assessment yet.");
    expect(screen.getByTestId("status-chat-productivity-empty")).not.toHaveTextContent("queued");

    fireEvent.click(screen.getByTestId("button-retry-chat-productivity"));

    await waitFor(() => expect(requests.some((request) => request.method === "PUT")).toBe(true));
    expect(requests.find((request) => request.method === "PUT")?.body).toEqual({
      enabled: true,
      acknowledgeNotice: true,
    });
    await waitFor(() => expect(screen.queryByTestId("button-retry-chat-productivity")).not.toBeInTheDocument());
  });
});
