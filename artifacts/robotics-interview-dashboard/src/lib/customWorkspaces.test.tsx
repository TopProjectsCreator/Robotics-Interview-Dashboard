import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAccessibleCustomWorkspaces } from "./customWorkspaces";

vi.mock("../authSession", () => ({
  getStoredAuthToken: () => "test-session-token",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAccessibleCustomWorkspaces", () => {
  it("loads the server-filtered list with the signed-in session", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      workspaces: [{
        id: "custom-app-1",
        title: "Pit scouting",
        description: "Collect observations.",
        status: "published",
        iconDataUrl: "data:image/svg+xml;charset=utf-8,%3Csvg%3E",
      }],
    }));
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => useAccessibleCustomWorkspaces(true, "team-a", "member-a"),
      { wrapper },
    );

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0]).toEqual({
      id: "custom-app-1",
      title: "Pit scouting",
      description: "Collect observations.",
      status: "published",
      iconDataUrl: "data:image/svg+xml;charset=utf-8,%3Csvg%3E",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-workspaces",
      expect.objectContaining({ credentials: "include" }),
    );
  });
});
