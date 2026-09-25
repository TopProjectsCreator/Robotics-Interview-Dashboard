import { randomUUID } from "node:crypto";
import type {
  BoardCardInput,
  BoardCardPatch,
  BoardData,
  BoardOperationInput,
} from "@workspace/api-zod";

const COLUMN_COLORS = ["#70859a", "#657bd0", "#d29139", "#429276", "#a75bc2", "#d35d68"];
const MAX_COLUMNS = 20;
const MAX_CARDS = 2_000;
const MAX_CARD_TITLE = 200;
const MAX_COLUMN_TITLE = 80;

type OperationResult =
  | { ok: true; data: BoardData; title?: string }
  | { ok: false; status: number; error: string };

function fail(error: string, status = 400): OperationResult {
  return { ok: false, error, status };
}

function normalizeLabels(labels: string[] | undefined): string[] {
  return [...new Set((labels ?? [])
    .map((label) => label.trim().slice(0, 40))
    .filter(Boolean))]
    .slice(0, 12);
}

function normalizedDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && Number.isNaN(value.getTime())) return null;
  const dateText = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const parsed = new Date(`${dateText}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateText
    ? null
    : parsed;
}

function normalizeCardInput(
  input: BoardCardInput,
  fallbackColumnId: string,
): { card?: BoardData["cards"][number]; error?: string } {
  const title = input.title.trim();
  if (!title) return { error: "Card titles cannot be empty." };
  if (title.length > MAX_CARD_TITLE) return { error: "Card titles must be 200 characters or fewer." };

  const startDate = normalizedDate(input.startDate);
  const dueDate = normalizedDate(input.dueDate);
  if (input.startDate && !startDate) return { error: "Enter a valid start date." };
  if (input.dueDate && !dueDate) return { error: "Enter a valid due date." };
  if (startDate && dueDate && startDate > dueDate) {
    return { error: "The start date must be on or before the due date." };
  }

  const now = new Date();
  return {
    card: {
      id: randomUUID(),
      title,
      description: (input.description ?? "").trim().slice(0, 12_000),
      columnId: input.columnId || fallbackColumnId,
      position: 0,
      priority: input.priority ?? "normal",
      assignee: input.assignee?.trim().slice(0, 80) || null,
      startDate,
      dueDate,
      labels: normalizeLabels(input.labels),
      createdAt: now,
      updatedAt: now,
      updatedBy: "",
    },
  };
}

function sortColumnCards(cards: BoardData["cards"], columnId: string) {
  return cards
    .filter((card) => card.columnId === columnId)
    .sort((a, b) => a.position - b.position || a.createdAt.getTime() - b.createdAt.getTime());
}

function normalizeColumnPositions(
  cards: BoardData["cards"],
  columnIds: string[],
): BoardData["cards"] {
  const positions = new Map<string, number>();
  for (const columnId of new Set(columnIds)) {
    sortColumnCards(cards, columnId).forEach((card, position) => positions.set(card.id, position));
  }
  return cards.map((card) => positions.has(card.id)
    ? { ...card, position: positions.get(card.id)! }
    : card);
}

function moveOneCard(
  cards: BoardData["cards"],
  cardId: string,
  targetColumnId: string,
  beforeCardId: string | null | undefined,
  actor: string,
  now: Date,
): { cards?: BoardData["cards"]; error?: string; status?: number } {
  const card = cards.find((item) => item.id === cardId);
  if (!card) return { error: "Card not found.", status: 404 };

  const destination = cards.filter((item) => item.columnId === targetColumnId && item.id !== cardId)
    .sort((a, b) => a.position - b.position);
  let insertAt = destination.length;
  if (beforeCardId) {
    insertAt = destination.findIndex((item) => item.id === beforeCardId);
    if (insertAt < 0) return { error: "The target card is not in that column.", status: 400 };
  }
  destination.splice(insertAt, 0, {
    ...card,
    columnId: targetColumnId,
    updatedAt: now,
    updatedBy: actor,
  });
  const updatedDestination = destination.map((item, position) => ({ ...item, position }));
  const affectedColumns = [card.columnId, targetColumnId];
  const next = cards.filter((item) => item.id !== cardId && item.columnId !== targetColumnId)
    .concat(updatedDestination);
  return { cards: normalizeColumnPositions(next, affectedColumns) };
}

export function initialBoardData(): BoardData {
  return {
    kind: "board",
    version: 1,
    columns: [
      { id: "backlog", title: "Backlog", color: COLUMN_COLORS[0], position: 0 },
      { id: "planned", title: "To do", color: COLUMN_COLORS[1], position: 1 },
      { id: "in-progress", title: "In progress", color: COLUMN_COLORS[2], position: 2 },
      { id: "done", title: "Done", color: COLUMN_COLORS[3], position: 3 },
    ],
    cards: [],
  };
}

export function parseBoardData(raw: string): BoardData | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object") return null;
    const candidate = value as Record<string, unknown>;
    if (
      candidate.kind !== "board" ||
      candidate.version !== 1 ||
      !Array.isArray(candidate.columns) ||
      !Array.isArray(candidate.cards) ||
      candidate.columns.length > MAX_COLUMNS ||
      candidate.cards.length > MAX_CARDS
    ) return null;

    const columns = candidate.columns as unknown[];
    const rawCards = candidate.cards as unknown[];
    const columnsValid = columns.every((value) => {
      if (!value || typeof value !== "object") return false;
      const column = value as Record<string, unknown>;
      return (
      Boolean(column) &&
      typeof column.id === "string" &&
      typeof column.title === "string" &&
      typeof column.color === "string" &&
      Number.isInteger(column.position)
      );
    });
    if (!columnsValid) return null;

    const columnIds = new Set(columns.map((value) => (value as Record<string, unknown>).id as string));
    const parsedCards: BoardData["cards"] = [];
    for (const value of rawCards) {
      if (!value || typeof value !== "object") return null;
      const card = value as Record<string, unknown>;
      const startDate = card.startDate == null ? null : normalizedDate(card.startDate as string | Date);
      const dueDate = card.dueDate == null ? null : normalizedDate(card.dueDate as string | Date);
      const createdAt = new Date(card.createdAt as string | Date);
      const updatedAt = new Date(card.updatedAt as string | Date);
      if (
        typeof card.id !== "string" ||
        typeof card.title !== "string" ||
        typeof card.description !== "string" ||
        typeof card.columnId !== "string" ||
        !columnIds.has(card.columnId) ||
        !Number.isInteger(card.position) ||
        typeof card.priority !== "string" ||
        !["urgent", "high", "normal", "low"].includes(card.priority) ||
        (typeof card.assignee !== "string" && card.assignee !== null) ||
        (card.startDate != null && !startDate) ||
        (card.dueDate != null && !dueDate) ||
        Array.isArray(card.labels) === false ||
        !(card.labels as unknown[]).every((label) => typeof label === "string") ||
        Number.isNaN(createdAt.getTime()) ||
        Number.isNaN(updatedAt.getTime()) ||
        typeof card.updatedBy !== "string"
      ) return null;

      parsedCards.push({
        id: card.id,
        title: card.title,
        description: card.description,
        columnId: card.columnId,
        position: card.position as number,
        priority: card.priority as BoardData["cards"][number]["priority"],
        assignee: card.assignee as string | null,
        startDate,
        dueDate,
        labels: card.labels as string[],
        createdAt,
        updatedAt,
        updatedBy: card.updatedBy,
      });
    }

    return {
      kind: "board",
      version: 1,
      columns: columns as BoardData["columns"],
      cards: parsedCards,
    };
  } catch {
    return null;
  }
}

export function applyBoardOperation(
  current: BoardData,
  operation: BoardOperationInput,
  actor: string,
): OperationResult {
  const now = new Date();
  const data: BoardData = {
    ...current,
    columns: [...current.columns].sort((a, b) => a.position - b.position),
    cards: [...current.cards],
  };

  switch (operation.operation) {
    case "rename_board": {
      const title = operation.title?.trim();
      if (!title) return fail("Board name cannot be empty.");
      if (title.length > 120) return fail("Board names must be 120 characters or fewer.");
      return { ok: true, data, title };
    }

    case "create_card": {
      if (!operation.card) return fail("Card details are required.");
      if (data.cards.length >= MAX_CARDS) return fail("This board has reached the 2,000-card limit.", 413);
      const fallbackColumnId = data.columns[0]?.id;
      const card = normalizeCardInput(operation.card, fallbackColumnId ?? "");
      if (!card.card) return fail(card.error ?? "Card details are invalid.");
      if (!data.columns.some((column) => column.id === card.card!.columnId)) {
        return fail("Choose a column that exists on this board.");
      }
      card.card.updatedBy = actor;
      card.card.position = sortColumnCards(data.cards, card.card.columnId).length;
      data.cards.push(card.card);
      return { ok: true, data };
    }

    case "update_card": {
      if (!operation.cardId || !operation.cardPatch) return fail("Card details are required.");
      const existing = data.cards.find((card) => card.id === operation.cardId);
      if (!existing) return fail("Card not found.", 404);
      const patch: BoardCardPatch = operation.cardPatch;
      if (!Object.keys(patch).length) return fail("Choose at least one card field to update.");
      const next = { ...existing, ...patch };
      next.title = next.title.trim();
      if (!next.title) return fail("Card titles cannot be empty.");
      if (next.title.length > MAX_CARD_TITLE) return fail("Card titles must be 200 characters or fewer.");
      next.description = (next.description ?? "").trim().slice(0, 12_000);
      next.assignee = next.assignee?.trim().slice(0, 80) || null;
      next.labels = normalizeLabels(next.labels);
      const startDate = normalizedDate(next.startDate);
      const dueDate = normalizedDate(next.dueDate);
      if (next.startDate && !startDate) return fail("Enter a valid start date.");
      if (next.dueDate && !dueDate) return fail("Enter a valid due date.");
      if (startDate && dueDate && startDate > dueDate) {
        return fail("The start date must be on or before the due date.");
      }
      next.startDate = startDate;
      next.dueDate = dueDate;
      next.updatedAt = now;
      next.updatedBy = actor;
      data.cards = data.cards.map((card) => card.id === existing.id ? next : card);
      return { ok: true, data };
    }

    case "move_card": {
      if (!operation.cardId || !operation.targetColumnId) return fail("Choose a card and destination column.");
      if (!data.columns.some((column) => column.id === operation.targetColumnId)) {
        return fail("The destination column does not exist.");
      }
      const moved = moveOneCard(
        data.cards,
        operation.cardId,
        operation.targetColumnId,
        operation.beforeCardId,
        actor,
        now,
      );
      if (!moved.cards) return fail(moved.error ?? "The card could not be moved.", moved.status ?? 400);
      data.cards = moved.cards;
      return { ok: true, data };
    }

    case "delete_card": {
      if (!operation.cardId) return fail("Choose a card to delete.");
      const existing = data.cards.find((card) => card.id === operation.cardId);
      if (!existing) return fail("Card not found.", 404);
      data.cards = normalizeColumnPositions(
        data.cards.filter((card) => card.id !== existing.id),
        [existing.columnId],
      );
      return { ok: true, data };
    }

    case "bulk_add_cards": {
      if (!operation.titles?.length) return fail("Add at least one card title.");
      if (data.cards.length + operation.titles.length > MAX_CARDS) {
        return fail("This board has reached the 2,000-card limit.", 413);
      }
      const columnId = operation.targetColumnId || data.columns[0]?.id;
      if (!columnId || !data.columns.some((column) => column.id === columnId)) {
        return fail("Choose a column that exists on this board.");
      }
      const titles = operation.titles.map((title) => title.trim()).filter(Boolean);
      if (!titles.length) return fail("Add at least one non-empty card title.");
      if (titles.some((title) => title.length > MAX_CARD_TITLE)) {
        return fail("Card titles must be 200 characters or fewer.");
      }
      let position = sortColumnCards(data.cards, columnId).length;
      for (const title of titles) {
        const created = normalizeCardInput({ title, columnId }, columnId);
        if (!created.card) return fail(created.error ?? "Card details are invalid.");
        created.card.position = position++;
        created.card.updatedBy = actor;
        data.cards.push(created.card);
      }
      return { ok: true, data };
    }

    case "bulk_move_cards": {
      const ids = [...new Set(operation.cardIds ?? [])];
      if (!ids.length || !operation.targetColumnId) return fail("Choose cards and a destination column.");
      if (!data.columns.some((column) => column.id === operation.targetColumnId)) {
        return fail("The destination column does not exist.");
      }
      const moving = ids.map((id) => data.cards.find((card) => card.id === id));
      if (moving.some((card) => !card)) return fail("One or more selected cards no longer exist.", 404);
      const movedCards = moving as BoardData["cards"];
      const affectedColumns = [...new Set(movedCards.map((card) => card.columnId).concat(operation.targetColumnId!))];
      const keep = data.cards.filter((card) => !ids.includes(card.id));
      const destination = sortColumnCards(keep, operation.targetColumnId);
      const additions = movedCards.map((card) => ({
        ...card,
        columnId: operation.targetColumnId!,
        updatedAt: now,
        updatedBy: actor,
      }));
      data.cards = normalizeColumnPositions(keep.filter((card) => card.columnId !== operation.targetColumnId)
        .concat(destination, additions), affectedColumns);
      return { ok: true, data };
    }

    case "bulk_delete_cards": {
      const ids = [...new Set(operation.cardIds ?? [])];
      if (!ids.length) return fail("Select at least one card to delete.");
      const selected = data.cards.filter((card) => ids.includes(card.id));
      if (selected.length !== ids.length) return fail("One or more selected cards no longer exist.", 404);
      data.cards = normalizeColumnPositions(
        data.cards.filter((card) => !ids.includes(card.id)),
        selected.map((card) => card.columnId),
      );
      return { ok: true, data };
    }

    case "create_column": {
      const title = operation.title?.trim();
      if (!title) return fail("Column name cannot be empty.");
      if (title.length > MAX_COLUMN_TITLE) return fail("Column names must be 80 characters or fewer.");
      if (data.columns.length >= MAX_COLUMNS) return fail("This board has reached the 20-column limit.");
      if (data.columns.some((column) => column.title.toLowerCase() === title.toLowerCase())) {
        return fail("A column with that name already exists.");
      }
      data.columns.push({
        id: randomUUID(),
        title,
        color: operation.color?.slice(0, 32) || COLUMN_COLORS[data.columns.length % COLUMN_COLORS.length],
        position: data.columns.length,
      });
      return { ok: true, data };
    }

    case "rename_column": {
      if (!operation.columnId) return fail("Choose a column to rename.");
      const column = data.columns.find((item) => item.id === operation.columnId);
      if (!column) return fail("Column not found.", 404);
      const title = operation.title?.trim();
      if (!title) return fail("Column name cannot be empty.");
      if (title.length > MAX_COLUMN_TITLE) return fail("Column names must be 80 characters or fewer.");
      if (data.columns.some((item) => item.id !== column.id && item.title.toLowerCase() === title.toLowerCase())) {
        return fail("A column with that name already exists.");
      }
      data.columns = data.columns.map((item) => item.id === column.id
        ? { ...item, title, ...(operation.color ? { color: operation.color.slice(0, 32) } : {}) }
        : item);
      return { ok: true, data };
    }

    case "delete_column": {
      if (!operation.columnId) return fail("Choose a column to delete.");
      const column = data.columns.find((item) => item.id === operation.columnId);
      if (!column) return fail("Column not found.", 404);
      const remainingColumns = data.columns.filter((item) => item.id !== column.id);
      if (!remainingColumns.length) return fail("A board must keep at least one column.");
      const targetColumnId = operation.targetColumnId || remainingColumns[0].id;
      if (!remainingColumns.some((item) => item.id === targetColumnId)) {
        return fail("Choose a remaining column for the cards.");
      }
      const targetCards = sortColumnCards(data.cards, targetColumnId);
      const moved = sortColumnCards(data.cards, column.id).map((card) => ({
        ...card,
        columnId: targetColumnId,
        position: targetCards.length + card.position,
        updatedAt: now,
        updatedBy: actor,
      }));
      data.columns = remainingColumns.map((item, position) => ({ ...item, position }));
      data.cards = normalizeColumnPositions(
        data.cards.filter((card) => card.columnId !== column.id && card.columnId !== targetColumnId)
          .concat(targetCards, moved),
        [column.id, targetColumnId],
      );
      return { ok: true, data };
    }
  }
}