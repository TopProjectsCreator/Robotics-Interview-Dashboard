import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CustomWorkspaceAppPage } from "./CustomWorkspaceAppPage";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetSessionQueryKey: () => ["getSession"],
  useGetSession: () => ({
    data: { authenticated: true, teamId: "team-a", interviewerId: "member-a" },
  }),
}));

vi.mock("../authSession", () => ({
  getStoredAuthToken: () => "test-session-token",
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CustomWorkspaceAppPage", () => {
  it("loads the app in the isolated themed iframe", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({
      workspace: {
        id: "custom-app-1",
        title: "Pit scouting",
        description: "Collect observations at the event.",
        capabilities: ["data", "llm"],
        status: "published",
        iconDataUrl: "data:image/svg+xml;charset=utf-8,%3Csvg%3E",
        accessMode: "team",
        allowedInterviewerIds: [],
        html: '<html><head></head><body><img src="data:image/svg+xml;charset=utf-8,%3Csvg%3E"></body></html>',
        critiqueRounds: 5,
        verifiedCritiqueRounds: 5,
        createdAt: "2026-10-01T00:00:00.000Z",
        updatedAt: "2026-10-01T00:00:00.000Z",
      },
    }));
    vi.stubGlobal("fetch", fetchMock);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <CustomWorkspaceAppPage workspaceId="custom-app-1" />
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Pit scouting" })).toBeInTheDocument();
    expect(screen.getByTestId("image-custom-app-icon-custom-app-1")).toHaveAttribute(
      "src",
      "data:image/svg+xml;charset=utf-8,%3Csvg%3E",
    );
    const iframe = await waitFor(() => screen.getByTestId("iframe-custom-app-custom-app-1"));
    expect(iframe.getAttribute("sandbox")).toBe("allow-scripts");
    const srcDoc = iframe.getAttribute("srcdoc") ?? "";
    expect(srcDoc).toContain('<html class="dark">');
    expect(srcDoc).toContain("connect-src 'none'");
    expect(srcDoc).toContain("workspaceAPI");
    expect(srcDoc).toContain("data:image/svg+xml;charset=utf-8,");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/custom-workspaces/custom-app-1",
      expect.objectContaining({ credentials: "include" }),
    );
    expect(queryClient.getQueryCache().findAll().map((query) => query.queryKey)).toContainEqual([
      "custom-workspace",
      "custom-app-1",
      "team-a",
      "member-a",
    ]);
  });
});
