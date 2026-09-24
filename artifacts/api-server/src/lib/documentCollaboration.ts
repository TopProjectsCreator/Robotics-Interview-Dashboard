import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { eq } from "drizzle-orm";
import * as decoding from "lib0/decoding";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { db, interviewerAccountsTable, interviewWhiteboardsTable } from "@workspace/db";
import {
  interviewerIdFromSession,
  isRevokedAdminSession,
  isValidAdminSession,
} from "../middlewares/adminAuth";
import { logger } from "./logger";

const MAX_DOCUMENT_DATA_BYTES = 1_500_000;
const DOCUMENT_PATH = /^\/api\/whiteboards\/([^/]+)\/document-collab$/;
const WHITEBOARD_PATH = /^\/api\/whiteboards\/[^/]+\/collab$/;
const SESSION_COOKIE = "robotics_admin_session";
const Y_UPDATE = 1;
const AWARENESS_UPDATE = 2;

type DocumentCollaborationClient = {
  socket: WebSocket;
  awarenessClientIds: Set<number>;
};

type DocumentRoom = {
  id: string;
  doc: Y.Doc;
  awareness: Awareness;
  clients: Set<DocumentCollaborationClient>;
  title: string;
  flushTimer?: NodeJS.Timeout;
};

const rooms = new Map<string, DocumentRoom>();
const websocketServer = new WebSocketServer({
  noServer: true,
  maxPayload: MAX_DOCUMENT_DATA_BYTES,
});

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

function canAccessDocument(
  document: typeof interviewWhiteboardsTable.$inferSelect,
  displayName: string,
): boolean {
  if (document.conversationScope !== "direct") return true;
  return (document.conversationPeer ?? "")
    .split("\u001f")
    .filter(Boolean)
    .some((label) => label.toLowerCase() === displayName.toLowerCase());
}

async function authenticateUpgrade(
  request: IncomingMessage,
  url: URL,
): Promise<{ id: string; displayName: string } | null> {
  const session = sessionFromUpgrade(request, url);
  if (!session || await isRevokedAdminSession(session)) return null;
  const id = interviewerIdFromSession(session);
  if (!id) return null;
  const [account] = await db.select({
    id: interviewerAccountsTable.id,
    displayName: interviewerAccountsTable.displayName,
    passwordHash: interviewerAccountsTable.passwordHash,
  }).from(interviewerAccountsTable).where(eq(interviewerAccountsTable.id, id)).limit(1);
  return account?.passwordHash ? { id: account.id, displayName: account.displayName } : null;
}

function rawBytes(raw: RawData): Uint8Array {
  if (Array.isArray(raw)) {
    const combined = Buffer.concat(raw);
    return new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength);
  }
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}

function packet(kind: number, update: Uint8Array): Uint8Array {
  const result = new Uint8Array(update.byteLength + 1);
  result[0] = kind;
  result.set(update, 1);
  return result;
}

function sendBinary(socket: WebSocket, message: Uint8Array): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(message, { binary: true });
}

function sendJson(socket: WebSocket, message: object): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function documentEnvelope(doc: Y.Doc): string {
  return JSON.stringify({
    kind: "document",
    elements: [],
    yState: Buffer.from(Y.encodeStateAsUpdate(doc)).toString("base64"),
  });
}

function schedulePersist(room: DocumentRoom): void {
  if (room.flushTimer) clearTimeout(room.flushTimer);
  room.flushTimer = setTimeout(() => {
    room.flushTimer = undefined;
    void db.update(interviewWhiteboardsTable)
      .set({ data: documentEnvelope(room.doc), updatedAt: new Date() })
      .where(eq(interviewWhiteboardsTable.id, room.id))
      .then(() => {
        for (const client of room.clients) sendJson(client.socket, { type: "saved" });
      })
      .catch((error) => logger.error({ err: error, documentId: room.id }, "Collaborative document persist failed"));
  }, 180);
}

function roomFor(
  id: string,
  title: string,
  storedData: string,
): DocumentRoom {
  const existing = rooms.get(id);
  if (existing) return existing;

  const doc = new Y.Doc();
  try {
    const parsed = JSON.parse(storedData) as { yState?: unknown };
    if (typeof parsed.yState === "string" && parsed.yState) {
      Y.applyUpdate(doc, new Uint8Array(Buffer.from(parsed.yState, "base64")));
    }
  } catch (error) {
    logger.warn({ err: error, documentId: id }, "Stored collaborative document state was invalid");
  }
  const room: DocumentRoom = {
    id,
    doc,
    awareness: new Awareness(doc),
    clients: new Set(),
    title,
  };
  room.awareness.setLocalState(null);
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    const message = packet(Y_UPDATE, update);
    for (const client of room.clients) {
      if (client.socket !== origin) sendBinary(client.socket, message);
    }
    schedulePersist(room);
  });
  room.awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    const clients = [...added, ...updated, ...removed];
    if (!clients.length) return;
    const message = packet(AWARENESS_UPDATE, encodeAwarenessUpdate(room.awareness, clients));
    for (const client of room.clients) {
      if (client.socket !== origin) sendBinary(client.socket, message);
    }
  });
  rooms.set(id, room);
  return room;
}

function awarenessClientIds(update: Uint8Array): number[] {
  const decoder = decoding.createDecoder(update);
  const count = decoding.readVarUint(decoder);
  const ids: number[] = [];
  for (let index = 0; index < count; index += 1) {
    ids.push(decoding.readVarUint(decoder));
    decoding.readVarUint(decoder);
    decoding.readVarString(decoder);
  }
  return ids;
}

function candidateDocumentSize(doc: Y.Doc, update: Uint8Array): number {
  const candidate = new Y.Doc();
  try {
    Y.applyUpdate(candidate, Y.encodeStateAsUpdate(doc));
    Y.applyUpdate(candidate, update);
    return Buffer.byteLength(documentEnvelope(candidate), "utf8");
  } finally {
    candidate.destroy();
  }
}

async function openDocumentRoom(
  socket: WebSocket,
  documentId: string,
  identity: { id: string; displayName: string },
): Promise<void> {
  const [document] = await db.select().from(interviewWhiteboardsTable)
    .where(eq(interviewWhiteboardsTable.id, documentId))
    .limit(1);
  if (!document || !canAccessDocument(document, identity.displayName)) {
    sendJson(socket, { type: "error", message: "Document not found." });
    socket.close(1008, "Document not found");
    return;
  }
  let parsed: unknown;
  try { parsed = JSON.parse(document.data); } catch { parsed = null; }
  if (!parsed || typeof parsed !== "object" || (parsed as { kind?: unknown }).kind !== "document") {
    sendJson(socket, { type: "error", message: "Document not found." });
    socket.close(1008, "Document not found");
    return;
  }

  const room = roomFor(documentId, document.title, document.data);
  const client: DocumentCollaborationClient = { socket, awarenessClientIds: new Set() };
  room.clients.add(client);
  sendJson(socket, { type: "meta", title: room.title, participants: room.clients.size });
  sendBinary(socket, packet(Y_UPDATE, Y.encodeStateAsUpdate(room.doc)));
  const onlineAwareness = [...room.awareness.getStates().entries()]
    .filter(([, state]) => state !== null)
    .map(([id]) => id);
  if (onlineAwareness.length) {
    sendBinary(socket, packet(AWARENESS_UPDATE, encodeAwarenessUpdate(room.awareness, onlineAwareness)));
  }
  for (const peer of room.clients) {
    if (peer !== client) sendJson(peer.socket, { type: "meta", title: room.title, participants: room.clients.size });
  }

  socket.on("message", (raw: RawData, isBinary: boolean) => {
    const bytes = rawBytes(raw);
    if (isBinary) {
      if (!bytes.length) return;
      const kind = bytes[0];
      const update = bytes.subarray(1);
      try {
        if (kind === Y_UPDATE) {
          if (candidateDocumentSize(room.doc, update) > MAX_DOCUMENT_DATA_BYTES) {
            sendJson(socket, { type: "error", message: "This document reached the maximum size." });
            return;
          }
          Y.applyUpdate(room.doc, update, socket);
        } else if (kind === AWARENESS_UPDATE) {
          for (const id of awarenessClientIds(update)) client.awarenessClientIds.add(id);
          applyAwarenessUpdate(room.awareness, update, socket);
        }
      } catch (error) {
        logger.warn({ err: error, documentId }, "Invalid collaborative document update");
        sendJson(socket, { type: "error", message: "That document update could not be applied." });
      }
      return;
    }

    let message: unknown;
    try { message = JSON.parse(Buffer.from(bytes).toString("utf8")); } catch { return; }
    if (!message || typeof message !== "object") return;
    const payload = message as { type?: unknown; title?: unknown };
    if (payload.type !== "title" || typeof payload.title !== "string") return;
    const title = payload.title.trim().slice(0, 120);
    if (!title) return;
    room.title = title;
    const updatedAt = new Date();
    void db.update(interviewWhiteboardsTable)
      .set({ title, updatedAt })
      .where(eq(interviewWhiteboardsTable.id, documentId))
      .then(() => {
        for (const peer of room.clients) sendJson(peer.socket, { type: "saved" });
      })
      .catch((error) => logger.error({ err: error, documentId }, "Collaborative document title update failed"));
    for (const peer of room.clients) {
      sendJson(peer.socket, { type: "meta", title, participants: room.clients.size });
    }
  });

  socket.on("close", () => {
    room.clients.delete(client);
    if (client.awarenessClientIds.size) {
      removeAwarenessStates(room.awareness, [...client.awarenessClientIds], socket);
    }
    for (const peer of room.clients) {
      sendJson(peer.socket, { type: "meta", title: room.title, participants: room.clients.size });
    }
    if (!room.clients.size) {
      if (room.flushTimer) clearTimeout(room.flushTimer);
      room.flushTimer = undefined;
      rooms.delete(documentId);
      void db.update(interviewWhiteboardsTable)
        .set({ data: documentEnvelope(room.doc), updatedAt: new Date() })
        .where(eq(interviewWhiteboardsTable.id, documentId))
        .catch((error) => logger.error({ err: error, documentId }, "Collaborative document final persist failed"))
        .finally(() => {
          room.awareness.destroy();
          room.doc.destroy();
        });
    }
  });
}

export function setupDocumentCollaboration(server: Server): void {
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const match = DOCUMENT_PATH.exec(url.pathname);
    if (!match) return;
    const documentId = decodeURIComponent(match[1]);
    void authenticateUpgrade(request, url)
      .then((identity) => {
        if (!identity) {
          socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }
        websocketServer.handleUpgrade(request, socket, head, (clientSocket) => {
          void openDocumentRoom(clientSocket, documentId, identity).catch((error) => {
            logger.error({ err: error, documentId }, "Document collaboration connection failed");
            clientSocket.close(1011, "Collaboration unavailable");
          });
        });
      })
      .catch((error) => {
        logger.error({ err: error, documentId }, "Document collaboration authentication failed");
        socket.destroy();
      });
  });
}

export function isDocumentCollaborationPath(pathname: string): boolean {
  return DOCUMENT_PATH.test(pathname);
}