import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { getStoredAuthToken } from "../authSession";

export type DocumentCollaborationStatus = "connecting" | "connected" | "reconnecting";

export type DocumentCollaborationSession = {
  doc: Y.Doc;
  provider: { awareness: Awareness; setTitle: (title: string) => void };
  subscribeStatus: (callback: (status: DocumentCollaborationStatus) => void) => () => void;
  subscribeSaveStatus: (callback: (status: "saving" | "saved") => void) => () => void;
  subscribeTitle: (callback: (title: string) => void) => () => void;
  destroy: () => void;
};

type Collaborator = { name: string; color: string };

const Y_UPDATE = 1;
const AWARENESS_UPDATE = 2;

export function isDocumentData(data: string | undefined): boolean {
  if (!data) return false;
  try {
    const parsed = JSON.parse(data) as { kind?: unknown };
    return parsed?.kind === "document";
  } catch {
    return false;
  }
}

function updatePacket(kind: number, update: Uint8Array): Uint8Array {
  const packet = new Uint8Array(update.byteLength + 1);
  packet[0] = kind;
  packet.set(update, 1);
  return packet;
}

function decodePacket(value: ArrayBuffer): { kind: number; update: Uint8Array } | null {
  const packet = new Uint8Array(value);
  if (!packet.length) return null;
  return { kind: packet[0], update: packet.subarray(1) };
}

function applyStoredState(doc: Y.Doc, data: string): void {
  try {
    const envelope = JSON.parse(data) as { yState?: unknown };
    if (typeof envelope.yState === "string" && envelope.yState) {
      const binary = Uint8Array.from(atob(envelope.yState), (char) => char.charCodeAt(0));
      Y.applyUpdate(doc, binary);
    }
  } catch (error) {
    console.warn("Couldn't read the saved collaborative document state.", error);
  }
}

function awarenessPacket(awareness: Awareness): Uint8Array {
  const update = encodeAwarenessUpdate(awareness, [awareness.clientID]);
  return updatePacket(AWARENESS_UPDATE, update);
}

export function createDocumentCollaboration(
  documentId: string,
  data: string,
  collaborator: Collaborator,
): DocumentCollaborationSession {
  const doc = new Y.Doc();
  applyStoredState(doc, data);

  const awareness = new Awareness(doc);
  awareness.setLocalStateField("user", collaborator);
  const statusListeners = new Set<(status: DocumentCollaborationStatus) => void>();
  const saveStatusListeners = new Set<(status: "saving" | "saved") => void>();
  const titleListeners = new Set<(title: string) => void>();
  let status: DocumentCollaborationStatus = "connecting";
  let saveStatus: "saving" | "saved" = "saved";
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let retryDelay = 500;
  let stopped = false;
  let pendingTitle: string | null = null;

  const setStatus = (next: DocumentCollaborationStatus) => {
    status = next;
    for (const listener of statusListeners) listener(next);
  };
  const setSaveStatus = (next: "saving" | "saved") => {
    saveStatus = next;
    for (const listener of saveStatusListeners) listener(next);
  };

  const sendBinary = (message: Uint8Array) => {
    if (!stopped && socket?.readyState === WebSocket.OPEN) socket.send(message);
  };

  const connect = () => {
    if (stopped) return;
    setStatus(retryDelay === 500 ? "connecting" : "reconnecting");
    const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = getStoredAuthToken();
    const query = token ? `?access_token=${encodeURIComponent(token)}` : "";
    const nextSocket = new WebSocket(
      `${protocol}//${window.location.host}${base}/api/whiteboards/${encodeURIComponent(documentId)}/document-collab${query}`,
    );
    nextSocket.binaryType = "arraybuffer";
    socket = nextSocket;

    nextSocket.onopen = () => {
      if (stopped || socket !== nextSocket) return;
      retryDelay = 500;
      setStatus("connected");
      sendBinary(updatePacket(Y_UPDATE, Y.encodeStateAsUpdate(doc)));
      sendBinary(awarenessPacket(awareness));
      if (pendingTitle) {
        nextSocket.send(JSON.stringify({ type: "title", title: pendingTitle }));
      }
    };
    nextSocket.onmessage = async (event) => {
      if (stopped || socket !== nextSocket) return;
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data) as { type?: unknown; title?: unknown };
          if (message.type === "saved") setSaveStatus("saved");
          if (message.type === "meta" && typeof message.title === "string") {
            for (const listener of titleListeners) listener(message.title);
          }
        } catch {
          // Ignore malformed status messages.
        }
        return;
      }
      try {
        const binary = event.data instanceof ArrayBuffer
          ? event.data
          : event.data instanceof Blob
            ? await event.data.arrayBuffer()
            : null;
        if (!binary) return;
        if (stopped || socket !== nextSocket) return;
        const message = decodePacket(binary);
        if (!message) return;
        if (message.kind === Y_UPDATE) {
          Y.applyUpdate(doc, message.update, nextSocket);
        } else if (message.kind === AWARENESS_UPDATE) {
          applyAwarenessUpdate(awareness, message.update, nextSocket);
        }
      } catch (error) {
        console.warn("Couldn't apply a live document update.", error);
      }
    };
    nextSocket.onerror = () => nextSocket.close();
    nextSocket.onclose = () => {
      if (socket !== nextSocket) return;
      socket = null;
      if (stopped) return;
      setStatus("reconnecting");
      reconnectTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(5000, retryDelay * 2);
    };
  };

  doc.on("update", (update: Uint8Array, origin: unknown) => {
    if (origin !== socket) {
      setSaveStatus("saving");
      sendBinary(updatePacket(Y_UPDATE, update));
    }
  });
  awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === socket) return;
    const ids = [...added, ...updated, ...removed];
    if (ids.length) sendBinary(updatePacket(AWARENESS_UPDATE, encodeAwarenessUpdate(awareness, ids)));
  });

  connect();

  return {
    doc,
    provider: {
      awareness,
      setTitle: (title: string) => {
        if (stopped) return;
        pendingTitle = title.trim().slice(0, 120);
        if (pendingTitle) setSaveStatus("saving");
        if (socket?.readyState === WebSocket.OPEN && pendingTitle) {
          socket.send(JSON.stringify({ type: "title", title: pendingTitle }));
        }
      },
    },
    subscribeStatus: (callback) => {
      statusListeners.add(callback);
      callback(status);
      return () => statusListeners.delete(callback);
    },
    subscribeSaveStatus: (callback) => {
      saveStatusListeners.add(callback);
      callback(saveStatus);
      return () => saveStatusListeners.delete(callback);
    },
    subscribeTitle: (callback) => {
      titleListeners.add(callback);
      return () => titleListeners.delete(callback);
    },
    destroy: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
      statusListeners.clear();
      saveStatusListeners.clear();
      titleListeners.clear();
      awareness.destroy();
      doc.destroy();
    },
  };
}