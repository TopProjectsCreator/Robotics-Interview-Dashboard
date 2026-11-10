import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorkspaceUsageDashboard from "./WorkspaceUsageDashboard";

const mocks = vi.hoisted(() => ({
  useGetWorkspaceUsage: vi.fn(),
  getGetWorkspaceUsageQueryKey: vi.fn((params: unknown) => ["workspace-usage", params]),
}));

vi.mock("@workspace/api-client-react", () => mocks);

const usageData = {
  from: new Date("2026-11-01T00:00:00.000Z"),
  to: new Date("2026-11-03T00:00:00.000Z"),
  totalActiveSeconds: 3720,
  totalVisits: 7,
  distinctSessions: 4,
  workspaces: [
    {
      id: "chat",
      type: "builtIn" as const,
      name: "Chat",
      activeSeconds: 3600,
      visits: 5,
      distinctSessions: 3,
    },
    {
      id: "custom-1",
      type: "custom" as const,
      name: "<img src=x onerror=alert(1)>",
      activeSeconds: 120,
      visits: 2,
      distinctSessions: 1,
    },
  ],
  daily: [
    { date: new Date("2026-11-01T00:00:00.000Z"), activeSeconds: 600 },
    { date: new Date("2026-11-02T00:00:00.000Z"), activeSeconds: 1200 },
  ],
};

function loadedUsage() {
  return {
    data: usageData,
    isLoading: false,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceUsageDashboard", () => {
  it("shows aggregate totals, individually ranked workspaces, and daily activity", () => {
    mocks.useGetWorkspaceUsage.mockReturnValue(loadedUsage());

    render(<WorkspaceUsageDashboard />);

    expect(screen.getByTestId("text-workspace-usage-active-total")).toHaveTextContent("1h 2m");
    expect(screen.getByTestId("text-workspace-usage-visits-total")).toHaveTextContent("7");
    expect(screen.getByTestId("text-workspace-usage-sessions-total")).toHaveTextContent("4");
    expect(screen.getByTestId("text-workspace-usage-name-chat")).toHaveTextContent("Chat");
    expect(screen.getByTestId("text-workspace-usage-name-custom-1")).toHaveTextContent("<img src=x onerror=alert(1)>");
    expect(screen.queryByRole("img", { name: "" })).not.toBeInTheDocument();
    expect(screen.getByTestId("chart-workspace-usage-daily")).toBeInTheDocument();
    expect(mocks.useGetWorkspaceUsage).toHaveBeenCalledWith(
      expect.objectContaining({ from: expect.any(String), to: expect.any(String) }),
      expect.objectContaining({ query: expect.objectContaining({ enabled: true }) }),
    );
  });

  it("shows a loading state and retries a failed request", () => {
    mocks.useGetWorkspaceUsage.mockReturnValue({
      isLoading: true,
      isError: false,
      isFetching: true,
      refetch: vi.fn(),
    });
    const { rerender } = render(<WorkspaceUsageDashboard />);
    expect(screen.getByTestId("loading-workspace-usage")).toBeInTheDocument();

    const refetch = vi.fn();
    mocks.useGetWorkspaceUsage.mockReturnValue({
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
    });
    rerender(<WorkspaceUsageDashboard />);
    fireEvent.click(screen.getByTestId("button-retry-workspace-usage"));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("keeps zero-activity workspaces visible and rejects ranges over 366 days", () => {
    mocks.useGetWorkspaceUsage.mockReturnValue({
      ...loadedUsage(),
      data: {
        ...usageData,
        totalActiveSeconds: 0,
        totalVisits: 0,
        distinctSessions: 0,
        workspaces: usageData.workspaces.map((workspace) => ({
          ...workspace,
          activeSeconds: 0,
          visits: 0,
          distinctSessions: 0,
        })),
        daily: usageData.daily.map((day) => ({ ...day, activeSeconds: 0 })),
      },
    });
    render(<WorkspaceUsageDashboard />);
    expect(screen.getByTestId("empty-workspace-usage")).toBeInTheDocument();
    expect(screen.getByTestId("text-workspace-usage-name-chat")).toBeInTheDocument();

    fireEvent.change(screen.getByTestId("input-workspace-usage-from"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByTestId("input-workspace-usage-to"), { target: { value: "2026-11-09" } });
    expect(screen.getByTestId("status-workspace-usage-range-error")).toHaveTextContent("366 days or less");
    expect(mocks.useGetWorkspaceUsage).toHaveBeenLastCalledWith(
      expect.objectContaining({ from: "2025-01-01", to: "2026-11-09" }),
      expect.objectContaining({ query: expect.objectContaining({ enabled: false }) }),
    );
  });
});
