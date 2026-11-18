import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { GetAssistantUsageResponse } from "@workspace/api-zod";
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
  productivityUsage: {
    requests: 2,
    inputTokens: 41,
    outputTokens: 16,
    totalTokens: 57,
    usageReportedRequests: 1,
    usageUnavailableRequests: 1,
  },
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

  it("shows productivity review tokens and unavailable requests for the selected range", () => {
    expect(GetAssistantUsageResponse.safeParse(report).success).toBe(true);
    renderSettings();
    const section = screen.getByTestId("productivity-usage");
    expect(section).toHaveTextContent("Productivity-score review usage");
    expect(section).toHaveTextContent("Review requests");
    expect(section).toHaveTextContent("41");
    expect(section).toHaveTextContent("16");
    expect(section).toHaveTextContent("57");
    expect(section).toHaveTextContent("1 request had one or more missing provider-reported token counts.");
    expect(section).toHaveTextContent("Reviews from before usage tracking are not included");
  });

  it("does not show estimated tokens when the provider reports no usage", () => {
    const saved = { ...report.productivityUsage };
    Object.assign(report.productivityUsage, {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      usageReportedRequests: 0,
      usageUnavailableRequests: 2,
    });
    expect(GetAssistantUsageResponse.safeParse(report).success).toBe(true);
    renderSettings();
    expect(screen.getAllByText("—")).toHaveLength(3);
    expect(screen.getByTestId("productivity-usage")).toHaveTextContent("2 requests had one or more missing provider-reported token counts.");
    Object.assign(report.productivityUsage, saved);
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
