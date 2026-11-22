import { useGetBoard, getGetBoardQueryKey, type Board } from "@workspace/api-client-react";
import { ChevronRight, ClipboardList } from "lucide-react";

import { useRealtimeHealthy } from "../realtimeHealth";
type BoardChatCardProps = {
  boardId: string;
  fallbackTitle: string;
  onOpen: () => void;
};

export function BoardChatCard({ boardId, fallbackTitle, onOpen }: BoardChatCardProps) { const streamHealthy = useRealtimeHealthy();
  const query = useGetBoard(boardId, {
    query: {
      queryKey: getGetBoardQueryKey(boardId),
      refetchInterval: streamHealthy ? false : (3_000),
    },
  });
  const board = query.data as Board | undefined;
  const title = board?.title ?? fallbackTitle;
  const description = board?.data.description;
  const cards = board?.data.cards ?? [];
  const checklistCount = cards.reduce((total, card) => total + card.checklist.length, 0);
  const completedChecklistCount = cards.reduce((total, card) => total + card.checklist.filter(item => item.completed).length, 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mt-2 flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-card-foreground transition hover:border-primary/50 hover:bg-accent"
      data-testid={`button-open-board-${boardId}`}
      aria-label={`Open board: ${title}`}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
        <ClipboardList size={18} />
      </span>
      <span className="min-w-0">
        <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-primary">Shared board</span>
        <span className="mt-0.5 block truncate text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
          {description || "No description yet"}
        </span>
        {board && <span className="mt-1 block text-[10px] text-muted-foreground" data-testid={`text-board-summary-${boardId}`}>
          {cards.length} {cards.length === 1 ? "card" : "cards"}{checklistCount ? ` · ${completedChecklistCount}/${checklistCount} subtasks complete` : ""}
        </span>}
      </span>
      <ChevronRight size={16} className="ml-auto shrink-0 text-primary" />
    </button>
  );
}