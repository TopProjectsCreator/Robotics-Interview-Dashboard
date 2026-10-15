import type { IncomingMessage, Server } from "node:http";
import { WebSocket, WebSocketServer, type RawData } from "ws";
import { eq } from "drizzle-orm";
import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import { db, runWithInstance, codeFilesTable, interviewerAccountsTable, DEFAULT_TEAM_ID } from "@workspace/db";
import { findAccountAnywhere } from "./teams";
import {
  interviewerIdFromSession,
  isRevokedAdminSession,
  isValidAdminSession,
} from "../middlewares/adminAuth";
import { logger } from "./logger";

const MAX_CODE_BYTES = 500_000;
// ws://host/api/code/<fileId>/collab
const CODE_PATH = /^\/api\/code\/([^/]+)\/collab$/;
const SESSION_COOKIE = "robotics_admin_session";
const Y_UPDATE = 1;
const AWARENESS_UPDATE = 2;

type CodeClient = { socket: WebSocket; awarenessIds: Set<number> };
type CodeRoom = {
  fileId: string;
  doc: Y.Doc;
  awareness: Awareness;
  clients: Set<CodeClient>;
  revision: number;
  lastPersisted: number;
  chain: Promise<void>;
  timer?: NodeJS.Timeout;
};

const rooms = new Map<string, CodeRoom>();
const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_CODE_BYTES + 1024 });

function cookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k && v) out[k] = decodeURIComponent(v);
  }
  return out;
}

function sessionOf(req: IncomingMessage, url: URL): string | undefined {
  const bearer = url.searchParams.get("access_token")?.trim();
  if (bearer && isValidAdminSession(bearer)) return bearer;
  const cookie = cookies(req.headers.cookie)[SESSION_COOKIE];
  return isValidAdminSession(cookie) ? cookie : undefined;
}

async function identity(session: string): Promise<{ id: string; displayName: string; teamId: string; instance: "primary" | "secondary" } | null> {
  if (await isRevokedAdminSession(session)) return null;
  const id = interviewerIdFromSession(session);
  if (!id) return null;
  const found = await findAccountAnywhere(id);
  if (!found?.account.passwordHash) return null;
  return {
    id: found.account.id,
    displayName: found.account.displayName,
    teamId: found.account.teamId?.trim() ? found.account.teamId : DEFAULT_TEAM_ID,
    instance: found.instance,
  };
}

/** True when a code file row belongs to `teamId` (legacy NULL = default team). */
function fileInTeam(fileTeamId: string | null | undefined, teamId: string): boolean {
  const owner = fileTeamId?.trim() ? fileTeamId : DEFAULT_TEAM_ID;
  return owner === teamId;
}

function bytes(raw: RawData): Uint8Array {
  if (Array.isArray(raw)) {
    const c = Buffer.concat(raw);
    return new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
  }
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
}

function frame(kind: number, update: Uint8Array): Uint8Array {
  const out = new Uint8Array(update.byteLength + 1);
  out[0] = kind;
  out.set(update, 1);
  return out;
}

function sendBin(socket: WebSocket, message: Uint8Array): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(message, { binary: true });
}

function sendJson(socket: WebSocket, message: object): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function schedulePersist(room: CodeRoom): void {
  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => {
    room.timer = undefined;
    const revision = room.revision;
    const content = room.doc.getText("content").toString().slice(0, MAX_CODE_BYTES);
    room.lastPersisted = Math.max(room.lastPersisted, revision);
    room.chain = room.chain.then(async () => {
      try {
        await db.update(codeFilesTable)
          .set({ content, updatedAt: new Date() })
          .where(eq(codeFilesTable.id, room.fileId));
        if (room.revision === revision) {
          for (const client of room.clients) sendJson(client.socket, { type: "saved" });
        }
      } catch (error) {
        logger.error({ err: error, fileId: room.fileId }, "Code collaboration persist failed");
        for (const client of room.clients) {
          sendJson(client.socket, { type: "error", message: "Code changes could not be saved." });
        }
      }
      if (room.revision > room.lastPersisted) schedulePersist(room);
    });
  }, 250);
}

function roomFor(fileId: string, content: string): CodeRoom {
  const existing = rooms.get(fileId);
  if (existing) return existing;
  const doc = new Y.Doc();
  if (content) doc.getText("content").insert(0, content.slice(0, MAX_CODE_BYTES));
  const room: CodeRoom = {
    fileId, doc, awareness: new Awareness(doc),
    clients: new Set(), revision: 0, lastPersisted: 0, chain: Promise.resolve(),
  };
  room.awareness.setLocalState(null);
  doc.on("update", (update: Uint8Array, origin: unknown) => {
    room.revision += 1;
    const message = frame(Y_UPDATE, update);
    for (const client of room.clients) {
      if (client.socket !== origin) sendBin(client.socket, message);
    }
    schedulePersist(room);
  });
  room.awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    const ids = [...added, ...updated, ...removed];
    if (!ids.length) return;
    const message = frame(AWARENESS_UPDATE, encodeAwarenessUpdate(room.awareness, ids));
    for (const client of room.clients) {
      if (client.socket !== origin) sendBin(client.socket, message);
    }
  });
  rooms.set(fileId, room);
  return room;
}

// A REST save (flush-on-close, import, git pull, assistant edit) writes the
// database directly, bypassing the Yjs room. Without this, every editor that
// already has the file open keeps serving its in-memory copy until reopen.
// Fold the new content into the live room so all connected IDEs update now.
const REST_SAVE_ORIGIN = "rest-save";
export function applyCodeFileContent(fileId: string, content: string): boolean {
  const room = rooms.get(fileId);
  if (!room) return false;
  const next = content.slice(0, MAX_CODE_BYTES);
  const current = room.doc.getText("content").toString();
  if (current === next) return false;
  room.doc.transact(() => {
    const text = room.doc.getText("content");
    text.delete(0, text.length);
    if (next) text.insert(0, next);
  }, REST_SAVE_ORIGIN);
  return true;
}

async function open(socket: WebSocket, fileId: string, displayName: string, teamId: string): Promise<void> {
  const [file] = await db.select({
    id: codeFilesTable.id, content: codeFilesTable.content, teamId: codeFilesTable.teamId,
  }).from(codeFilesTable).where(eq(codeFilesTable.id, fileId)).limit(1);
  if (!file) {
    sendJson(socket, { type: "error", message: "That file no longer exists." });
    socket.close(4404, "not found");
    return;
  }
  if (!fileInTeam(file.teamId, teamId)) {
    sendJson(socket, { type: "error", message: "That file belongs to another team." });
    socket.close(4403, "forbidden");
    return;
  }
  const room = roomFor(fileId, file.content ?? "");
  const client: CodeClient = { socket, awarenessIds: new Set() };
  room.clients.add(client);
  sendBin(socket, frame(Y_UPDATE, Y.encodeStateAsUpdate(room.doc)));
  sendBin(socket, frame(AWARENESS_UPDATE, encodeAwarenessUpdate(room.awareness, [...room.awareness.getStates().keys()])));

  socket.on("message", (raw: RawData) => {
    let data: Uint8Array;
    try {
      data = bytes(raw);
    } catch {
      return;
    }
    if (!data.length) return;
    const kind = data[0];
    const update = data.subarray(1);
    try {
      if (kind === Y_UPDATE) {
        Y.applyUpdate(room.doc, update, socket);
      } else if (kind === AWARENESS_UPDATE) {
        applyAwarenessUpdate(room.awareness, update, socket);
      }
    } catch (error) {
      logger.warn({ err: error, fileId }, "Invalid code collaboration update");
    }
  });

  const cleanup = () => {
    room.clients.delete(client);
    removeAwarenessStates(room.awareness, [...client.awarenessIds], socket);
    if (!room.clients.size) {
      if (room.timer) clearTimeout(room.timer);
      const content = room.doc.getText("content").toString().slice(0, MAX_CODE_BYTES);
      db.update(codeFilesTable)
        .set({ content, updatedAt: new Date() })
        .where(eq(codeFilesTable.id, fileId))
        .catch((error) => logger.error({ err: error, fileId }, "Code collaboration final persist failed"));
      room.doc.destroy();
      room.awareness.destroy();
      rooms.delete(fileId);
    }
  };
  socket.on("close", cleanup);
  socket.on("error", () => socket.close());
  sendJson(socket, { type: "meta", displayName });
}

export function setupCodeCollaboration(server: Server): void {
  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    let url: URL;
    try {
      url = new URL(request.url ?? "", "http://localhost");
    } catch {
      return;
    }
    if (!CODE_PATH.test(url.pathname)) return;
    const session = sessionOf(request, url);
    if (!session) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, (client) => {
      const match = CODE_PATH.exec(url.pathname);
      const fileId = decodeURIComponent(match?.[1] ?? "");
      identity(session).then((who) => runWithInstance(who?.instance ?? "primary", () => {
        if (!who) {
          client.close(4401, "unauthorized");
          return;
        }
        void open(client, fileId, who.displayName, who.teamId).catch((error) => {
          logger.error({ err: error, fileId }, "Code collaboration connection failed");
          try { client.close(1011, "error"); } catch { /* closed */ }
        });
      })).catch((error) => {
        logger.error({ err: error, fileId }, "Code collaboration auth failed");
        try { client.close(1011, "error"); } catch { /* closed */ }
      });
    });
  });
}
