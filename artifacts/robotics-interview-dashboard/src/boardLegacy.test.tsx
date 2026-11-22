import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
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
vi.mock("./realtimeHealth", () => ({ useRealtimeHealthy: () => true }));

import { BoardChatCard } from "./components/BoardChatCard";
import { BoardEditor } from "./components/BoardEditor";

const legacyBoard = {
  id: "87b9f08a-8be9-4c0e-8399-b844450136c5",
  title: "To-Do",
  data: {
    kind: "board",
    version: 1,
    description: "Legacy board from before per-card arrays existed",
    columns: [{ id: "todo", title: "To-Do", color: "#16869a", position: 0 }],
    // The real board has 10 cards with no checklist/labels/attachments/
    // comments/activity fields. One card also has a malformed non-array field.
    cards: Array.from({ length: 10 }, (_, index) => ({
      id: `legacy-card-${index}`,
      title: `Legacy task ${index + 1}`,
      columnId: "todo",
      position: index,
      priority: "normal",
      ...(index === 0 ? { checklist: "not-an-array", labels: null } : {}),
    })),
  },
} as unknown as Board;

function renderWithBoard(board: Board, ui: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  boardHooks.useGetBoard.mockReturnValue({
    data: board,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  });
  boardHooks.useUpdateBoard.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(board) });
  boardHooks.useCreateBoardCardComment.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("legacy board data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("BoardChatCard renders a sensible summary without checklist data", () => {
    const onOpen = vi.fn();
    renderWithBoard(legacyBoard, (
      <BoardChatCard boardId={legacyBoard.id} fallbackTitle="To-Do" onOpen={onOpen} />
    ));

    const button = screen.getByTestId(`button-open-board-${legacyBoard.id}`);
    expect(button).toHaveTextContent("To-Do");
    const summary = screen.getByTestId(`text-board-summary-${legacyBoard.id}`);
    expect(summary).toHaveTextContent("10 cards");
    expect(summary).not.toHaveTextContent("subtasks complete");
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("BoardChatCard treats a non-array cards field as empty", () => {
    const malformed = { ...legacyBoard, data: { ...legacyBoard.data, cards: { broken: true } } } as unknown as Board;
    renderWithBoard(malformed, (
      <BoardChatCard boardId={legacyBoard.id} fallbackTitle="To-Do" onOpen={vi.fn()} />
    ));

    expect(screen.getByTestId(`text-board-summary-${legacyBoard.id}`)).toHaveTextContent("0 cards");
  });

  it("BoardEditor renders legacy cards in board, table, list, and detail views", () => {
    renderWithBoard(legacyBoard, (
      <BoardEditor boardId={legacyBoard.id} assignees={[]} onClose={vi.fn()} />
    ));

    expect(screen.getByTestId("card-board-legacy-card-0")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-view-table"));
    expect(screen.getByTestId("row-card-legacy-card-0")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("button-view-list"));
    expect(screen.getByTestId("list-card-legacy-card-0")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("list-open-card-legacy-card-0"));
    expect(screen.getByRole("dialog", { name: "Legacy task 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Checklist" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Team discussion/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity history" })).toBeInTheDocument();
    expect(screen.queryByTestId("text-checklist-progress-legacy-card-0")).not.toBeInTheDocument();
  });

  it("BoardEditor survives a malformed cards field", () => {
    const malformed = { ...legacyBoard, data: { ...legacyBoard.data, cards: "broken" } } as unknown as Board;
    renderWithBoard(malformed, (
      <BoardEditor boardId={legacyBoard.id} assignees={[]} onClose={vi.fn()} />
    ));

    expect(screen.getByTestId("board-editor")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-view-table"));
    expect(screen.getAllByTestId("status-board-empty").length).toBeGreaterThan(0);
  });
});
