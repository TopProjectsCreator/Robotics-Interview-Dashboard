import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getGetDisplayStateQueryKey } from "@workspace/api-client-react";
import { useRealtimeSync } from "./useRealtimeSync";
import { SettingsProvider } from "./workspaceSettings";

type MockEventSource = {
  onmessage: ((event: MessageEvent<string>) => void) | null;
  close: ReturnType<typeof vi.fn>;
};

const eventSources: MockEventSource[] = [];

function RealtimeObserver() {
  useRealtimeSync(true);
  return null;
}

function MockEventSourceConstructor() {
  const source = {
    onmessage: null as MockEventSource["onmessage"],
    close: vi.fn(),
  };
  eventSources.push(source);
  return source;
}

describe("team realtime hints", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    eventSources.length = 0;
    window.localStorage.setItem("robotics-workspace-settings", JSON.stringify({ realtime: true }));
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    vi.stubGlobal("EventSource", MockEventSourceConstructor);
  });

  afterEach(() => {
    queryClient.clear();
    eventSources.length = 0;
    vi.unstubAllGlobals();
  });

  it("refreshes both default and code-scoped public displays after a team change", async () => {
    const defaultDisplayKey = getGetDisplayStateQueryKey();
    const codeScopedDisplayKey = getGetDisplayStateQueryKey({ eventPassword: "TEAM-CODE" });
    queryClient.setQueryData(defaultDisplayKey, { teamName: "Old default name" });
    queryClient.setQueryData(codeScopedDisplayKey, { teamName: "Old code-scoped name" });

    render(
      <QueryClientProvider client={queryClient}>
        <SettingsProvider>
          <RealtimeObserver />
        </SettingsProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(eventSources).toHaveLength(1));
    act(() => {
      eventSources[0].onmessage?.(
        new MessageEvent("message", { data: JSON.stringify({ table: "teams", event: "UPDATE" }) }),
      );
    });

    await waitFor(() => {
      expect(queryClient.getQueryState(defaultDisplayKey)?.isInvalidated).toBe(true);
      expect(queryClient.getQueryState(codeScopedDisplayKey)?.isInvalidated).toBe(true);
    });
  });
});
