import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatNotificationEvent, ChatNotificationEventPage } from "@workspace/api-client-react";

const { getChatNotificationEvents } = vi.hoisted(() => ({
  getChatNotificationEvents: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({ getChatNotificationEvents }));

import { useGlobalChatNotifications } from "./useGlobalChatNotifications";

class TestNotification {
  static permission: NotificationPermission = "granted";
  static instances: TestNotification[] = [];
  onclick: (() => unknown) | null = null;
  close = vi.fn();

  constructor(public title: string, public options?: NotificationOptions) {
    TestNotification.instances.push(this);
  }
}

function chatEvent(overrides: Partial<ChatNotificationEvent> = {}): ChatNotificationEvent {
  return {
    id: "message-1",
    scope: "direct",
    createdAt: "2026-01-01T12:00:00.000Z",
    author: "Alex",
    message: "Hello",
    peer: "Alex",
    channelId: null,
    channelName: null,
    ...overrides,
  };
}

function page(items: ChatNotificationEvent[], nextCursor: string, hasMore = false): ChatNotificationEventPage {
  return { items, nextCursor, hasMore };
}

function Observer({ peer = null, channel = null }: { peer?: string | null; channel?: string | null }) {
  useGlobalChatNotifications({
    myLabel: "Morgan",
    interviewerId: "account-1",
    teamId: "team-1",
    viewingPeer: peer,
    viewingChannel: channel,
    enabled: true,
  });
  return null;
}

function renderObserver(observer: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{observer}</QueryClientProvider>);
}

describe("global chat notification polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/dashboard");
    TestNotification.instances = [];
    TestNotification.permission = "granted";
    vi.stubGlobal("Notification", TestNotification);
    getChatNotificationEvents.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("primes without a backlog, drains every page, and navigates from distinct message notifications", async () => {
    getChatNotificationEvents
      .mockResolvedValueOnce(page([], "baseline"))
      .mockResolvedValueOnce(page([
        chatEvent({ id: "dm-1", peer: "Alex" }),
        chatEvent({ id: "shared-1", scope: "shared", peer: null }),
      ], "cursor-2", true))
      .mockResolvedValueOnce(page([
        chatEvent({
          id: "channel-1",
          scope: "channel",
          peer: null,
          channelId: "channel-build",
          channelName: "Build team",
        }),
      ], "cursor-3"));

    renderObserver(<Observer />);
    expect(getChatNotificationEvents).toHaveBeenCalledTimes(1);
    expect(getChatNotificationEvents).toHaveBeenNthCalledWith(1, { limit: 100 });
    expect(TestNotification.instances).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(TestNotification.instances).toHaveLength(3);
    expect(getChatNotificationEvents).toHaveBeenNthCalledWith(2, { cursor: "baseline", limit: 100 });
    expect(getChatNotificationEvents).toHaveBeenNthCalledWith(3, { cursor: "cursor-2", limit: 100 });
    expect(new Set(TestNotification.instances.map(note => note.options?.tag)).size).toBe(3);

    act(() => TestNotification.instances[0].onclick?.());
    expect(window.location.pathname).toBe("/chat");
    expect(new URLSearchParams(window.location.search).get("peer")).toBe("Alex");
  });

  it("does not create OS notifications when permission is denied", async () => {
    TestNotification.permission = "denied";
    getChatNotificationEvents
      .mockResolvedValueOnce(page([], "baseline"))
      .mockResolvedValueOnce(page([chatEvent()], "cursor-1"));

    renderObserver(<Observer />);
    expect(getChatNotificationEvents).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(getChatNotificationEvents).toHaveBeenCalledTimes(2);
    expect(TestNotification.instances).toHaveLength(0);
    expect(TestNotification.permission).toBe("denied");
  });

  it("does not notify for the conversation currently open", async () => {
    window.history.replaceState({}, "", "/chat?peer=Alex");
    getChatNotificationEvents
      .mockResolvedValueOnce(page([], "baseline"))
      .mockResolvedValueOnce(page([chatEvent({ id: "active-dm", peer: "Alex" })], "cursor-1"));

    renderObserver(<Observer peer="Alex" />);
    expect(getChatNotificationEvents).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(getChatNotificationEvents).toHaveBeenCalledTimes(2);
    expect(TestNotification.instances).toHaveLength(0);
  });

  it("deduplicates an event returned again after a reconnect", async () => {
    const duplicate = chatEvent({ id: "replayed-after-reconnect" });
    getChatNotificationEvents
      .mockResolvedValueOnce(page([], "baseline"))
      .mockResolvedValueOnce(page([duplicate], "cursor-1"))
      .mockResolvedValueOnce(page([duplicate], "cursor-2"));

    renderObserver(<Observer />);
    expect(getChatNotificationEvents).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(TestNotification.instances).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(getChatNotificationEvents).toHaveBeenCalledTimes(3);
    expect(TestNotification.instances).toHaveLength(1);
  });
});
