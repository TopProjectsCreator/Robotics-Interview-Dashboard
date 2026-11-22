import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { applicantsTable, db, DEFAULT_TEAM_ID, interviewWhiteboardsTable } from "@workspace/db";
import { UpdateBoardBody, UpdateCalendarBody } from "@workspace/api-zod";
import { ObjectStorageService } from "./objectStorage";
import { applyBoardOperation, initialBoardData, parseBoardData } from "./boardOperations";
import {
  applyCalendarOperation,
  initialCalendarData,
  parseCalendarData,
} from "./calendarOperations";
import { fetchIcalFeed } from "./calendarIcal";
import {
  applySpreadsheetAssistantEdits,
  initialSpreadsheetData,
  isSpreadsheetRecordData,
  parseSpreadsheetData,
  spreadsheetGridSize,
  spreadsheetPreviewRows,
  spreadsheetSheetNames,
  MAX_SPREADSHEET_DATA_BYTES,
  type SpreadsheetAssistantEdits,
} from "./spreadsheetOperations";
import {
  editDocumentForAssistant,
  readDocumentForAssistant,
} from "./documentCollaboration";
import { broadcastWhiteboardScene, mergeWhiteboardDataForSave } from "./whiteboardCollaboration";
import { pushRealtimeHint } from "./realtime";
import { teamFilter } from "./teams";
import {
  applyWhiteboardOperations,
  buildTextListWhiteboardOperations,
  generatedImageObjectPath,
  parseWhiteboardOperations,
  type WhiteboardOperation,
} from "./whiteboardAssistantOperations";

const objectStorageService = new ObjectStorageService();
const MAX_ASSISTANT_WHITEBOARD_BYTES = 1_500_000;
const MAX_ROSTER_ENTRIES = 1_000;

type ArtifactRow = typeof interviewWhiteboardsTable.$inferSelect;
type ArtifactKind = "whiteboard" | "board" | "document" | "spreadsheet" | "calendar";
type ArtifactAccessCheck = (row: Pick<ArtifactRow, "conversationScope" | "conversationPeer">) => boolean | Promise<boolean>;

export const ASSISTANT_ARTIFACT_TOOL_NAMES = new Set([
  "list_collaboration_artifacts",
  "read_collaboration_artifact",
  "create_board",
  "create_document",
  "create_spreadsheet",
  "create_whiteboard",
  "create_calendar",
  "edit_whiteboard",
  "edit_board",
  "edit_document",
  "edit_spreadsheet",
  "edit_calendar",
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
    card: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: "string", maxLength: 12000 },
        columnId: { type: "string", description: "Existing column id returned by create_board or read_collaboration_artifact." },
        priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
        assignee: { type: ["string", "null"] },
        startDate: { type: ["string", "null"], format: "date" },
        dueDate: { type: ["string", "null"], format: "date" },
        labels: { type: "array", maxItems: 12, items: { type: "string", maxLength: 40 } },
      },
      required: ["title"],
    },
    cardId: { type: "string" },
    cardPatch: {
      type: "object",
      properties: {
        title: { type: "string", minLength: 1, maxLength: 200 },
        description: { type: "string", maxLength: 12000 },
        priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
        assignee: { type: ["string", "null"] },
        startDate: { type: ["string", "null"], format: "date" },
        dueDate: { type: ["string", "null"], format: "date" },
        labels: { type: "array", maxItems: 12, items: { type: "string", maxLength: 40 } },
      },
    },
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

const calendarEventProperties = {
  title: { type: "string", minLength: 1, maxLength: 200 },
  description: { type: "string", maxLength: 12000 },
  location: { type: "string", maxLength: 500 },
  startAt: { type: "string", description: "ISO 8601 datetime (e.g. 2026-11-20T18:30:00), or YYYY-MM-DD for an all-day event." },
  endAt: { type: "string", description: "ISO 8601 datetime, or YYYY-MM-DD. Defaults to +1 hour, or +1 day for all-day events." },
  allDay: { type: "boolean" },
  assignees: { type: "array", maxItems: 32, items: { type: "string", maxLength: 80 } },
  color: { type: "string", maxLength: 16, description: "Hex color, e.g. #16869a." },
} as const;

const calendarOperationSchema = {
  type: "object",
  properties: {
    operation: {
      type: "string",
      enum: [
        "rename_calendar", "create_event", "update_event", "delete_event",
        "add_ical_feed", "remove_ical_feed", "refresh_ical_feed",
      ],
    },
    title: { type: "string", maxLength: 120, description: "New calendar name for rename_calendar." },
    description: { type: "string", maxLength: 500, description: "New calendar description for rename_calendar." },
    event: {
      type: "object",
      properties: calendarEventProperties,
      required: ["title", "startAt"],
    },
    eventPatch: {
      type: "object",
      properties: {
        ...calendarEventProperties,
        title: { type: "string", minLength: 1, maxLength: 200 },
        startAt: { ...calendarEventProperties.startAt, description: "ISO 8601 datetime, or YYYY-MM-DD." },
      },
    },
    eventId: { type: "string", description: "Event id for update_event/delete_event (from create_event or read_collaboration_artifact)." },
    feedUrl: { type: "string", maxLength: 2048, description: "Webcal/https iCal URL for add_ical_feed." },
    feedName: { type: "string", maxLength: 80 },
    feedColor: { type: "string", maxLength: 16 },
    feedId: { type: "string", description: "Feed id for remove_ical_feed/refresh_ical_feed." },
  },
  required: ["operation"],
};

export const ASSISTANT_ARTIFACT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "list_collaboration_artifacts",
      description: "List accessible collaboration artifacts with their kind. A Board is a structured task/Kanban board; a Whiteboard is a freeform canvas; a Document is rich text; a Spreadsheet is a workbook grid; a Calendar is a shared team calendar with dated events and iCal feeds. Use this to identify the correct existing artifact before editing.",
      parameters: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["whiteboard", "board", "document", "spreadsheet", "calendar"] },
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
      description: "Read an accessible artifact by id before editing. The returned kind distinguishes task Board, freeform Whiteboard, rich-text Document, workbook Spreadsheet, and team Calendar. Reads only the signed-in interviewer's shared and direct-conversation artifacts. Board/Whiteboard/Calendar items can be paged with offset and limit; set sheetName to read another worksheet.",
      parameters: {
        type: "object",
        properties: {
          artifactId: { type: "string" },
          sheetName: { type: "string", maxLength: 31 },
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
      name: "create_whiteboard",
      description: "Create a shared freeform Excalidraw canvas for sketches, diagrams, spatial layouts, or images. This is not a task board. For a roster of all applicants, set includeAllApplicantNames to true; the server adds every applicant name without exposing emails or other applicant details. For another text list, supply entries.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", maxLength: 120 },
          entries: {
            type: "array",
            maxItems: 500,
            items: { type: "string", maxLength: 200 },
          },
          includeAllApplicantNames: { type: "boolean" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_board",
      description: "Create a shared structured task Board (Kanban columns and cards) for tracking work, statuses, owners, and dates. This is not a freeform Whiteboard. The result includes actual column ids. After creation, use the returned boardId with edit_board to add or organize tasks.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 120 },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_document",
      description: "Create a shared collaborative rich-text Document for notes, agendas, summaries, or prose. This is not a task board, canvas, or spreadsheet. After creation, use the returned documentId with edit_document to add requested content.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 120 },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_spreadsheet",
      description: "Create a shared workbook-style Spreadsheet for rows, columns, calculations, and formulas (similar to an Excel worksheet). This is not a task board. After creation, use the returned spreadsheetId with edit_spreadsheet to add headers, rows, or formulas.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 120 },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_calendar",
      description: "Create a shared team Calendar for scheduled events, interviews, deadlines, and iCal feeds. This is not a Board or Spreadsheet. After creation, use the returned calendarId with edit_calendar to add events, or read_collaboration_artifact to list them.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", minLength: 1, maxLength: 120 },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "edit_whiteboard",
      description: "Edit an accessible freeform Excalidraw Whiteboard: add text, shapes, arrows, or an image returned by generate_image; update or delete scene elements by id. Use for sketches and diagrams, not task tracking. Read the Whiteboard first. Do not clear or delete content unless explicitly asked.",
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
                type: { type: "string", enum: ["add_text", "add_rectangle", "add_ellipse", "add_arrow", "add_image", "update_text", "delete_element"] },
                elementId: { type: "string" },
                text: { type: "string", maxLength: 4000 },
                imageUrl: { type: "string", maxLength: 300, description: "Exact image URL returned by generate_image; only app-stored generated images are accepted." },
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
      description: "Apply one validated operation to an accessible structured task Board (Kanban columns and cards). Use for task status, owners, and dates—not freeform drawing. For one task use operation=create_card with card.title and optional card.columnId/description/assignee/dates/priority/labels; for several use bulk_add_cards with titles and targetColumnId. Use the actual column/card ids returned by create_board or read_collaboration_artifact. Do not delete cards or columns unless explicitly requested.",
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
      description: "Append or replace rich text in an accessible collaborative Document, or change its title. Use for prose, notes, and agendas—not task cards, spreadsheet cells, or freeform drawings. Read it first; prefer append unless the interviewer explicitly asks to rewrite or replace.",
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
      description: "Edit cells, append rows/columns, or rename an accessible workbook-style Spreadsheet (similar to Excel). Use for tabular data and formulas—not task cards or freeform drawings. Cell coordinates and row indexes are zero-based. Set sheetName for another worksheet. A value beginning with = is saved as a formula.",
      parameters: {
        type: "object",
        properties: {
          spreadsheetId: { type: "string" },
          edits: {
            type: "object",
            properties: {
              title: { type: "string", maxLength: 120 },
              sheetName: { type: "string", maxLength: 31 },
              cells: {
                type: "array",
                maxItems: 50,
                items: {
                  type: "object",
                  properties: {
                    row: { type: "integer", minimum: 0 },
                    column: { type: "integer", minimum: 0 },
                    value: { type: "string", maxLength: 32767 },
                  },
                  required: ["row", "column", "value"],
                },
              },
              appendRows: {
                type: "array",
                maxItems: 50,
                items: { type: "array", items: { type: "string", maxLength: 32767 }, maxItems: 16384 },
              },
              appendColumns: {
                type: "array",
                maxItems: 20,
                items: {
                  type: "object",
                  properties: {
                    values: { type: "array", items: { type: "string", maxLength: 32767 }, maxItems: 1000 },
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
  {
    type: "function" as const,
    function: {
      name: "edit_calendar",
      description: "Apply one validated operation to an accessible team Calendar (shared events, deadlines, and subscribed iCal feeds)—not task cards or spreadsheet cells. Use operation=create_event with event.title and event.startAt (ISO datetime or YYYY-MM-DD for all-day); use update_event/delete_event with eventId (from create_event or read_collaboration_artifact); rename_calendar to rename; add_ical_feed/refresh_ical_feed/remove_ical_feed to manage external iCal subscriptions. Do not delete events or feeds unless explicitly requested. Read the Calendar first when answering questions about it.",
      parameters: {
        type: "object",
        properties: {
          calendarId: { type: "string" },
          operation: calendarOperationSchema,
        },
        required: ["calendarId", "operation"],
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
    if (parsed.kind === "calendar") return "calendar";
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
  teamId?: string | null,
): Promise<ToolOutcome> {
  const requestedKind = args.kind;
  if (requestedKind !== undefined && !["whiteboard", "board", "document", "spreadsheet", "calendar"].includes(String(requestedKind))) {
    return toolFailure("Choose a supported artifact kind.");
  }
  const limit = safeNumber(args.limit, 25, 1, 50);
  const team = teamId?.trim() ? teamId : DEFAULT_TEAM_ID;
  const rows = await db.select().from(interviewWhiteboardsTable)
    .where(teamFilter(interviewWhiteboardsTable.teamId, team))
    .orderBy(desc(interviewWhiteboardsTable.updatedAt))
    .limit(200);
  const accessibility = await Promise.all(rows.map(async (row) => ({ row, ok: await canAccess(row) })));
  const items = accessibility
    .filter(({ ok }) => ok)
    .map(({ row }) => row)
    .flatMap((row) => {
      const kind = kindForRow(row);
      if (!kind || (requestedKind && kind !== requestedKind)) return [];
      return [{
        id: row.id,
        kind,
        title: row.title,
        scope: row.conversationScope === "direct"
          ? "direct"
          : row.conversationScope === "channel" ? "channel" : "shared",
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
      card.title,
      card.description,
      card.assignee ?? "",
      ...card.labels.map((label) => typeof label === "string" ? label : label.name),
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
  const requestedSheet = clippedText(args.sheetName, 31).trim() || undefined;
  const dimensions = spreadsheetGridSize(data);
  const rowOffset = safeNumber(args.offset, 0, 0, Math.max(0, dimensions.rows - 1));
  const rowLimit = safeNumber(args.limit, 25, 1, 50);
  const columnOffset = safeNumber(args.columnOffset, 0, 0, Math.max(0, dimensions.columns - 1));
  const columnLimit = safeNumber(args.columnLimit, 20, 1, 40);
  const view = spreadsheetPreviewRows(data, {
    sheetName: requestedSheet,
    offset: rowOffset,
    limit: rowLimit,
    columnOffset,
    columnLimit,
  });
  if (!view) return toolFailure("The requested worksheet was not found.");
  const selected = view.rows
    .map((cells, index) => ({ cells, rowIndex: rowOffset + index }))
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
      sheetName: view.sheetName,
      sheetNames: spreadsheetSheetNames(data),
      rowCount: view.rowCount,
      columnCount: view.columnCount,
      headers: spreadsheetPreviewRows(data, {
        sheetName: view.sheetName,
        offset: 0,
        limit: 1,
        columnOffset,
        columnLimit,
      })?.rows[0] ?? [],
      rowOffset,
      columnOffset,
      rows: selected,
      truncated: rowOffset + rowLimit < view.rowCount,
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

function calendarReadView(
  row: ArtifactRow,
  args: Record<string, unknown>,
): ToolOutcome {
  const data = parseCalendarData(row.data);
  if (!data) return toolFailure("The stored calendar data is invalid.");
  const query = clippedText(args.query, 120).trim().toLowerCase();
  const events = [...data.events]
    .sort((a, b) => toDateValue(a.startAt) - toDateValue(b.startAt))
    .filter((event) => !query || [
      event.title, event.description, event.location, ...event.assignees,
    ].some((value) => value.toLowerCase().includes(query)));
  const offset = safeNumber(args.offset, 0, 0, events.length);
  const limit = safeNumber(args.limit, 40, 1, 50);
  const slice = events.slice(offset, offset + limit).map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description.slice(0, 400),
    startAt: toDateValue(event.startAt) > 0 ? new Date(toDateValue(event.startAt)).toISOString() : String(event.startAt),
    endAt: toDateValue(event.endAt) > 0 ? new Date(toDateValue(event.endAt)).toISOString() : String(event.endAt),
    allDay: event.allDay,
    location: event.location,
    assignees: event.assignees,
    color: event.color,
    feedId: event.feedId,
    updatedBy: event.updatedBy,
  }));
  return {
    content: JSON.stringify({
      ok: true,
      id: row.id,
      kind: "calendar",
      title: row.title,
      description: data.description,
      feeds: data.feeds.map((feed) => ({
        id: feed.id,
        name: feed.name,
        url: feed.url,
        lastFetchedAt: feed.lastFetchedAt,
        lastError: feed.lastError,
      })),
      events: slice,
      eventCount: events.length,
      offset,
      truncated: offset + slice.length < events.length,
    }),
    activity: { tool: "read_collaboration_artifact", detail: `Calendar "${row.title.slice(0, 45)}"` },
  };
}

function toDateValue(value: string | Date): number {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

async function readArtifact(
  args: Record<string, unknown>,
  canAccess: ArtifactAccessCheck,
  teamId?: string | null,
): Promise<ToolOutcome> {
  const id = clippedText(args.artifactId, 120).trim();
  if (!id) return toolFailure("An artifact id is required.");
  const team = teamId?.trim() ? teamId : DEFAULT_TEAM_ID;
  const [row] = await db.select().from(interviewWhiteboardsTable)
    .where(and(eq(interviewWhiteboardsTable.id, id), teamFilter(interviewWhiteboardsTable.teamId, team)))
    .limit(1);
  const accessible = await canAccess(row);
  if (!row || !accessible) return toolFailure("Artifact not found or not accessible.");

  const kind = kindForRow(row);
  if (kind === "board") return boardReadView(row, args);
  if (kind === "spreadsheet") return spreadsheetReadView(row, args);
  if (kind === "whiteboard") return whiteboardReadView(row, args);
  if (kind === "calendar") return calendarReadView(row, args);
  if (kind === "document") {
    const read = await readDocumentForAssistant(row.id, String(args.displayName ?? ""), team);
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
  if (input.sheetName !== undefined && typeof input.sheetName !== "string") return { error: "The worksheet name must be text." };
  const edits: SpreadsheetAssistantEdits = {};
  if (typeof input.title === "string") edits.title = input.title;
  if (typeof input.sheetName === "string") edits.sheetName = input.sheetName;
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
  teamId?: string | null,
): Promise<ToolOutcome> {
  const boardId = clippedText(args.boardId, 120).trim();
  const operation = UpdateBoardBody.safeParse(args.operation);
  if (!boardId || !operation.success) {
    return toolFailure(operation.success ? "A board id is required." : "The board operation is invalid.");
  }
  const team = teamId?.trim() ? teamId : DEFAULT_TEAM_ID;

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(interviewWhiteboardsTable)
      .where(and(eq(interviewWhiteboardsTable.id, boardId), teamFilter(interviewWhiteboardsTable.teamId, team)))
      .limit(1)
      .for("update");
    const rowAccessible = await canAccess(row);
    if (!row || !rowAccessible || kindForRow(row) !== "board") {
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
      .where(and(eq(interviewWhiteboardsTable.id, row.id), teamFilter(interviewWhiteboardsTable.teamId, team)))
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
  teamId?: string | null,
): Promise<ToolOutcome> {
  const spreadsheetId = clippedText(args.spreadsheetId, 120).trim();
  const parsedEdits = parseSpreadsheetEdits(args.edits);
  if (!spreadsheetId || !parsedEdits.edits) {
    return toolFailure(parsedEdits.error ?? "A spreadsheet id is required.");
  }
  const team = teamId?.trim() ? teamId : DEFAULT_TEAM_ID;
  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(interviewWhiteboardsTable)
      .where(and(eq(interviewWhiteboardsTable.id, spreadsheetId), teamFilter(interviewWhiteboardsTable.teamId, team)))
      .limit(1)
      .for("update");
    const rowAccessible = await canAccess(row);
    if (!row || !rowAccessible || !isSpreadsheetRecordData(row.data)) {
      return { ok: false as const, error: "Spreadsheet not found or not accessible." };
    }
    const current = parseSpreadsheetData(row.data);
    if (!current) return { ok: false as const, error: "The stored spreadsheet data is invalid." };
    const applied = applySpreadsheetAssistantEdits(current, parsedEdits.edits!);
    if (!applied.ok) return applied;
    const serialized = JSON.stringify(applied.data);
    if (Buffer.byteLength(serialized, "utf8") > MAX_SPREADSHEET_DATA_BYTES) {
      return { ok: false as const, error: "That spreadsheet is too large to save." };
    }
    const [updated] = await tx.update(interviewWhiteboardsTable)
      .set({
        title: applied.title ?? row.title,
        data: serialized,
        updatedAt: new Date(),
      })
      .where(and(eq(interviewWhiteboardsTable.id, row.id), teamFilter(interviewWhiteboardsTable.teamId, team)))
      .returning();
    const dimensions = spreadsheetGridSize(applied.data);
    return {
      ok: true as const,
      title: updated.title,
      rowCount: dimensions.rows,
      columnCount: dimensions.columns,
      sheetCount: dimensions.sheets,
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
  teamId?: string | null,
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
  const team = teamId?.trim() ? teamId : DEFAULT_TEAM_ID;

  const resolvedOperations: WhiteboardOperation[] = [];
  for (const operation of parsedOperations.operations) {
    if (operation.type !== "add_image") {
      resolvedOperations.push(operation);
      continue;
    }
    const imagePath = generatedImageObjectPath(operation.imageUrl ?? "");
    if (!imagePath) {
      return toolFailure("Only the stored image URL returned by generate_image can be added to a whiteboard.");
    }
    try {
      const image = await objectStorageService.downloadObject(imagePath);
      const mimeType = image.contentType.split(";")[0]?.trim().toLowerCase() ?? "";
      if (
        image.data.byteLength > 800_000 ||
        !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mimeType)
      ) {
        return toolFailure("The generated image is too large or uses an unsupported format.");
      }
      resolvedOperations.push({
        ...operation,
        imageDataUrl: `data:${mimeType};base64,${image.data.toString("base64")}`,
        imageMimeType: mimeType,
      });
    } catch {
      return toolFailure("That generated image is no longer available in storage. Generate it again, then add it to the whiteboard.");
    }
  }

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(interviewWhiteboardsTable)
      .where(and(eq(interviewWhiteboardsTable.id, whiteboardId), teamFilter(interviewWhiteboardsTable.teamId, team)))
      .limit(1)
      .for("update");
    const rowAccessible = await canAccess(row);
    if (!row || !rowAccessible || kindForRow(row) !== "whiteboard") {
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
    const files = scene.files && typeof scene.files === "object" && !Array.isArray(scene.files)
      ? scene.files as Record<string, unknown>
      : {};
    const applied = applyWhiteboardOperations(elements, resolvedOperations, files);
    if (!applied.elements) return { ok: false as const, error: applied.error ?? "The scene edit could not be applied." };
    const serialized = mergeWhiteboardDataForSave(row.id, JSON.stringify({
      ...scene,
      elements: applied.elements,
      files: applied.files ?? files,
    }), team);
    if (Buffer.byteLength(serialized, "utf8") > MAX_ASSISTANT_WHITEBOARD_BYTES) {
      return { ok: false as const, error: "This whiteboard is too large to save." };
    }
    const [updated] = await tx.update(interviewWhiteboardsTable)
      .set({
        data: serialized,
        ...(title ? { title } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(interviewWhiteboardsTable.id, row.id), teamFilter(interviewWhiteboardsTable.teamId, team)))
      .returning();
    return { ok: true as const, row: updated, changed: applied.changed ?? 0 };
  });
  if (!result.ok) return toolFailure(result.error);
  broadcastWhiteboardScene(result.row.id, result.row.data, displayName, team);
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
  teamId?: string | null,
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
    teamId,
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

async function createWhiteboard(
  args: Record<string, unknown>,
  displayName: string,
  teamId?: string | null,
): Promise<ToolOutcome> {
  const title = clippedText(args.title, 120).trim();
  const includeAllApplicantNames = args.includeAllApplicantNames === true;
  if (!title) return toolFailure("A whiteboard title is required.");
  if (includeAllApplicantNames && args.entries !== undefined) {
    return toolFailure("Choose either all applicant names or a supplied entries list, not both.");
  }
  const team = teamId?.trim() ? teamId : DEFAULT_TEAM_ID;

  let entries: string[];
  if (includeAllApplicantNames) {
    const applicants = await db.select({ name: applicantsTable.name })
      .from(applicantsTable)
      .where(teamFilter(applicantsTable.teamId, team))
      .orderBy(asc(applicantsTable.name))
      .limit(MAX_ROSTER_ENTRIES + 1);
    if (applicants.length > MAX_ROSTER_ENTRIES) {
      return toolFailure(`There are more than ${MAX_ROSTER_ENTRIES} applicants. Narrow the roster before creating a whiteboard.`);
    }
    entries = applicants.map((applicant) => applicant.name);
  } else if (Array.isArray(args.entries)) {
    if (args.entries.length < 1 || args.entries.length > 500) {
      return toolFailure("Provide 1 to 500 text entries.");
    }
    if (args.entries.some((entry) => typeof entry !== "string" || !entry.trim() || entry.length > 200)) {
      return toolFailure("Each whiteboard entry must contain 1 to 200 characters.");
    }
    entries = args.entries.map((entry) => (entry as string).trim());
  } else {
    return toolFailure("Provide entries or set includeAllApplicantNames to true.");
  }
  if (entries.length === 0) return toolFailure("There are no applicants to add to the whiteboard.");

  const operations = buildTextListWhiteboardOperations(title, entries);
  const applied = applyWhiteboardOperations([], operations);
  if (!applied.elements) return toolFailure(applied.error ?? "The whiteboard could not be created.");
  const data = JSON.stringify({ elements: applied.elements, appState: {}, files: applied.files ?? {} });
  if (Buffer.byteLength(data, "utf8") > MAX_ASSISTANT_WHITEBOARD_BYTES) {
    return toolFailure("This list is too large for one whiteboard.");
  }
  const [row] = await db.insert(interviewWhiteboardsTable).values({
    id: randomUUID(),
    teamId: team,
    title,
    data,
    createdBy: displayName,
    conversationScope: "shared",
    conversationPeer: null,
  }).returning();
  pushRealtimeHint("interview_whiteboards");
  return {
    content: JSON.stringify({
      ok: true,
      whiteboardId: row.id,
      title: row.title,
      entryCount: entries.length,
    }),
    activity: { tool: "create_whiteboard", detail: `"${row.title.slice(0, 45)}" · ${entries.length} entries` },
  };
}

function creationTitle(args: Record<string, unknown>, artifactLabel: string): { title?: string; error?: string } {
  if (typeof args.title !== "string" || !args.title.trim()) {
    return { error: `A title is required to create the ${artifactLabel}.` };
  }
  const title = args.title.trim();
  if (title.length > 120) return { error: `${artifactLabel} titles must be 120 characters or fewer.` };
  return { title };
}

async function insertSharedArtifact(
  title: string,
  data: string,
  displayName: string,
  teamId?: string | null,
): Promise<ArtifactRow> {
  const team = teamId?.trim() ? teamId : DEFAULT_TEAM_ID;
  const [row] = await db.insert(interviewWhiteboardsTable).values({
    id: randomUUID(),
    teamId: team,
    title,
    data,
    createdBy: displayName,
    conversationScope: "shared",
    conversationPeer: null,
  }).returning();
  pushRealtimeHint("interview_whiteboards");
  return row;
}

async function createBoard(args: Record<string, unknown>, displayName: string, teamId?: string | null): Promise<ToolOutcome> {
  const parsedTitle = creationTitle(args, "task board");
  if (!parsedTitle.title) return toolFailure(parsedTitle.error ?? "A task board title is required.");
  const data = initialBoardData();
  const row = await insertSharedArtifact(
    parsedTitle.title,
    JSON.stringify(data),
    displayName,
    teamId,
  );
  return {
    content: JSON.stringify({
      ok: true,
      kind: "board",
      boardId: row.id,
      title: row.title,
      columns: data.columns.map(({ id, title }) => ({ id, title })),
    }),
    activity: { tool: "create_board", detail: `"${row.title.slice(0, 45)}"` },
  };
}

async function createDocument(args: Record<string, unknown>, displayName: string, teamId?: string | null): Promise<ToolOutcome> {
  const parsedTitle = creationTitle(args, "document");
  if (!parsedTitle.title) return toolFailure(parsedTitle.error ?? "A document title is required.");
  const row = await insertSharedArtifact(
    parsedTitle.title,
    JSON.stringify({ kind: "document", elements: [], yState: "" }),
    displayName,
    teamId,
  );
  return {
    content: JSON.stringify({ ok: true, kind: "document", documentId: row.id, title: row.title }),
    activity: { tool: "create_document", detail: `"${row.title.slice(0, 45)}"` },
  };
}

async function createSpreadsheet(args: Record<string, unknown>, displayName: string, teamId?: string | null): Promise<ToolOutcome> {
  const parsedTitle = creationTitle(args, "spreadsheet");
  if (!parsedTitle.title) return toolFailure(parsedTitle.error ?? "A spreadsheet title is required.");
  const data = initialSpreadsheetData();
  const row = await insertSharedArtifact(
    parsedTitle.title,
    JSON.stringify(data),
    displayName,
    teamId,
  );
  return {
    content: JSON.stringify({
      ok: true,
      kind: "spreadsheet",
      spreadsheetId: row.id,
      title: row.title,
      sheetNames: spreadsheetSheetNames(data),
    }),
    activity: { tool: "create_spreadsheet", detail: `"${row.title.slice(0, 45)}"` },
  };
}

async function createCalendar(args: Record<string, unknown>, displayName: string, teamId?: string | null): Promise<ToolOutcome> {
  const parsedTitle = creationTitle(args, "calendar");
  if (!parsedTitle.title) return toolFailure(parsedTitle.error ?? "A calendar title is required.");
  const row = await insertSharedArtifact(
    parsedTitle.title,
    JSON.stringify(initialCalendarData()),
    displayName,
    teamId,
  );
  return {
    content: JSON.stringify({ ok: true, kind: "calendar", calendarId: row.id, title: row.title }),
    activity: { tool: "create_calendar", detail: `"${row.title.slice(0, 45)}"` },
  };
}

async function editCalendar(
  args: Record<string, unknown>,
  displayName: string,
  canAccess: ArtifactAccessCheck,
  teamId?: string | null,
): Promise<ToolOutcome> {
  const calendarId = clippedText(args.calendarId, 120).trim();
  const operation = UpdateCalendarBody.safeParse(args.operation);
  if (!calendarId || !operation.success) {
    return toolFailure(operation.success ? "A calendar id is required." : "The calendar operation is invalid.");
  }
  const team = teamId?.trim() ? teamId : DEFAULT_TEAM_ID;

  // External feeds are fetched before the transaction so the database lock is
  // never held across network I/O. Add failures abort the update; refresh
  // failures are recorded on the feed (lastError) so the attempt is visible.
  let importedEvents: Awaited<ReturnType<typeof fetchIcalFeed>> | undefined;
  let feedError: string | undefined;
  if (operation.data.operation === "add_ical_feed") {
    const feedUrl = operation.data.feedUrl?.trim();
    if (feedUrl) {
      try {
        importedEvents = await fetchIcalFeed(feedUrl);
      } catch (error) {
        return toolFailure(error instanceof Error ? error.message : "That feed could not be read.");
      }
    }
  } else if (operation.data.operation === "refresh_ical_feed") {
    const feedId = operation.data.feedId?.trim();
    if (feedId) {
      const [existing] = await db.select().from(interviewWhiteboardsTable)
        .where(and(eq(interviewWhiteboardsTable.id, calendarId), teamFilter(interviewWhiteboardsTable.teamId, team)))
        .limit(1);
      const current = existing ? parseCalendarData(existing.data) : null;
      const feed = current?.feeds.find((item) => item.id === feedId);
      if (feed) {
        try {
          importedEvents = await fetchIcalFeed(feed.url);
        } catch (error) {
          feedError = error instanceof Error ? error.message : "That feed could not be read.";
        }
      }
    }
  }

  const result = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(interviewWhiteboardsTable)
      .where(and(eq(interviewWhiteboardsTable.id, calendarId), teamFilter(interviewWhiteboardsTable.teamId, team)))
      .limit(1)
      .for("update");
    const rowAccessible = await canAccess(row);
    if (!row || !rowAccessible || kindForRow(row) !== "calendar") {
      return { ok: false as const, error: "Calendar not found or not accessible." };
    }
    const current = parseCalendarData(row.data);
    if (!current) return { ok: false as const, error: "The stored calendar data is invalid." };
    const applied = applyCalendarOperation(current, operation.data, displayName, { importedEvents, feedError });
    if (!applied.ok) return { ok: false as const, error: applied.error };
    const serialized = JSON.stringify(applied.data);
    if (Buffer.byteLength(serialized, "utf8") > 1_500_000) {
      return { ok: false as const, error: "This calendar is too large to save." };
    }
    const [updated] = await tx.update(interviewWhiteboardsTable)
      .set({
        data: serialized,
        ...(applied.title ? { title: applied.title.slice(0, 120) } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(interviewWhiteboardsTable.id, row.id), teamFilter(interviewWhiteboardsTable.teamId, team)))
      .returning();
    const eventId = operation.data.operation === "create_event"
      ? applied.data.events[applied.data.events.length - 1]?.id
      : operation.data.eventId;
    return { ok: true as const, title: updated.title, operation: operation.data.operation, events: applied.data.events.length, eventId };
  });
  if (!result.ok) return toolFailure(result.error);
  pushRealtimeHint("interview_whiteboards");
  return {
    content: JSON.stringify({ ok: true, calendarId, title: result.title, operation: result.operation, eventCount: result.events, eventId: result.eventId }),
    activity: { tool: "edit_calendar", detail: `"${result.title.slice(0, 45)}" · ${result.operation}` },
  };
}

export async function runAssistantArtifactTool(
  name: string,
  args: Record<string, unknown>,
  displayName: string,
  canAccess: ArtifactAccessCheck,
  teamId?: string | null,
): Promise<ToolOutcome> {
  if (name === "list_collaboration_artifacts") return listArtifacts(args, canAccess, teamId);
  if (name === "read_collaboration_artifact") {
    return readArtifact({ ...args, displayName }, canAccess, teamId);
  }
  if (name === "create_board") return createBoard(args, displayName, teamId);
  if (name === "create_document") return createDocument(args, displayName, teamId);
  if (name === "create_spreadsheet") return createSpreadsheet(args, displayName, teamId);
  if (name === "create_calendar") return createCalendar(args, displayName, teamId);
  if (name === "create_whiteboard") return createWhiteboard(args, displayName, teamId);
  if (name === "edit_whiteboard") return editWhiteboard(args, displayName, canAccess, teamId);
  if (name === "edit_board") return editBoard(args, displayName, canAccess, teamId);
  if (name === "edit_document") return editDocument(args, displayName, teamId);
  if (name === "edit_spreadsheet") return editSpreadsheet(args, canAccess, teamId);
  if (name === "edit_calendar") return editCalendar(args, displayName, canAccess, teamId);
  return toolFailure("Unknown artifact tool.");
}
