import { useMemo, useState, type DragEvent, type FormEvent, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { confirmAction } from "@/lib/dialogs";
import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Columns3,
  GripVertical,
  LayoutGrid,
  List,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Table2,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  getGetBoardQueryKey,
  useGetBoard,
  useUpdateBoard,
  type Board,
  type BoardCard,
  type BoardCardInput,
  type BoardCardPatch,
  type BoardColumn,
  type BoardOperationInput,
} from "@workspace/api-client-react";

import { useRealtimeHealthy } from "../realtimeHealth";
type BoardEditorProps = { boardId: string; assignees: string[]; onClose: () => void };
type ViewMode = "board" | "table" | "list" | "timeline";
type Modal = "card" | "bulk" | "column" | "renameColumn" | "boardDetails" | null;
type CardDraft = {
  title: string;
  description: string;
  priority: BoardCard["priority"];
  assignee: string;
  startDate: string;
  dueDate: string;
  labels: string;
};

const priorityMeta: Record<BoardCard["priority"], { label: string; color: string; bg: string }> = {
  urgent: { label: "Urgent", color: "hsl(5 70% 48%)", bg: "hsl(5 72% 95%)" },
  high: { label: "High", color: "hsl(30 72% 44%)", bg: "hsl(35 76% 94%)" },
  normal: { label: "Normal", color: "hsl(190 62% 36%)", bg: "hsl(185 58% 94%)" },
  low: { label: "Low", color: "hsl(151 47% 38%)", bg: "hsl(150 48% 94%)" },
};

function dateLabel(value: string | null) {
  if (!value) return "No date";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dateTimeLabel(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function initials(value: string | null) {
  if (!value) return "?";
  return value.trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function Button({ children, onClick, variant = "secondary", disabled = false, label, className = "" }: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "quiet" | "danger"; disabled?: boolean; label: string; className?: string;
}) {
  const styles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "border border-border bg-card text-foreground hover:border-primary/60 hover:bg-accent",
    quiet: "text-muted-foreground hover:bg-accent hover:text-foreground",
    danger: "border border-destructive/30 bg-card text-destructive hover:bg-destructive/10",
  };
  return <button type="button" aria-label={label} data-testid={`button-${label.toLowerCase().replace(/\s+/g, "-")}`} onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}>{children}</button>;
}

function PriorityBadge({ priority }: { priority: BoardCard["priority"] }) {
  const meta = priorityMeta[priority];
  return <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em]" style={{ color: meta.color, background: meta.bg }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />{meta.label}</span>;
}

function Avatar({ name }: { name: string | null }) {
  return <span title={name ?? "Unassigned"} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 font-mono text-[10px] font-bold text-primary">{initials(name)}</span>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[.13em] text-muted-foreground">{children}</span>;
}

function CardForm({ draft, setDraft, onSubmit, onCancel, saving, assignees, columns, columnId, onColumnChange, submitLabel }: {
  draft: CardDraft; setDraft: (next: CardDraft) => void; onSubmit: (event: FormEvent) => void; onCancel?: () => void; saving: boolean; assignees: string[]; columns?: BoardColumn[]; columnId?: string; onColumnChange?: (value: string) => void; submitLabel: string;
}) {
  const update = (patch: Partial<CardDraft>) => setDraft({ ...draft, ...patch });
  return <form onSubmit={onSubmit} className="space-y-4">
    <label className="block"><FieldLabel>Card title</FieldLabel><input required maxLength={200} autoFocus value={draft.title} onChange={e => update({ title: e.target.value })} data-testid="input-card-title" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="e.g. Confirm autonomous navigation" /></label>
    <label className="block"><FieldLabel>Brief</FieldLabel><textarea maxLength={12000} value={draft.description} onChange={e => update({ description: e.target.value })} data-testid="input-card-description" className="min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Context for the next interviewer…" /></label>
    <div className="grid grid-cols-2 gap-3">
      <label><FieldLabel>Priority</FieldLabel><select value={draft.priority} onChange={e => update({ priority: e.target.value as BoardCard["priority"] })} data-testid="select-card-priority" className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary">{Object.keys(priorityMeta).map(value => <option key={value} value={value}>{priorityMeta[value as BoardCard["priority"]].label}</option>)}</select></label>
      <label><FieldLabel>Assignee</FieldLabel><select value={draft.assignee} onChange={e => update({ assignee: e.target.value })} data-testid="select-card-assignee" className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary"><option value="">Unassigned</option>{assignees.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    </div>
    {columns && onColumnChange && <label><FieldLabel>Column</FieldLabel><select value={columnId} onChange={e => onColumnChange(e.target.value)} data-testid="select-card-column" className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary">{columns.map(column => <option value={column.id} key={column.id}>{column.title}</option>)}</select></label>}
    <div className="grid grid-cols-2 gap-3">
      <label><FieldLabel>Start date</FieldLabel><input type="date" value={draft.startDate} onChange={e => update({ startDate: e.target.value })} data-testid="input-card-start-date" className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary" /></label>
      <label><FieldLabel>Due date</FieldLabel><input type="date" value={draft.dueDate} onChange={e => update({ dueDate: e.target.value })} data-testid="input-card-due-date" className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm outline-none focus:border-primary" /></label>
    </div>
    <label className="block"><FieldLabel>Labels</FieldLabel><input value={draft.labels} onChange={e => update({ labels: e.target.value })} data-testid="input-card-labels" className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary" placeholder="handoff, onsite, hardware" /><span className="mt-1 block text-[11px] text-muted-foreground">Separate labels with commas.</span></label>
    <div className="flex justify-end gap-2 border-t border-border pt-4">{onCancel && <Button label="cancel-card" onClick={onCancel}>Cancel</Button>}<Button label={submitLabel} variant="primary" disabled={saving}>{saving && <LoaderCircle size={14} className="animate-spin" />}{submitLabel}</Button></div>
  </form>;
}

function CardTile({ card, onOpen, selected, onSelect, onDragStart, onDrop, columns, onMove }: { card: BoardCard; onOpen: () => void; selected: boolean; onSelect: () => void; onDragStart: (event: DragEvent) => void; onDrop: (event: DragEvent) => void; columns: BoardColumn[]; onMove: (columnId: string) => void }) {
  return <article draggable onDragStart={onDragStart} onDragOver={event => { event.preventDefault(); event.stopPropagation(); }} onDrop={onDrop} onClick={onOpen} data-testid={`card-board-${card.id}`} className="group cursor-pointer rounded-xl border border-border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-md">
    <div className="flex items-start gap-2"><input type="checkbox" checked={selected} onChange={event => { event.stopPropagation(); onSelect(); }} onClick={event => event.stopPropagation()} aria-label={`Select ${card.title}`} data-testid={`checkbox-card-${card.id}`} className="mt-0.5 h-3.5 w-3.5 accent-[hsl(var(--primary))]" /><GripVertical size={14} className="mt-0.5 shrink-0 text-muted-foreground/50" /><h3 className="min-w-0 flex-1 text-sm font-semibold leading-5 text-card-foreground">{card.title}</h3><MoreHorizontal size={15} className="shrink-0 text-muted-foreground/60" /></div>
    {card.description && <p className="mt-2 line-clamp-2 pl-[3.5rem] text-xs leading-5 text-muted-foreground">{card.description}</p>}
    <div className="mt-3 flex flex-wrap items-center gap-1.5 pl-[3.5rem]"><PriorityBadge priority={card.priority} />{card.labels.slice(0, 2).map(label => <span key={label} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground"><Tag size={10} />{label}</span>)}</div>
    <div className="mt-3 flex items-center justify-between border-t border-border/70 pt-2 pl-[3.5rem]"><span className={`inline-flex items-center gap-1 text-[10px] ${card.dueDate && new Date(`${card.dueDate}T23:59:59`).getTime() < Date.now() ? "font-semibold text-destructive" : "text-muted-foreground"}`}><CalendarDays size={12} />{dateLabel(card.dueDate)}</span><Avatar name={card.assignee} /></div>
    {columns.length > 1 && <div className="mt-2 pl-[3.5rem]"><label className="sr-only" htmlFor={`card-column-${card.id}`}>Column for {card.title}</label><select id={`card-column-${card.id}`} value={card.columnId} onClick={event => event.stopPropagation()} onChange={event => onMove(event.target.value)} aria-label={`Move ${card.title} to a column`} data-testid={`select-card-column-${card.id}`} className="touch-target h-9 w-full rounded-lg border border-border bg-background px-2 text-[11px] text-muted-foreground outline-none focus:border-primary">{columns.map(column => <option key={column.id} value={column.id}>{column.title}</option>)}</select></div>}
  </article>;
}

function ModalShell({ title, eyebrow, onClose, children, width = "max-w-xl" }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; width?: string }) {
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/35 p-3 backdrop-blur-[2px] sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" className={`max-h-[92dvh] w-full ${width} overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6`}><div className="mb-5 flex items-start justify-between gap-4"><div>{eyebrow && <p className="mono text-[10px] font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p>}<h2 className="mt-1 text-xl font-semibold tracking-tight text-card-foreground">{title}</h2></div><Button label="close-dialog" variant="quiet" onClick={onClose}><X size={18} /></Button></div>{children}</div></div>;
}

function LoadingBoard() {
  return <div className="flex min-h-[70dvh] items-center justify-center p-6"><div className="w-full max-w-3xl space-y-4" data-testid="status-board-loading"><div className="h-8 w-64 animate-pulse rounded-lg bg-muted" /><div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map(key => <div key={key} className="h-64 animate-pulse rounded-2xl bg-muted" />)}</div></div></div>;
}

export function BoardEditor({ boardId, assignees, onClose }: BoardEditorProps) { const streamHealthy = useRealtimeHealthy();
  const queryClient = useQueryClient();
  const query = useGetBoard(boardId, { query: { queryKey: getGetBoardQueryKey(boardId), refetchInterval: streamHealthy ? false : (3_000 )} });
  const updateBoard = useUpdateBoard();
  const [view, setView] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<BoardCard["priority"] | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [modalColumn, setModalColumn] = useState<BoardColumn | null>(null);
  const [draftColumnId, setDraftColumnId] = useState("");
  const [draft, setDraft] = useState<CardDraft>({ title: "", description: "", priority: "normal", assignee: "", startDate: "", dueDate: "", labels: "" });
  const [bulkText, setBulkText] = useState("");
  const [columnTitle, setColumnTitle] = useState("");
  const [columnColor, setColumnColor] = useState("#16869a");
  const [renameTitle, setRenameTitle] = useState("");
  const [boardTitleDraft, setBoardTitleDraft] = useState("");
  const [boardDescriptionDraft, setBoardDescriptionDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sort, setSort] = useState<"position" | "priority" | "dueDate" | "title">("position");

  const board = query.data as Board | undefined;
  const columns = useMemo(() => [...(board?.data?.columns ?? [])].sort((a, b) => a.position - b.position), [board?.data?.columns]);
  const cards = useMemo(() => board?.data?.cards ?? [], [board?.data?.cards]);
  const filteredCards = useMemo(() => cards.filter(card => {
    const haystack = `${card.title} ${card.description} ${card.labels.join(" ")} ${card.assignee ?? ""}`.toLowerCase();
    return (!search.trim() || haystack.includes(search.trim().toLowerCase())) && (priorityFilter === "all" || card.priority === priorityFilter) && (assigneeFilter === "all" || card.assignee === assigneeFilter);
  }), [cards, search, priorityFilter, assigneeFilter]);
  const orderedCards = useMemo(() => [...filteredCards].sort((a, b) => sort === "title"
    ? a.title.localeCompare(b.title)
    : sort === "dueDate"
      ? (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")
      : sort === "priority"
        ? Object.keys(priorityMeta).indexOf(a.priority) - Object.keys(priorityMeta).indexOf(b.priority)
        : a.position - b.position), [filteredCards, sort]);

  const apply = async (operation: BoardOperationInput) => {
    setSaving(true); setError("");
    try {
      const updated = await updateBoard.mutateAsync({ boardId, data: operation });
      queryClient.setQueryData(getGetBoardQueryKey(boardId), updated);
      return updated;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this board change.");
      return null;
    } finally { setSaving(false); }
  };

  const beginCreate = (columnId = columns[0]?.id ?? "") => {
    setActiveCard(null); setDraftColumnId(columnId); setDraft({ title: "", description: "", priority: "normal", assignee: "", startDate: "", dueDate: "", labels: "" }); setModal("card");
  };
  const beginEdit = (card: BoardCard) => {
    setActiveCard(card); setDraftColumnId(card.columnId); setDraft({ title: card.title, description: card.description, priority: card.priority, assignee: card.assignee ?? "", startDate: card.startDate ?? "", dueDate: card.dueDate ?? "", labels: card.labels.join(", ") }); setModal(null);
  };
  const submitCard = async (event: FormEvent) => {
    event.preventDefault();
    const labels = draft.labels.split(",").map(value => value.trim()).filter(Boolean).slice(0, 12);
    if (!draft.title.trim()) return;
    if (activeCard) {
      const patch: BoardCardPatch = { title: draft.title.trim(), description: draft.description, priority: draft.priority, assignee: draft.assignee || null, startDate: draft.startDate || null, dueDate: draft.dueDate || null, labels };
      const result = await apply({ operation: "update_card", cardId: activeCard.id, cardPatch: patch });
      if (result && draftColumnId !== activeCard.columnId) await apply({ operation: "move_card", cardId: activeCard.id, targetColumnId: draftColumnId, beforeCardId: null });
      if (result) setActiveCard(null);
    } else {
      const result = await apply({ operation: "create_card", card: { title: draft.title.trim(), description: draft.description, columnId: draftColumnId || undefined, priority: draft.priority, assignee: draft.assignee || null, startDate: draft.startDate || null, dueDate: draft.dueDate || null, labels } as BoardCardInput });
      if (result) setModal(null);
    }
  };

  const openDetail = (card: BoardCard) => beginEdit(card);
  const deleteCard = async () => {
    if (!activeCard || !(await confirmAction({ title: `Delete "${activeCard.title}"?`, danger: true, confirmLabel: "Delete" }))) return;
    const result = await apply({ operation: "delete_card", cardId: activeCard.id });
    if (result) setActiveCard(null);
  };
  const handleDrop = async (event: DragEvent, targetColumnId: string, beforeCardId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    const cardId = event.dataTransfer.getData("text/board-card");
    if (!cardId || cardId === beforeCardId) return;
    await apply({ operation: "move_card", cardId, targetColumnId, beforeCardId: beforeCardId ?? null });
  };
  const beginEditBoardDetails = () => {
    if (!board) return;
    setBoardTitleDraft(board.title);
    setBoardDescriptionDraft(board.data.description);
    setError("");
    setModal("boardDetails");
  };
  const submitBoardDetails = async (event: FormEvent) => {
    event.preventDefault();
    const title = boardTitleDraft.trim();
    if (!title) return;
    const result = await apply({
      operation: "rename_board",
      title,
      description: boardDescriptionDraft.trim(),
    });
    if (result) setModal(null);
  };
  const submitBulk = async (event: FormEvent) => {
    event.preventDefault();
    const titles = bulkText.split(/\r?\n/).map(value => value.trim()).filter(Boolean).slice(0, 250);
    if (!titles.length) return;
    const result = await apply({ operation: "bulk_add_cards", titles, targetColumnId: columns[0]?.id });
    if (result) { setBulkText(""); setModal(null); }
  };
  const submitColumn = async (event: FormEvent) => {
    event.preventDefault();
    if (!columnTitle.trim()) return;
    const operation = modal === "renameColumn" && modalColumn ? { operation: "rename_column" as const, columnId: modalColumn.id, title: columnTitle.trim(), color: columnColor } : { operation: "create_column" as const, title: columnTitle.trim(), color: columnColor };
    const result = await apply(operation);
    if (result) { setModal(null); setColumnTitle(""); }
  };
  const deleteColumn = async (column: BoardColumn) => {
    if (!(await confirmAction({ title: `Delete "${column.title}"?`, detail: "Its cards will be moved to another column.", danger: true, confirmLabel: "Delete" }))) return;
    await apply({ operation: "delete_column", columnId: column.id });
  };
  const bulkAction = async (operation: "bulk_move_cards" | "bulk_delete_cards", targetColumnId?: string) => {
    if (!selected.length) return;
    if (operation === "bulk_delete_cards" && !(await confirmAction({ title: `Delete ${selected.length} selected cards?`, danger: true, confirmLabel: "Delete all" }))) return;
    const result = await apply(operation === "bulk_move_cards" ? { operation, cardIds: selected, targetColumnId } : { operation, cardIds: selected });
    if (result) setSelected([]);
  };

  if (!board && query.isLoading) return <div className="fixed inset-0 z-[80] overflow-y-auto bg-background"><LoadingBoard /></div>;
  if (!board) return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-background p-6"><div className="max-w-sm text-center" data-testid="status-board-error"><AlertCircle className="mx-auto mb-3 text-destructive" size={30} /><h2 className="text-lg font-semibold">Board unavailable</h2><p className="mt-1 text-sm text-muted-foreground">The coordination board could not be loaded.</p><div className="mt-5 flex justify-center gap-2"><Button label="retry-board" onClick={() => query.refetch()} variant="primary">Retry</Button><Button label="close-board" onClick={onClose}>Close</Button></div></div></div>;

  return <div className="fixed inset-0 z-[80] flex min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground" role="dialog" aria-modal="true" aria-label="Board editor" data-testid="board-editor">
    <header className="shrink-0 border-b border-border bg-card/95 shadow-sm backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ClipboardList size={18} /></div><div className="min-w-0"><p className="mono text-[9px] font-bold uppercase tracking-[.18em] text-primary">Coordination board</p><h1 className="truncate text-lg font-semibold tracking-tight">{board.title}</h1><p className="max-w-[560px] truncate text-xs text-muted-foreground">{board.data.description || "No description yet"}</p></div></div>
        <div className="flex items-center gap-2"><span className="hidden items-center gap-1.5 text-[11px] text-muted-foreground sm:flex"><span className={`h-1.5 w-1.5 rounded-full ${saving ? "bg-accent" : error || query.isError ? "bg-destructive" : "bg-primary"}`} />{saving ? "Saving" : error ? "Save issue" : query.isError ? "Sync issue" : "Live"}</span><Button label="edit-board-details" onClick={beginEditBoardDetails}><Pencil size={14} />Edit details</Button><Button label="close-editor" onClick={onClose}><X size={15} />Close</Button></div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-2.5 sm:px-6">
        <div className="flex rounded-lg border border-border bg-muted/50 p-0.5" role="tablist" aria-label="Board views">{([["board", LayoutGrid, "Board"], ["table", Table2, "Table"], ["list", List, "List"], ["timeline", CalendarDays, "Timeline"]] as const).map(([value, Icon, label]) => <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} data-testid={`button-view-${value}`} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${view === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}><Icon size={14} />{label}</button>)}</div>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs"><Search size={14} className="absolute left-3 top-2.5 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} aria-label="Search board cards" data-testid="input-board-search" className="h-8 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary" placeholder="Search cards, labels, assignees" /></div>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value as BoardCard["priority"] | "all")} aria-label="Filter by priority" data-testid="select-board-priority-filter" className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"><option value="all">All priorities</option>{Object.keys(priorityMeta).map(value => <option key={value} value={value}>{priorityMeta[value as BoardCard["priority"]].label}</option>)}</select>
        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)} aria-label="Filter by assignee" data-testid="select-board-assignee-filter" className="hidden h-8 max-w-[150px] rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary sm:block"><option value="all">All assignees</option>{assignees.map(name => <option key={name} value={name}>{name}</option>)}</select>
        {view !== "board" && <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} aria-label="Sort cards" data-testid="select-board-sort" className="h-8 rounded-lg border border-border bg-background px-2 text-xs outline-none focus:border-primary"><option value="position">Board order</option><option value="title">Title</option><option value="priority">Priority</option><option value="dueDate">Due date</option></select>}
        <div className="ml-auto flex items-center gap-1"><Button label="add-card" variant="primary" onClick={() => beginCreate()}><Plus size={15} />Add card</Button><Button label="bulk-add-cards" onClick={() => setModal("bulk")}><Plus size={14} />Bulk add</Button><Button label="add-column" onClick={() => { setColumnTitle(""); setColumnColor("#16869a"); setModal("column"); }}><Columns3 size={14} />Column</Button></div>
      </div>
    </header>
    {error && <div className="flex shrink-0 items-center gap-2 border-b border-destructive/25 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive sm:px-6" role="alert"><AlertCircle size={14} />{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss save error" data-testid="button-dismiss-save-error" className="ml-auto"><X size={14} /></button></div>}
    {selected.length > 0 && <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-4 py-2 sm:px-6"><span className="text-xs font-semibold text-primary">{selected.length} selected</span><select onChange={e => { if (e.target.value) void bulkAction("bulk_move_cards", e.target.value); e.currentTarget.value = ""; }} aria-label="Move selected cards" data-testid="select-bulk-move" className="h-8 rounded-lg border border-primary/20 bg-card px-2 text-xs"><option value="">Move to…</option>{columns.map(column => <option key={column.id} value={column.id}>{column.title}</option>)}</select><Button label="delete-selected-cards" variant="danger" onClick={() => void bulkAction("bulk_delete_cards")}><Trash2 size={13} />Delete</Button><Button label="clear-selection" variant="quiet" onClick={() => setSelected([])}>Clear</Button></div>}
    <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
      {view === "board" && <div className="flex min-h-full gap-4 overflow-x-auto pb-3">{columns.map(column => {
        const columnCards = filteredCards.filter(card => card.columnId === column.id).sort((a, b) => a.position - b.position);
        return <section key={column.id} onDragOver={event => event.preventDefault()} onDrop={event => void handleDrop(event, column.id)} className="w-[min(86vw,330px)] min-w-[280px] shrink-0 rounded-2xl border border-border bg-muted/35 p-2.5 sm:w-[310px]" data-testid={`column-board-${column.id}`}>
          <div className="flex items-center gap-2 px-2 py-2"><span className="h-2 w-2 rounded-full" style={{ background: column.color }} /><h2 className="min-w-0 flex-1 truncate text-sm font-semibold">{column.title}</h2><span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{columnCards.length}</span><div className="relative"><button type="button" onClick={() => { setModalColumn(column); setColumnTitle(column.title); setColumnColor(column.color); setModal("renameColumn"); }} aria-label={`Manage ${column.title}`} data-testid={`button-manage-column-${column.id}`} className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"><MoreHorizontal size={16} /></button></div></div>
           <div className="space-y-2">{columnCards.map(card => <CardTile key={card.id} card={card} columns={columns} selected={selected.includes(card.id)} onSelect={() => setSelected(current => current.includes(card.id) ? current.filter(id => id !== card.id) : [...current, card.id])} onOpen={() => openDetail(card)} onDragStart={event => { event.dataTransfer.setData("text/board-card", card.id); event.dataTransfer.effectAllowed = "move"; }} onDrop={event => void handleDrop(event, column.id, card.id)} onMove={columnId => void apply({ operation: "move_card", cardId: card.id, targetColumnId: columnId, beforeCardId: null })} />)}</div>
          <button type="button" onClick={() => beginCreate(column.id)} data-testid={`button-add-card-${column.id}`} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground transition hover:border-primary/50 hover:bg-card hover:text-primary"><Plus size={14} />Add card</button>
        </section>;
      })}<button type="button" onClick={() => { setColumnTitle(""); setModal("column"); }} data-testid="button-add-column-empty" className="flex h-14 min-w-[170px] items-center justify-center gap-2 rounded-xl border border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-primary/50 hover:text-primary"><Plus size={15} />Add column</button></div>}
      {view === "table" && <div className="overflow-x-auto rounded-2xl border border-border bg-card"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-border bg-muted/35 text-[10px] uppercase tracking-[.12em] text-muted-foreground"><tr><th className="w-10 px-4 py-3" /><th className="px-4 py-3">Card</th><th className="px-4 py-3">Column</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Assignee</th><th className="px-4 py-3">Due</th><th className="px-4 py-3">Updated</th></tr></thead><tbody className="divide-y divide-border">{orderedCards.map(card => <tr key={card.id} onClick={() => openDetail(card)} className="cursor-pointer transition hover:bg-accent/50" data-testid={`row-card-${card.id}`}><td className="px-4 py-3"><input type="checkbox" checked={selected.includes(card.id)} onClick={e => e.stopPropagation()} onChange={() => setSelected(current => current.includes(card.id) ? current.filter(id => id !== card.id) : [...current, card.id])} aria-label={`Select ${card.title}`} /></td><td className="max-w-[280px] px-4 py-3"><p className="font-semibold">{card.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{card.description || "No brief added"}</p></td><td className="px-4 py-3 text-xs text-muted-foreground">{columns.find(column => column.id === card.columnId)?.title ?? "Unsorted"}</td><td className="px-4 py-3"><PriorityBadge priority={card.priority} /></td><td className="px-4 py-3"><span className="inline-flex items-center gap-2 text-xs">{card.assignee && <Avatar name={card.assignee} />}{card.assignee ?? "Unassigned"}</span></td><td className="px-4 py-3 text-xs text-muted-foreground">{dateLabel(card.dueDate)}</td><td className="px-4 py-3 text-xs text-muted-foreground">{dateTimeLabel(card.updatedAt)}</td></tr>)}</tbody></table>{filteredCards.length === 0 && <EmptyResults />}</div>}
      {view === "list" && <div className="mx-auto max-w-4xl space-y-2">{orderedCards.length ? orderedCards.map(card => <div key={card.id} onClick={() => openDetail(card)} data-testid={`list-card-${card.id}`} className="flex cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition hover:border-primary/40 hover:shadow-sm"><input type="checkbox" checked={selected.includes(card.id)} onClick={e => e.stopPropagation()} onChange={() => setSelected(current => current.includes(card.id) ? current.filter(id => id !== card.id) : [...current, card.id])} aria-label={`Select ${card.title}`} /><span className="h-8 w-1 rounded-full" style={{ background: priorityMeta[card.priority].color }} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{card.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{card.description || "No brief added"}</p></div><span className="hidden text-xs text-muted-foreground sm:block">{columns.find(column => column.id === card.columnId)?.title}</span><PriorityBadge priority={card.priority} /><Avatar name={card.assignee} /></div>) : <EmptyResults />}</div>}
      {view === "timeline" && <Timeline cards={filteredCards} columns={columns} onOpen={openDetail} />}
      {view !== "board" && filteredCards.length === 0 && view !== "list" && <EmptyResults />}
    </main>
    {modal === "boardDetails" && <ModalShell title="Edit board details" eyebrow="Board settings" onClose={() => setModal(null)}><form onSubmit={submitBoardDetails} className="space-y-4"><label className="block"><FieldLabel>Board name</FieldLabel><input required autoFocus maxLength={120} value={boardTitleDraft} onChange={event => setBoardTitleDraft(event.target.value)} aria-label="Board name" data-testid="input-board-title" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="Name this board" /></label><label className="block"><FieldLabel>Description</FieldLabel><textarea maxLength={500} rows={4} value={boardDescriptionDraft} onChange={event => setBoardDescriptionDraft(event.target.value)} aria-label="Board description" data-testid="input-board-description" className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="What is this board for? Give teammates useful context." /></label><p className="-mt-2 text-[11px] text-muted-foreground">Shown on the board card in chat. You can leave it blank.</p><div className="flex justify-end gap-2 border-t border-border pt-4"><Button label="cancel-board-details" onClick={() => setModal(null)}>Cancel</Button><Button label="save-board-details" variant="primary" disabled={saving || !boardTitleDraft.trim()}>{saving && <LoaderCircle size={14} className="animate-spin" />}Save details</Button></div></form></ModalShell>}
    {modal === "card" && <ModalShell title="New coordination card" eyebrow="Add handoff" onClose={() => setModal(null)}><CardForm draft={draft} setDraft={setDraft} onSubmit={submitCard} onCancel={() => setModal(null)} saving={saving} assignees={assignees} columns={columns} columnId={draftColumnId} onColumnChange={setDraftColumnId} submitLabel="Create card" /></ModalShell>}
    {activeCard && <ModalShell title="Edit coordination card" eyebrow="Card detail" onClose={() => setActiveCard(null)}><CardForm draft={draft} setDraft={setDraft} onSubmit={submitCard} onCancel={() => setActiveCard(null)} saving={saving} assignees={assignees} columns={columns} columnId={draftColumnId} onColumnChange={setDraftColumnId} submitLabel="Save changes" /><div className="mt-3 border-t border-border pt-3"><Button label="delete-card" variant="danger" onClick={() => void deleteCard()} disabled={saving}><Trash2 size={14} />Delete card</Button><p className="mt-2 text-[11px] text-muted-foreground">Created {dateTimeLabel(activeCard.createdAt)} · Last updated by {activeCard.updatedBy}</p></div></ModalShell>}
    {modal === "bulk" && <ModalShell title="Add a run of cards" eyebrow="Bulk add" onClose={() => setModal(null)}><form onSubmit={submitBulk}><p className="mb-3 text-sm text-muted-foreground">One card per line. New cards land in {columns[0]?.title ?? "the first column"}.</p><textarea required value={bulkText} onChange={e => setBulkText(e.target.value)} autoFocus data-testid="textarea-bulk-card-titles" className="min-h-48 w-full resize-y rounded-xl border border-input bg-background p-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder={"Verify battery safety\nCheck manipulator handoff\nReview final rubric"} /><div className="mt-4 flex justify-end gap-2"><Button label="cancel-bulk-add" onClick={() => setModal(null)}>Cancel</Button><Button label="create-bulk-cards" variant="primary" disabled={saving}>{saving && <LoaderCircle size={14} className="animate-spin" />}Add cards</Button></div></form></ModalShell>}
    {(modal === "column" || modal === "renameColumn") && <ModalShell title={modal === "column" ? "Create a column" : "Rename column"} eyebrow="Board structure" onClose={() => setModal(null)}><form onSubmit={submitColumn} className="space-y-4"><label><FieldLabel>Column name</FieldLabel><input required maxLength={80} autoFocus value={columnTitle} onChange={e => setColumnTitle(e.target.value)} data-testid="input-column-title" className="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary" placeholder="Ready for interview" /></label><label><FieldLabel>Accent color</FieldLabel><div className="flex items-center gap-3"><input type="color" value={columnColor} onChange={e => setColumnColor(e.target.value)} data-testid="input-column-color" className="h-10 w-14 cursor-pointer rounded-lg border border-input bg-background p-1" /><span className="font-mono text-xs text-muted-foreground">{columnColor}</span></div></label><div className="flex justify-between gap-2 border-t border-border pt-4">{modal === "renameColumn" && modalColumn && <Button label="delete-column" variant="danger" onClick={() => { void deleteColumn(modalColumn); setModal(null); }}><Trash2 size={14} />Delete column</Button>}<div className="ml-auto flex gap-2"><Button label="cancel-column" onClick={() => setModal(null)}>Cancel</Button><Button label="save-column" variant="primary" disabled={saving}>{saving && <LoaderCircle size={14} className="animate-spin" />}{modal === "column" ? "Create column" : "Save column"}</Button></div></div></form></ModalShell>}
  </div>;
}

function EmptyResults() {
  return <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center" data-testid="status-board-empty"><Search size={22} className="text-muted-foreground" /><p className="mt-3 text-sm font-semibold">No cards match this view</p><p className="mt-1 text-xs text-muted-foreground">Try a different search or filter.</p></div>;
}

function Timeline({ cards, columns, onOpen }: { cards: BoardCard[]; columns: BoardColumn[]; onOpen: (card: BoardCard) => void }) {
  const dated = cards.filter(card => card.startDate || card.dueDate);
  const bounds = useMemo(() => {
    const dates = dated.flatMap(card => [card.startDate, card.dueDate]).filter((value): value is string => Boolean(value)).sort();
    const start = dates[0] ? new Date(`${dates[0]}T00:00:00`) : new Date();
    const end = dates[dates.length - 1] ? new Date(`${dates[dates.length - 1]}T00:00:00`) : new Date(start);
    end.setDate(end.getDate() + 7);
    start.setDate(start.getDate() - 2);
    return { start, end };
  }, [dated]);
  const total = Math.max(1, bounds.end.getTime() - bounds.start.getTime());
  const days = Math.ceil(total / 86400000);
  return <div className="overflow-x-auto rounded-2xl border border-border bg-card" data-testid="timeline-view"><div className="min-w-[780px]"><div className="grid grid-cols-[240px_1fr] border-b border-border bg-muted/35 text-[10px] uppercase tracking-[.12em] text-muted-foreground"><div className="px-4 py-3">Card</div><div className="relative h-10">{Array.from({ length: Math.min(days, 21) }, (_, index) => <span key={index} className="absolute top-3" style={{ left: `${(index / Math.max(1, Math.min(days, 21) - 1)) * 100}%` }}>{new Date(bounds.start.getTime() + index * 86400000).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>)}</div></div>{dated.length ? dated.map(card => { const start = new Date(`${card.startDate ?? card.dueDate}T00:00:00`); const end = new Date(`${card.dueDate ?? card.startDate}T00:00:00`); const left = Math.max(0, (start.getTime() - bounds.start.getTime()) / total * 100); const width = Math.max(3, (Math.max(end.getTime(), start.getTime() + 86400000) - start.getTime()) / total * 100); return <div key={card.id} className="grid grid-cols-[240px_1fr] border-b border-border last:border-0"><button type="button" onClick={() => onOpen(card)} data-testid={`timeline-card-${card.id}`} className="min-w-0 truncate px-4 py-3 text-left text-xs font-semibold hover:text-primary">{card.title}<span className="mt-1 block text-[10px] font-normal text-muted-foreground">{columns.find(column => column.id === card.columnId)?.title}</span></button><div className="relative my-3"><span className="absolute top-0 h-9 rounded-lg px-2 py-2 text-[10px] font-bold text-white shadow-sm" style={{ left: `${left}%`, width: `${width}%`, background: priorityMeta[card.priority].color }}>{dateLabel(card.startDate ?? card.dueDate)}</span></div></div>; }) : <div className="p-10 text-center text-sm text-muted-foreground">Add start or due dates to see cards on the timeline.</div>}</div></div>;
}

export default BoardEditor;