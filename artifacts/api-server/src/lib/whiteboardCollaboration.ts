import type { IncomingMessage, Server } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer, WebSocket, type RawData } from "ws";
import { and, eq } from "drizzle-orm";
import {
  db,
  runWithInstance,
  currentInstance,
  DEFAULT_TEAM_ID,
  interviewerAccountsTable,
  interviewWhiteboardsTable,
  type DbInstance,
} from "@workspace/db";
import {
  interviewerIdFromSession,
  isRevokedAdminSession,
  isValidAdminSession,
} from "../middlewares/adminAuth";
import { logger } from "./logger";
import { teamFilter, findAccountAnywhere } from "./teams";

const MAX_WHITEBOARD_DATA_BYTES = 1_500_000;
const WHITEBOARD_PATH = /^\/api\/whiteboards\/([^/]+)\/collab$/;
const SESSION_COOKIE = "robotics_admin_session";

type WhiteboardRow = typeof interviewWhiteboardsTable.$inferSelect;
type StoredElement = { id: string; version?: number; versionNonce?: number; isDeleted?: boolean; [key: string]: unknown };
type StoredScene = { elements: StoredElement[]; appState?: Record<string, unknown>; files?: Record<string, unknown>; [key: string]: unknown };
type CursorPresence = {
  id: string;
  displayName: string;
  x: number;
  y: number;
  visible: boolean;
  selectedElementIds: string[];
};

type CollaborationMessage =
  | { type: "snapshot"; data: string; title: string; updatedAt: string; participants: number; collaborators: CursorPresence[] }
  | { type: "scene"; data: string; updatedAt: string; updatedBy: string; clientRevision: number }
  | { type: "ack"; clientRevision: number; updatedAt: string }
  | { type: "presence"; participants: number; collaborators: CursorPresence[] }
  | { type: "cursor"; id: string; displayName: string; x: number; y: number; visible: boolean; selectedElementIds: string[] }
  | { type: "error"; message: string };

type CollaborationClient = {
  id: string;
  displayName: string;
  whiteboardId: string;
  socket: WebSocket;
  cursor: CursorPresence;
};

type CollaborationRoom = {
  whiteboardId: string;
  teamId: string;
  // DB instance this team's rows live on; see schedulePersist.
  instance: DbInstance;
  clients: Set<CollaborationClient>;
  currentData: string;
  pendingData?: { data: string; updatedBy: string };
  flushTimer?: NodeJS.Timeout;
};

const rooms = new Map<string, CollaborationRoom>();
const websocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_WHITEBOARD_DATA_BYTES + 32_000,
});

function send(socket: WebSocket, message: CollaborationMessage): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key && value) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function sessionFromUpgrade(request: IncomingMessage, url: URL): string | undefined {
  const bearer = url.searchParams.get("access_token")?.trim();
  if (bearer && isValidAdminSession(bearer)) return bearer;
  const cookie = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  return isValidAdminSession(cookie) ? cookie : undefined;
}

function canAccessWhiteboard(whiteboard: WhiteboardRow, displayName: string): boolean {
  if (whiteboard.conversationScope !== "direct") return true;
  return (whiteboard.conversationPeer ?? "")
    .split("\u001f")
    .filter(Boolean)
    .some((label) => label.toLowerCase() === displayName.toLowerCase());
}

function normalizeWhiteboardData(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  if (Buffer.byteLength(value, "utf8") > MAX_WHITEBOARD_DATA_BYTES) return null;
  try {
    const parsed = JSON.parse(value) as { elements?: unknown };
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.elements)) return null;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

function parseScene(value: string): StoredScene | null {
  try {
    const parsed = JSON.parse(value) as Partial<StoredScene>;
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.elements)) return null;
    return {
      ...parsed,
      elements: parsed.elements.filter((element): element is StoredElement => (
        Boolean(element) &&
        typeof element === "object" &&
        typeof (element as StoredElement).id === "string"
      )),
    };
  } catch {
    return null;
  }
}

function isNewerElement(incoming: StoredElement, existing: StoredElement): boolean {
  const incomingVersion = typeof incoming.version === "number" ? incoming.version : 0;
  const existingVersion = typeof existing.version === "number" ? existing.version : 0;
  if (incomingVersion !== existingVersion) return incomingVersion > existingVersion;
  const incomingNonce = typeof incoming.versionNonce === "number" ? incoming.versionNonce : 0;
  const existingNonce = typeof existing.versionNonce === "number" ? existing.versionNonce : 0;
  return incomingNonce >= existingNonce;
}

function mergeSceneData(currentData: string, incomingData: string): string {
  const current = parseScene(currentData);
  const incoming = parseScene(incomingData);
  if (!current || !incoming) return incomingData;

  const mergedById = new Map(current.elements.map((element) => [element.id, element]));
  const order = current.elements.map((element) => element.id);
  for (const element of incoming.elements) {
    const existing = mergedById.get(element.id);
    if (!existing) {
      order.push(element.id);
      mergedById.set(element.id, element);
    } else if (isNewerElement(element, existing)) {
      mergedById.set(element.id, element);
    }
  }

  return JSON.stringify({
    ...current,
    elements: order.map((id) => mergedById.get(id)).filter((element): element is StoredElement => Boolean(element)),
    files: { ...(current.files ?? {}), ...(incoming.files ?? {}) },
  });
}

function broadcast(room: CollaborationRoom, message: CollaborationMessage, except?: WebSocket): void {
  for (const client of room.clients) {
    if (client.socket !== except) send(client.socket, message);
  }
}

function collaboratorsIn(room: CollaborationRoom, exceptId?: string): CursorPresence[] {
  return [...room.clients]
    .filter((client) => client.id !== exceptId)
    .map((client) => client.cursor);
}

function normalizeCursor(value: unknown): Pick<CursorPresence, "x" | "y" | "visible" | "selectedElementIds"> | null {
  if (!value || typeof value !== "object") return null;
  const cursor = value as {
    x?: unknown;
    y?: unknown;
    visible?: unknown;
    selectedElementIds?: unknown;
  };
  if (
    typeof cursor.x !== "number" ||
    !Number.isFinite(cursor.x) ||
    Math.abs(cursor.x) > 10_000_000 ||
    typeof cursor.y !== "number" ||
    !Number.isFinite(cursor.y) ||
    Math.abs(cursor.y) > 10_000_000
  ) return null;
  const selectedElementIds = Array.isArray(cursor.selectedElementIds)
    ? cursor.selectedElementIds
      .filter((id): id is string => typeof id === "string" && id.length <= 128)
      .slice(0, 100)
    : [];
  return {
    x: cursor.x,
    y: cursor.y,
    visible: cursor.visible === true,
    selectedElementIds,
  };
}

function roomFor(whiteboardId: string, currentData: string, teamId?: string | null): CollaborationRoom {
  const existing = rooms.get(whiteboardId);
  if (existing) return existing;
  const room: CollaborationRoom = {
    whiteboardId,
    teamId: teamId?.trim() ? teamId : DEFAULT_TEAM_ID,
    // openCollaboration runs inside runWithInstance(identity.instance), so
    // the instance captured here is the one this team's rows live on.
    instance: currentInstance(),
    clients: new Set(),
    currentData,
  };
  rooms.set(whiteboardId, room);
  return room;
}

function schedulePersist(room: CollaborationRoom): void {
  if (room.flushTimer) clearTimeout(room.flushTimer);
  room.flushTimer = setTimeout(() => {
    room.flushTimer = undefined;
    const pending = room.pendingData;
    room.pendingData = undefined;
    if (!pending) return;
    // This timer callback runs outside the request's AsyncLocalStorage
    // context, so `db` would resolve to primary even for teams that live on
    // the secondary instance and the update would silently match 0 rows.
    // Re-pin to the room's instance for every socket-driven persist.
    void runWithInstance(room.instance, () =>
      db.update(interviewWhiteboardsTable)
        .set({ data: pending.data, updatedAt: new Date() })
        .where(and(eq(interviewWhiteboardsTable.id, room.whiteboardId), teamFilter(interviewWhiteboardsTable.teamId, room.teamId))))
      .catch((error) => logger.error({ err: error, whiteboardId: room.whiteboardId }, "Whiteboard collaboration persist failed"));
  }, 180);
}

async function authenticateUpgrade(request: IncomingMessage, url: URL): Promise<{ interviewerId: string; displayName: string; teamId: string; instance: "primary" | "secondary" } | null> {
  const session = sessionFromUpgrade(request, url);
  if (!session || await isRevokedAdminSession(session)) return null;
  const interviewerId = interviewerIdFromSession(session);
  if (!interviewerId) return null;
  const found = await findAccountAnywhere(interviewerId);
  if (!found?.account.passwordHash) return null;
  return { interviewerId: found.account.id, displayName: found.account.displayName, teamId: found.account.teamId?.trim() ? found.account.teamId : DEFAULT_TEAM_ID, instance: found.instance };
}

async function openCollaboration(
  socket: WebSocket,
  identity: { interviewerId: string; displayName: string; teamId: string },
  whiteboard: WhiteboardRow,
  teamId?: string | null,
): Promise<void> {
  const whiteboardId = whiteboard.id;
  const room = roomFor(whiteboardId, whiteboard.data, teamId ?? identity.teamId ?? whiteboard.teamId);
  const clientId = randomUUID();
  const client: CollaborationClient = {
    id: clientId,
    displayName: identity.displayName,
    whiteboardId,
    socket,
    cursor: {
      id: clientId,
      displayName: identity.displayName,
      x: 0,
      y: 0,
      visible: false,
      selectedElementIds: [],
    },
  };
  room.clients.add(client);
  send(socket, {
    type: "snapshot",
    data: whiteboard.data,
    title: whiteboard.title,
    updatedAt: whiteboard.updatedAt.toISOString(),
    participants: room.clients.size,
    collaborators: collaboratorsIn(room, client.id),
  });
  broadcast(room, { type: "presence", participants: room.clients.size, collaborators: collaboratorsIn(room) }, socket);

  socket.on("message", (raw: RawData) => {
    let message: unknown;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      send(socket, { type: "error", message: "Invalid collaboration message." });
      return;
    }
    if (!message || typeof message !== "object") return;
    const payload = message as {
      type?: unknown;
      data?: unknown;
      clientRevision?: unknown;
      cursor?: unknown;
    };
    if (payload.type === "cursor") {
      const cursor = normalizeCursor(payload.cursor);
      if (!cursor) return;
      client.cursor = { ...client.cursor, ...cursor };
      broadcast(room, {
        type: "cursor",
        id: client.id,
        displayName: client.displayName,
        ...cursor,
      }, socket);
      return;
    }
    if (payload.type !== "scene") return;
    const data = normalizeWhiteboardData(payload.data);
    const clientRevision = typeof payload.clientRevision === "number" ? payload.clientRevision : 0;
    if (!data) {
      send(socket, { type: "error", message: "That whiteboard update is invalid or too large." });
      return;
    }

    const mergedData = mergeSceneData(room.currentData, data);
    room.currentData = mergedData;
    const updatedAt = new Date().toISOString();
    room.pendingData = { data: mergedData, updatedBy: client.displayName };
    schedulePersist(room);
    broadcast(room, {
      type: "scene",
      data: mergedData,
      updatedAt,
      updatedBy: client.displayName,
      clientRevision,
    });
    send(socket, { type: "ack", clientRevision, updatedAt });
  });

  socket.on("close", () => {
    room.clients.delete(client);
    broadcast(room, { type: "presence", participants: room.clients.size, collaborators: collaboratorsIn(room) });
    if (!room.clients.size) {
      if (room.flushTimer) clearTimeout(room.flushTimer);
      const pending = room.pendingData;
      room.pendingData = undefined;
      rooms.delete(whiteboardId);
      if (pending) {
        // Same instance re-pin as schedulePersist: the close callback runs
        // outside the request context.
        void runWithInstance(room.instance, () =>
          db.update(interviewWhiteboardsTable)
            .set({ data: pending.data, updatedAt: new Date() })
            .where(and(eq(interviewWhiteboardsTable.id, whiteboardId), teamFilter(interviewWhiteboardsTable.teamId, room.teamId))))
          .catch((error) => logger.error({ err: error, whiteboardId }, "Whiteboard collaboration final persist failed"));
      }
    }
  });
}

export function broadcastWhiteboardScene(whiteboardId: string, data: string, updatedBy: string, _teamId?: string | null): void {
  const room = rooms.get(whiteboardId);
  if (!room) return;
  const normalized = normalizeWhiteboardData(data);
  if (!normalized) return;
  const mergedData = mergeWhiteboardDataForSave(whiteboardId, normalized, _teamId);
  room.currentData = mergedData;
  const updatedAt = new Date().toISOString();
  room.pendingData = { data: mergedData, updatedBy };
  schedulePersist(room);
  broadcast(room, { type: "scene", data: mergedData, updatedAt, updatedBy, clientRevision: 0 });
}

export function mergeWhiteboardDataForSave(whiteboardId: string, data: string, _teamId?: string | null): string {
  const normalized = normalizeWhiteboardData(data);
  if (!normalized) return data;
  const room = rooms.get(whiteboardId);
  return room ? mergeSceneData(room.currentData, normalized) : normalized;
}

export function setupWhiteboardCollaboration(server: Server): void {
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const match = WHITEBOARD_PATH.exec(url.pathname);
    if (!match) {
      // Do not destroy the socket here: the same HTTP server also handles
      // document-collab (/api/whiteboards/:id/document-collab) and code-collab
      // (/api/code/:fileId/collab) upgrades in other listeners. Destroying an
      // unmatched socket would kill those connections before their handler
      // runs (notably the code IDE). Just return and let the matching handler
      // (or nothing, for unknown paths) deal with it.
      return;
    }
    const whiteboardId = decodeURIComponent(match[1]);
    void authenticateUpgrade(request, url)
      .then((identity) => runWithInstance(identity?.instance ?? "primary", () => {
        if (!identity) {
          socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }
        void db.select().from(interviewWhiteboardsTable)
          .where(and(eq(interviewWhiteboardsTable.id, whiteboardId), teamFilter(interviewWhiteboardsTable.teamId, identity.teamId)))
          .limit(1)
          .then(([whiteboard]) => {
            if (!whiteboard || !canAccessWhiteboard(whiteboard, identity.displayName)) {
              socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
              socket.destroy();
              return;
            }
            websocketServer.handleUpgrade(request, socket, head, (clientSocket) => {
              void openCollaboration(clientSocket, identity, whiteboard, identity.teamId).catch((error) => {
                logger.error({ err: error, whiteboardId }, "Whiteboard collaboration connection failed");
                clientSocket.close(1011, "Collaboration unavailable");
              });
            });
          })
          .catch((error) => {
            logger.error({ err: error, whiteboardId }, "Whiteboard collaboration authorization failed");
            socket.destroy();
          });
      }))
      .catch((error) => {
        logger.error({ err: error }, "Whiteboard collaboration authentication failed");
        socket.destroy();
      });
  });
}