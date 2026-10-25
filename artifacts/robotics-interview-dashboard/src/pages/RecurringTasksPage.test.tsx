import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AssistantScheduledTask } from "@workspace/api-client-react";
import { RecurringTasksPage } from "./RecurringTasksPage";

const mocks = vi.hoisted(() => ({
  data: null as unknown,
  mutate: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@workspace/api-client-react", () => ({
  getListOwnedAssistantScheduledTasksQueryKey: () => ["owned-recurring-tasks"],
  useListOwnedAssistantScheduledTasks: () => ({
    data: mocks.data,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useManageOwnedAssistantScheduledTask: () => ({ mutate: mocks.mutate, isPending: false }),
}));

vi.mock("../components/assistantTools", () => ({
  loadDisabledTools: () => ["web_search"],
}));

vi.mock("../lib/dialogs", () => ({
  confirmAction: vi.fn(async () => true),
  notify: vi.fn(),
}));

const task: AssistantScheduledTask = {
  id: "task-one",
  prompt: "Summarize this week's build updates.",
  status: "active",
  recurrence: { frequency: "weekly", hour: 9, minute: 30, daysOfWeek: [1, 3] },
  timeZone: "America/Los_Angeles",
  destinationChannel: "Builds",
  nextRunAt: "2026-10-27T16:30:00.000Z",
  lastRunAt: "2026-10-20T16:30:00.000Z",
  lastError: "Provider timeout",
  createdAt: "2026-10-01T12:00:00.000Z",
  runs: [{
    id: "run-one",
    scheduledFor: "2026-10-20T16:30:00.000Z",
    status: "failed",
    attempt: 2,
    startedAt: "2026-10-20T16:30:02.000Z",
    finishedAt: "2026-10-20T16:30:05.000Z",
    result: null,
    error: "The model provider was unavailable.",
  }],
};

describe("RecurringTasksPage", () => {
  beforeEach(() => {
    mocks.data = { items: [task] };
    mocks.mutate.mockReset();
    mocks.invalidateQueries.mockReset();
  });

  it("shows schedule details and recent run errors", () => {
    render(<RecurringTasksPage />);

    expect(screen.getByTestId("task-prompt-task-one")).toHaveTextContent(task.prompt);
    expect(screen.getByTestId("task-cadence-task-one")).toHaveTextContent("Every Monday, Wednesday");
    expect(screen.getByTestId("task-cadence-task-one")).toHaveTextContent("America/Los_Angeles");
    expect(screen.getByTestId("task-next-run-task-one")).toHaveTextContent("Last run");
    expect(screen.getByTestId("task-run-detail-run-one")).toHaveTextContent("The model provider was unavailable.");
    expect(screen.getByTestId("task-run-run-one")).toHaveTextContent("failed");
  });

  it("routes pause through the owned task action with the current disabled-tool selection", () => {
    render(<RecurringTasksPage />);
    fireEvent.click(screen.getByTestId("button-task-pause-task-one"));

    expect(mocks.mutate).toHaveBeenCalledWith(
      { data: { taskId: "task-one", action: "pause", disabledTools: ["web_search"] } },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
  });

  it("edits cadence and timezone without replacing the saved destination", () => {
    render(<RecurringTasksPage />);
    fireEvent.click(screen.getByTestId("button-task-edit-task-one"));
    fireEvent.change(screen.getByTestId("input-task-prompt"), { target: { value: "Updated build summary." } });
    fireEvent.change(screen.getByTestId("input-task-time"), { target: { value: "10:45" } });
    fireEvent.change(screen.getByTestId("input-task-timezone"), { target: { value: "UTC" } });
    fireEvent.click(screen.getByTestId("button-edit-task-save"));

    expect(mocks.mutate).toHaveBeenCalledWith(
      {
        data: expect.objectContaining({
          taskId: "task-one",
          action: "edit",
          prompt: "Updated build summary.",
          frequency: "weekly",
          hour: 10,
          minute: 45,
          daysOfWeek: [1, 3],
          timeZone: "UTC",
          disabledTools: ["web_search"],
        }),
      },
      expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) }),
    );
    expect(mocks.mutate.mock.calls[0]?.[0]?.data).not.toHaveProperty("channelName");
  });
});
