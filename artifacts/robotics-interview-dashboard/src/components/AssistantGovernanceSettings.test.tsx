import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantGovernanceSettings } from "./AssistantGovernanceSettings";

const { mutation, policy, report } = vi.hoisted(() => ({
  mutation: vi.fn(),
  policy: {
  teamDisabledTools: [],
  roleDisabledTools: {},
  roles: [
    { key: "builtin:coordinator", label: "Admins" },
    { key: "builtin:interviewer", label: "Team members" },
    { key: "custom:robotics-lead", label: "Robotics lead" },
  ],
  updatedAt: null,
  },
  report: {
  startDate: new Date("2026-11-01T00:00:00.000Z"),
  endDate: new Date("2026-11-30T00:00:00.000Z"),
  totals: {
    prompts: 3,
    completedPrompts: 1,
    failedPrompts: 1,
    cancelledPrompts: 1,
    runningPrompts: 0,
    providerRequests: 4,
    successfulRequests: 2,
    failedRequests: 1,
    cancelledRequests: 1,
    runningRequests: 0,
    inputTokens: 18,
    outputTokens: 7,
    totalTokens: 25,
    usageReportedRequests: 2,
    usageUnavailableRequests: 2,
  },
  users: [{
    accountId: "account-a",
    displayName: "Ada",
    role: "Robotics lead",
    metrics: {
      prompts: 1, completedPrompts: 1, failedPrompts: 0, cancelledPrompts: 0, runningPrompts: 0,
      providerRequests: 2, successfulRequests: 2, failedRequests: 0, cancelledRequests: 0, runningRequests: 0,
      inputTokens: 18, outputTokens: 7, totalTokens: 25, usageReportedRequests: 2, usageUnavailableRequests: 0,
    },
  }],
  tools: [{ name: "search_applicants", invocations: 4 }],
  },
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetAssistantToolPolicyQueryKey: () => ["assistant-tool-policy"],
  getGetAssistantUsageQueryKey: () => ["assistant-usage"],
  useGetAssistantToolPolicy: () => ({
    data: policy,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useGetAssistantUsage: () => ({
    data: report,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUpdateAssistantToolPolicy: () => ({
    mutate: mutation,
    isPending: false,
    isError: false,
  }),
}));

function renderSettings() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AssistantGovernanceSettings teamId="team-a" />
    </QueryClientProvider>,
  );
}

describe("AssistantGovernanceSettings", () => {
  beforeEach(() => {
    mutation.mockReset();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tools: [] }), { status: 200 }),
    ));
  });

  it("shows prompt and provider totals separately with unavailable usage explained", () => {
    renderSettings();
    expect(screen.getByText("User prompts")).toBeInTheDocument();
    expect(screen.getByText("Provider requests")).toBeInTheDocument();
    expect(screen.getByText("No usage")).toBeInTheDocument();
    expect(screen.getByText(/2 requests had no provider-reported token counts/)).toBeInTheDocument();
    expect(screen.getAllByText("25")).toHaveLength(2);
    expect(screen.getByText("Search Applicants")).toBeInTheDocument();
  });

  it("saves a role-specific tool block without removing team-wide restrictions", async () => {
    renderSettings();
    const roleBlock = await screen.findByRole("checkbox", {
      name: "Disable Search applicants for Team members",
    });
    fireEvent.click(roleBlock);
    fireEvent.click(screen.getByRole("button", { name: "Save tool access" }));

    await waitFor(() => expect(mutation).toHaveBeenCalledWith({
      data: {
        teamDisabledTools: [],
        roleDisabledTools: { "builtin:interviewer": ["search_applicants"] },
      },
    }));
  });
});
