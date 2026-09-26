import { desc, eq } from "drizzle-orm";
import { db, interviewWhiteboardsTable } from "@workspace/db";
import { UpdateBoardBody } from "@workspace/api-zod";
import { applyBoardOperation, parseBoardData } from "./boardOperations";
import {
  applySpreadsheetAssistantEdits,
  isSpreadsheetRecordData,
  parseSpreadsheetData,
  type SpreadsheetAssistantEdits,
} from "./spreadsheetOperations";
import {
  editDocumentForAssistant,
  readDocumentForAssistant,
} from "./documentCollaboration";
import { broadcastWhiteboardScene, mergeWhiteboardDataForSave } from "./whiteboardCollaboration";
import { pushRealtimeHint } from "./realtime";
import {
  applyWhiteboardOperations,
  parseWhiteboardOperations,
} from "./whiteboardAssistantOperations";

type ArtifactRow = typeof interviewWhiteboardsTable.$inferSelect;
type ArtifactKind = "whiteboard" | "board" | "document" | "spreadsheet";
type ArtifactAccessCheck = (row: Pick<ArtifactRow, "conversationScope" | "conversationPeer">) => boolean;

export const ASSISTANT_ARTIFACT_TOOL_NAMES = new Set([
  "list_collaboration_artifacts",
  "read_collaboration_artifact",
  "edit_whiteboard",
  "edit_board",
  "edit_document",
  "edit_spreadsheet",
]);

const boardOperationSchema = {
  type: "object",
  properties: {
    operation: {
      type: "string",
      enum: [
        "rename_board", "create_card", "update_card", "move_card", "delete_card",
        "bulk_add_cards", "bulk_move_cards", "bulk_delete_cards", "create_column",
        "rename_column", "delete_column",
      ],
    },
    card: { type: "object" },
    cardId: { type: "string" },
    cardPatch: { type: "object" },
    cardIds: { type: "array", items: { type: "string" }, maxItems: 500 },
    titles: { type: "array", items: { type: "string", maxLength: 200 }, maxItems: 250 },
    columnId: { type: "string" },
    targetColumnId: { type: "string" },
    beforeCardId: { type: ["string", "null"] },
    title: { type: "string", maxLength: 120 },
    description: { type: "string", maxLength: 500 },
    color: { type: "string", maxLength: 32 },
  },
  required: ["operation"],
};

export const ASSISTANT_ARTIFACT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_collaboration_artifacts",
      description: "List shared or directly shared Whiteboards, Boards, Documents, and Spreadsheets that the signed-in interviewer can access. Use this before editing when the target is unclear.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["whiteboard", "board", "document", "spreadsheet"] },
          limit: { type: "integer", minimum: 1, maximum: 50 },
        },
        required: [],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "read_collaboration_artifact",
      description: "Read an accessible artifact by id before editing. Reads only the signed-in interviewer's shared and direct-conversation artifacts. Spreadsheet rows and board/whiteboard items can be paged with offset and limit.",
      parameters: {
        type: "object",
        properties: {
          artifactId: { type: "string" },
          query: { type: "string", maxLength: 120 },
          offset: { type: "integer", minimum: 0 },
          limit: { type: "integer", minimum: 1, maximum: 50 },
          columnOffset: { type: "integer", minimum: 0 },
          columnLimit: { type: "integer", minimum: 1, maximum: 40 },
        },
        required: ["artifactId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_whiteboard",
      description: "Edit an accessible Excalidraw whiteboard. Add text, rectangles, ellipses, or arrows; update or delete an existing text/scene element by id. Provide concise operations and read the board first. Do not clear or delete content unless explicitly asked.",
      parameters: {
        type: "object",
        properties: {
          whiteboardId: { type: "string" },
          title: { type: "string", maxLength: 120 },
          operations: {
            type: "array",
            minItems: 1,
            maxItems: 30,
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["add_text", "add_rectangle", "add_ellipse", "add_arrow", "update_text", "delete_element"] },
                elementId: { type: "string" },
                text: { type: "string", maxLength: 4000 },
                x: { type: "number" },
                y: { type: "number" },
                width: { type: "number" },
                height: { type: "number" },
                fontSize: { type: "integer", minimum: 12, maximum: 72 },
                strokeColor: { type: "string" },
                backgroundColor: { type: "string" },
              },
              required: ["type"],
            },
          },
        },
        required: ["whiteboardId", "operations"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_board",
      description: "Apply one validated Board operation to an accessible board. Read the board first and use its real column/card ids. Use the operation-specific fields inside operation. Do not delete cards or columns unless explicitly requested.",
      parameters: {
        type: "object",
        properties: {
          boardId: { type: "string" },
          operation: boardOperationSchema,
        },
        required: ["boardId", "operation"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_document",
      description: "Append or replace text in an accessible collaborative Document, or change its title. Read it first; prefer append unless the interviewer explicitly asks to rewrite or replace. Edits sync through the live Yjs collaboration room.",
      parameters: {
        type: "object",
        properties: {
          documentId: { type: "string" },
          mode: { type: "string", enum: ["append", "replace"] },
          content: { type: "string", maxLength: 30000 },
          title: { type: "string", maxLength: 120 },
        },
        required: ["documentId", "mode", "content"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_spreadsheet",
      description: "Edit cells, append rows/columns, or rename an accessible Spreadsheet. Cell coordinates and row indexes are zero-based. Read the sheet first; use existing row/column indexes and never overwrite unrelated cells.",
      parameters: {
        type: "object",
        properties: {
          spreadsheetId: { type: "string" },
          edits: {
            type: "object",
            properties: {
              title: { type: "string", maxLength: 120 },
              cells: {
                type: "array",
                maxItems: 50,
                items: {
                  type: "object",
                  properties: {
                    row: { type: "integer", minimum: 0 },
                    column: { type: "integer", minimum: 0 },
                    value: { type: "string", maxLength: 4000 },
                  },
                  required: ["row", "column", "value"],
                },
              },
              appendRows: {
                type: "array",
                maxItems: 50,
                items: { type: "array", items: { type: "string", maxLength: 4000 }, maxItems: 40 },
              },
              appendColumns: {
                type: "array",
                maxItems: 20,
                items: {
                  type: "object",
                  properties: {
                    values: { type: "array", items: { type: "string", maxLength: 4000 }, maxItems: 1000 },
                  },
                  required: ["values"],
                },
              },
            },
            required: [],
          },
        },
        required: ["spreadsheetId", "edits"],
      },
    },
  },
];

type ToolOutcome = {
  content: string;
  activity?: { tool: string; detail: string };
};

function kindForRow(row: ArtifactRow): ArtifactKind | null {
  if (isSpreadsheetRecordData(row.data)) return "spreadsheet";
  try {
    const parsed = JSON.parse(row.data) as { kind?: unknown; elements?: unknown };
    if (parsed.kind === "board") return "board";
    if (parsed.kind === "document") return "document";
    return Array.isArray(parsed.elements) ? "whiteboard" : null;
  } catch {
    return null;
  }
}

function safeNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function clippedText(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.slice(0, maxLength) : "";
}

function toolFailure(error: string): ToolOutcome {
  return { content: JSON.stringify({ ok: false, error }) };
}

async function listArtifacts(
  args: Record<string, unknown>,
  canAccess: ArtifactAccessCheck,
): Promise<ToolOutcome> {
  const requestedKind = args.kind;
  if (requestedKind !== undefined && !["whiteboard", "board", "document", "spreadsheet"].includes(String(requestedKind))) {
    return toolFailure("Choose a supported artifact kind.");
  }
  const limit = safeNumber(args.limit, 25, 1, 50);
  const rows = await db.select().from(interviewWhiteboardsTable)
    .orderBy(desc(interviewWhiteboardsTable.updatedAt))
    .limit(200);
  const items = rows
    .filter(canAccess)
    .flatMap((row) => {
      const kind = kindForRow(row);
      if (!kind || (requestedKind && kind !== requestedKind)) return [];
      return [{
        id: row.id,
        kind,
        title: row.title,
        scope: row.conversationScope === "direct" ? "direct" : "shared",
        updatedAt: row.updatedAt.toISOString(),
      }];
    })
    .slice(0, limit);
  return {
    content: JSON.stringify({ ok: true, items, returned: items.length, limit }),
    activity: { tool: "list_collaboration_artifacts", detail: `${items.length} accessible artifact(s)` },
  };
}

function boardReadView(
  row: ArtifactRow,
  args: Record<string, unknown>,
): ToolOutcome {
  const data = parseBoardData(row.data);
  if (!data) return toolFailure("The stored board data is invalid.");
  const query = clippedText(args.query, 120).trim().toLowerCase();
  const cards = [...data.cards]
    .sort((a, b) => {
      const columnA = data.columns.find((column) => column.id === a.columnId)?.position ?? 0;
      const columnB = data.columns.find((column) => column.id === b.columnId)?.position ?? 0;
      return columnA - columnB || a.position - b.position;
    })
    .filter((card) => !query || [
      card.title, card.description, card.assignee ?? "", ...card.labels,
    ].some((value) => value.toLowerCase().includes(query)));
  const offset = safeNumber(args.offset, 0, 0, cards.length);
  const limit = safeNumber(args.limit, 40, 1, 50);
  const slice = cards.slice(offset, offset + limit).map((card) => ({
    id: card.id,
    title: card.title,
    description: card.description.slice(0, 400),
    columnId: card.columnId,
    column: data.columns.find((column) => column.id === card.columnId)?.title ?? "",
    priority: card.priority,
    assignee: card.assignee,
    startDate: card.startDate?.toISOString().slice(0, 10) ?? null,
    dueDate: card.dueDate?.toISOString().slice(0, 10) ?? null,
    labels: card.labels,
  }));
  const result = {
    ok: true,
    id: row.id,
    kind: "board",
    title: row.title,
    description: data.description,
    columns: [...data.columns].sort((a, b) => a.position - b.position),
    cards: slice,
    cardCount: cards.length,
    offset,
    truncated: offset + slice.length < cards.length,
  };
  return {
    content: JSON.stringify(result),
    activity: { tool: "read_collaboration_artifact", detail: `Board "${row.title.slice(0, 45)}"` },
  };
}

function spreadsheetReadView(row: ArtifactRow, args: Record<string, unknown>): ToolOutcome {
  const data = parseSpreadsheetData(row.data);
  if (!data) return toolFailure("The stored spreadsheet data is invalid.");
  const query = clippedText(args.query, 120).trim().toLowerCase();
  const rowOffset = safeNumber(args.offset, 0, 0, data.rows.length);
  const rowLimit = safeNumber(args.limit, 25, 1, 50);
  const columnOffset = safeNumber(args.columnOffset, 0, 0, data.columnCount - 1);
  const columnLimit = safeNumber(args.columnLimit, 20, 1, 40);
  const selected = data.rows
    .map((cells, rowIndex) => ({ cells, rowIndex }))
    .filter(({ cells, rowIndex }) =>
      rowIndex >= rowOffset &&
      (!query || cells.some((cell) => cell.toLowerCase().includes(query))),
    )
    .slice(0, rowLimit)
    .map(({ cells, rowIndex }) => ({
      rowIndex,
      cells: cells.slice(columnOffset, columnOffset + columnLimit).map((cell) => cell.slice(0, 300)),
    }));
  return {
    content: JSON.stringify({
      ok: true,
      id: row.id,
      kind: "spreadsheet",
      title: row.title,
      rowCount: data.rows.length,
      columnCount: data.columnCount,
      headers: data.rows[0].map((cell) => cell.slice(0, 300)),
      rowOffset,
      columnOffset,
      rows: selected,
      truncated: selected.length > 0 && selected[selected.length - 1].rowIndex < data.rows.length - 1,
    }),
    activity: { tool: "read_collaboration_artifact", detail: `Spreadsheet "${row.title.slice(0, 40)}"` },
  };
}

function whiteboardReadView(row: ArtifactRow, args: Record<string, unknown>): ToolOutcome {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    return toolFailure("The stored whiteboard data is invalid.");
  }
  if (!Array.isArray(parsed.elements)) return toolFailure("The stored whiteboard scene is invalid.");
  const query = clippedText(args.query, 120).trim().toLowerCase();
  const elements = (parsed.elements as unknown[])
    .filter((value): value is Record<string, unknown> => Boolean(value) && typeof value === "object")
    .filter((element) => element.isDeleted !== true)
    .filter((element) => !query || [
      element.id, element.type, element.text,
    ].some((value) => typeof value === "string" && value.toLowerCase().includes(query)));
  const offset = safeNumber(args.offset, 0, 0, elements.length);
  const limit = safeNumber(args.limit, 40, 1, 50);
  const slice = elements.slice(offset, offset + limit).map((element) => ({
    id: clippedText(element.id, 80),
    type: clippedText(element.type, 40),
    text: clippedText(element.text, 500),
    x: typeof element.x === "number" ? element.x : undefined,
    y: typeof element.y === "number" ? element.y : undefined,
    width: typeof element.width === "number" ? element.width : undefined,
    height: typeof element.height === "number" ? element.height : undefined,
    strokeColor: clippedText(element.strokeColor, 32),
    backgroundColor: clippedText(element.backgroundColor, 32),
  }));
  return {
    content: JSON.stringify({
      ok: true,
      id: row.id,
      kind: "whiteboard",
      title: row.title,
      elements: slice,
      elementCount: elements.length,
      offset,
      truncated: offset + slice.length < elements.length,
    }),
    activity: { tool: "read_collaboration_artifact", detail: `Whiteboard "${row.title.slice(0, 40)}"` },
  };
}

async function readArtifact(
  args: Record<string, unknown>,
  canAccess: ArtifactAccessCheck,
): Promise<ToolOutcome> {
  const id = clippedText(args.artifactId, 120).trim();
  if (!id) return toolFailure("An artifact id is required.");
  const [row] = await db.select().from(interviewWhiteboardsTable)
    .where(eq(interviewWhiteboardsTable.id, id))
    .limit(1);
  if (!row || !canAccess(row)) return toolFailure("Artifact not found or not accessible.");

  const kind = kindForRow(row);
  if (kind === "board") return boardReadView(row, args);
  if (kind === "spreadsheet") return spreadsheetReadView(row, args);
  if (kind === "whiteboard") return whiteboardReadView(row, args);
  if (kind === "document") {
    const read = await readDocumentForAssistant(row.id, String(args.displayName ?? ""));
    if (!read.ok) return toolFailure(read.error);
    const content = read.content.slice(0, 20_000);
    return {
      content: JSON.stringify({
        ok: true,
        id: row.id,
        kind: "document",
        title: read.title,
        content,
        truncated: content.length < read.content.length,
      }),
      activity: { tool: "read_collaboration_artifact", detail: `Document "${row.title.slice(0, 40)}"` },
    };
  }
  return toolFailure("Artifact not found or not accessible.");
}

function parseSpreadsheetEdits(value: unknown): { edits?: SpreadsheetAssistantEdits; error?: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { error: "Spreadsheet edits must be an object." };
  }
  const input = value as Record<string, unknown>;
  if (input.title !== undefined && typeof input.title !== "string") return { error: "The spreadsheet title must be text." };
  const edits: SpreadsheetAssistantEdits = {};
  if (typeof input.title === "string") edits.title = input.title;
  if (input.cells !== undefined) {
    if (!Array.isArray(input.cells) || input.cells.some((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return true;
      const cell = value as Record<string, unknown>;
      return !Number.isInteger(cell.row) || !Number.isInteger(cell.column) || typeof cell.value !== "string";
    })) return { error: "Cell edits need integer row/column indexes and text values." };
    edits.cells = input.cells as SpreadsheetAssistantEdits["cells"];
  }
  if (input.appendRows !== undefined) {
    if (!Array.isArray(input.appendRows) || input.appendRows.some((row) =>
      !Array.isArray(row) || row.some((cell) => typeof cell !== "string"),
    )) return { error: "Appended rows must be arrays of text values." };
    edits.appendRows = input.appendRows as string[][];
  }
  if (input.appendColumns !== undefined) {
    if (!Array.isArray(input.appendColumns) || input.appendColumns.some((column) =>
      !column || typeof column !== "object" || Array.isArray(column) ||
      !Array.isArray((column as Record<string, unknown>).values) ||
      ((column as Record<string, unknown>).values as unknown[]).some((cell) => typeof cell !== "string"),
    )) return { error: "Appended columns must contain arrays of text values." };
    edits.appendColumns = input.appendColumns as { values: string[] }[];
  }
  return { edits };
}

async function editBoard(
  args: Record<string, unknown>,
  displayName: string,
  canAccess: ArtifactAccessCheck,
): Promise<ToolOutcome> {
  const boardId = clippedText(args.boardId, 120).trim();
  const operation = UpdateBoardBody.safeParse(args.operation);
  if (!boardId || !operation.success) {
    return toolFailure(operation.success ? "A board id is required." : "The board operation is invalid.");
  }

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(interviewWhiteboardsTable)
      .where(eq(interviewWhiteboardsTable.id, boardId))
      .limit(1)
      .for("update");
    if (!row || !canAccess(row) || kindForRow(row) !== "board") {
      return { ok: false as const, error: "Board not found or not accessible." };
    }
    const current = parseBoardData(row.data);
    if (!current) return { ok: false as const, error: "The stored board data is invalid." };
    const applied = applyBoardOperation(current, operation.data, displayName);
    if (!applied.ok) return { ok: false as const, error: applied.error };
    const serialized = JSON.stringify(applied.data);
    if (Buffer.byteLength(serialized, "utf8") > 1_500_000) {
      return { ok: false as const, error: "This board is too large to save." };
    }
    const [updated] = await tx.update(interviewWhiteboardsTable)
      .set({
        data: serialized,
        ...(applied.title ? { title: applied.title.slice(0, 120) } : {}),
        updatedAt: new Date(),
      })
      .where(eq(interviewWhiteboardsTable.id, row.id))
      .returning();
    return { ok: true as const, title: updated.title, operation: operation.data.operation };
  });
  if (!result.ok) return toolFailure(result.error);
  pushRealtimeHint("interview_whiteboards");
  return {
    content: JSON.stringify({ ok: true, boardId, title: result.title, operation: result.operation }),
    activity: { tool: "edit_board", detail: `"${result.title.slice(0, 45)}" · ${result.operation}` },
  };
}

async function editSpreadsheet(
  args: Record<string, unknown>,
  canAccess: ArtifactAccessCheck,
): Promise<ToolOutcome> {
  const spreadsheetId = clippedText(args.spreadsheetId, 120).trim();
  const parsedEdits = parseSpreadsheetEdits(args.edits);
  if (!spreadsheetId || !parsedEdits.edits) {
    return toolFailure(parsedEdits.error ?? "A spreadsheet id is required.");
  }
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(interviewWhiteboardsTable)
      .where(eq(interviewWhiteboardsTable.id, spreadsheetId))
      .limit(1)
      .for("update");
    if (!row || !canAccess(row) || !isSpreadsheetRecordData(row.data)) {
      return { ok: false as const, error: "Spreadsheet not found or not accessible." };
    }
    const current = parseSpreadsheetData(row.data);
    if (!current) return { ok: false as const, error: "The stored spreadsheet data is invalid." };
    const applied = applySpreadsheetAssistantEdits(current, parsedEdits.edits!);
    if (!applied.ok) return applied;
    const serialized = JSON.stringify(applied.data);
    if (Buffer.byteLength(serialized, "utf8") > 1_500_000) {
      return { ok: false as const, error: "That spreadsheet is too large to save." };
    }
    const [updated] = await tx.update(interviewWhiteboardsTable)
      .set({
        title: applied.title ?? row.title,
        data: serialized,
        updatedAt: new Date(),
      })
      .where(eq(interviewWhiteboardsTable.id, row.id))
      .returning();
    return {
      ok: true as const,
      title: updated.title,
      rowCount: applied.data.rows.length,
      columnCount: applied.data.columnCount,
    };
  });
  if (!result.ok) return toolFailure(result.error);
  pushRealtimeHint("interview_whiteboards");
  return {
    content: JSON.stringify({ spreadsheetId, ...result }),
    activity: { tool: "edit_spreadsheet", detail: `"${result.title.slice(0, 45)}" updated` },
  };
}

async function editWhiteboard(
  args: Record<string, unknown>,
  displayName: string,
  canAccess: ArtifactAccessCheck,
): Promise<ToolOutcome> {
  const whiteboardId = clippedText(args.whiteboardId, 120).trim();
  const title = args.title === undefined
    ? undefined
    : typeof args.title === "string" ? args.title.trim() : "";
  const parsedOperations = parseWhiteboardOperations(args.operations);
  if (!whiteboardId || !parsedOperations.operations) {
    return toolFailure(parsedOperations.error ?? "A whiteboard id is required.");
  }
  if (args.title !== undefined && !title) return toolFailure("Whiteboard titles cannot be empty.");
  if (title && title.length > 120) return toolFailure("Whiteboard titles must be 120 characters or fewer.");

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(interviewWhiteboardsTable)
      .where(eq(interviewWhiteboardsTable.id, whiteboardId))
      .limit(1)
      .for("update");
    if (!row || !canAccess(row) || kindForRow(row) !== "whiteboard") {
      return { ok: false as const, error: "Whiteboard not found or not accessible." };
    }
    let scene: Record<string, unknown>;
    try {
      scene = JSON.parse(row.data) as Record<string, unknown>;
    } catch {
      return { ok: false as const, error: "The stored whiteboard scene is invalid." };
    }
    if (!Array.isArray(scene.elements)) return { ok: false as const, error: "The stored whiteboard scene is invalid." };
    const elements = scene.elements.filter((element): element is Record<string, unknown> =>
      Boolean(element) && typeof element === "object",
    );
    const applied = applyWhiteboardOperations(elements, parsedOperations.operations!);
    if (!applied.elements) return { ok: false as const, error: applied.error ?? "The scene edit could not be applied." };
    const serialized = mergeWhiteboardDataForSave(row.id, JSON.stringify({
      ...scene,
      elements: applied.elements,
    }));
    if (Buffer.byteLength(serialized, "utf8") > 1_500_000) {
      return { ok: false as const, error: "This whiteboard is too large to save." };
    }
    const [updated] = await tx.update(interviewWhiteboardsTable)
      .set({
        data: serialized,
        ...(title ? { title } : {}),
        updatedAt: new Date(),
      })
      .where(eq(interviewWhiteboardsTable.id, row.id))
      .returning();
    return { ok: true as const, row: updated, changed: applied.changed ?? 0 };
  });
  if (!result.ok) return toolFailure(result.error);
  broadcastWhiteboardScene(result.row.id, result.row.data, displayName);
  pushRealtimeHint("interview_whiteboards");
  return {
    content: JSON.stringify({
      ok: true,
      whiteboardId,
      title: result.row.title,
      changedElements: result.changed,
    }),
    activity: { tool: "edit_whiteboard", detail: `"${result.row.title.slice(0, 45)}" · ${result.changed} element(s)` },
  };
}

async function editDocument(
  args: Record<string, unknown>,
  displayName: string,
): Promise<ToolOutcome> {
  const documentId = clippedText(args.documentId, 120).trim();
  const mode = args.mode;
  if (
    !documentId ||
    (mode !== "append" && mode !== "replace") ||
    typeof args.content !== "string" ||
    (args.title !== undefined && typeof args.title !== "string")
  ) {
    return toolFailure("Provide a document id, append/replace mode, and text content.");
  }
  const result = await editDocumentForAssistant(
    documentId,
    displayName,
    mode,
    args.content,
    args.title as string | undefined,
  );
  if (!result.ok) return toolFailure(result.error);
  pushRealtimeHint("interview_whiteboards");
  return {
    content: JSON.stringify({
      ok: true,
      documentId,
      title: result.title,
      mode,
      contentLength: result.content.length,
    }),
    activity: { tool: "edit_document", detail: `"${result.title.slice(0, 45)}" · ${mode}` },
  };
}

export async function runAssistantArtifactTool(
  name: string,
  args: Record<string, unknown>,
  displayName: string,
  canAccess: ArtifactAccessCheck,
): Promise<ToolOutcome> {
  if (name === "list_collaboration_artifacts") return listArtifacts(args, canAccess);
  if (name === "read_collaboration_artifact") {
    return readArtifact({ ...args, displayName }, canAccess);
  }
  if (name === "edit_whiteboard") return editWhiteboard(args, displayName, canAccess);
  if (name === "edit_board") return editBoard(args, displayName, canAccess);
  if (name === "edit_document") return editDocument(args, displayName);
  if (name === "edit_spreadsheet") return editSpreadsheet(args, canAccess);
  return toolFailure("Unknown artifact tool.");
}