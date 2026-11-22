import { fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Board } from "@workspace/api-client-react";

const boardHooks = vi.hoisted(() => ({
  useGetBoard: vi.fn(),
  useUpdateBoard: vi.fn(),
  useCreateBoardCardComment: vi.fn(),
  uploadBoardCardAsset: vi.fn(),
  deleteUnattachedBoardCardAsset: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetBoardQueryKey: (boardId: string) => ["board", boardId],
  useGetBoard: boardHooks.useGetBoard,
  useUpdateBoard: boardHooks.useUpdateBoard,
  useCreateBoardCardComment: boardHooks.useCreateBoardCardComment,
  uploadBoardCardAsset: boardHooks.uploadBoardCardAsset,
  deleteUnattachedBoardCardAsset: boardHooks.deleteUnattachedBoardCardAsset,
}));

vi.mock("../realtimeHealth", () => ({ useRealtimeHealthy: () => true }));

import { BoardEditor } from "./BoardEditor";

const fixture = {
  id: "board-12345678",
  title: "Build handoff",
  createdBy: "Riley Chen",
  scope: "shared",
  peer: null,
  createdAt: "2026-04-01T12:00:00.000Z",
  updatedAt: "2026-04-02T12:00:00.000Z",
  data: {
    kind: "board",
    version: 1,
    description: "Coordinate the drivetrain handoff",
    columns: [{ id: "backlog", title: "Backlog", color: "#70859a", position: 0 }],
    cards: [{
      id: "card-12345678",
      title: "Verify odometry",
      description: "Check encoder scaling before the next test.",
      columnId: "backlog",
      position: 0,
      priority: "high",
      assignee: "Jordan",
      startDate: null,
      dueDate: null,
      labels: [{ name: "drivebase", color: "#16869a" }],
      checklist: [
        { id: "step-a", title: "Confirm wheel diameter", completed: true },
        { id: "step-b", title: "Check encoder direction", completed: false },
      ],
      attachments: [{
        type: "link",
        id: "link-a",
        label: "Odometry notes",
        url: "https://example.org/odometry",
      }],
      cover: { type: "color", color: "#16869a" },
      comments: [{
        id: "comment-a",
        author: "Jordan",
        text: "I measured the wheels after the last practice.",
        createdAt: "2026-04-02T10:00:00.000Z",
      }],
      activity: [{
        id: "activity-a",
        actor: "Riley Chen",
        action: "moved",
        detail: "Moved to Backlog",
        createdAt: "2026-04-02T11:00:00.000Z",
      }],
      createdAt: "2026-04-01T12:00:00.000Z",
      updatedAt: "2026-04-02T11:00:00.000Z",
      updatedBy: "Riley Chen",
    }],
  },
} as unknown as Board;

function renderEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BoardEditor boardId={fixture.id} assignees={["Jordan", "Riley Chen"]} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("coordination board card collaboration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boardHooks.useGetBoard.mockReturnValue({
      data: fixture,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    boardHooks.useUpdateBoard.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(fixture) });
    boardHooks.useCreateBoardCardComment.mockReturnValue({ mutateAsync: vi.fn() });
  });

  it("shows checklist progress and readable color labels on board cards", () => {
    renderEditor();

    expect(screen.getByTestId("text-checklist-progress-card-12345678")).toHaveTextContent("1 / 2 complete");
    expect(screen.getByTestId("text-checklist-progress-card-12345678")).toHaveAttribute(
      "aria-label",
      "1 of 2 checklist items complete",
    );
    expect(screen.getByText("drivebase")).toHaveStyle({ borderColor: "rgba(22, 134, 154, 0.5)" });
    expect(screen.getByTestId("button-card-title-card-12345678")).toBeInTheDocument();
  });

  it("opens an accessible detail dialog with discussion, file, and history sections", () => {
    renderEditor();

    const cardTitle = screen.getByTestId("button-card-title-card-12345678");
    cardTitle.focus();
    fireEvent.click(cardTitle);
    expect(screen.getByRole("dialog", { name: "Verify odometry" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Checklist" })).toBeInTheDocument();
    expect(screen.getByLabelText("Mark Check encoder direction complete")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Team discussion/ })).toBeInTheDocument();
    expect(screen.getByText("I measured the wheels after the last practice.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity history" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Activity history" })).getByText("Riley Chen")).toBeInTheDocument();
    expect(screen.getByTestId("link-board-reference-link-a")).toHaveAttribute("href", "https://example.org/odometry");

    const closeButton = screen.getByTestId("button-close-dialog");
    const deleteButton = screen.getByTestId("button-delete-card");
    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(deleteButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Verify odometry" })).not.toBeInTheDocument();
    expect(cardTitle).toHaveFocus();
  });
});
