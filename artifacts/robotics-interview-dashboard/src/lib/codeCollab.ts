import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
} from "y-protocols/awareness";
import { getStoredAuthToken } from "../authSession";

export type CodeCollabStatus = "connecting" | "connected" | "reconnecting";

export type CodeCollaborator = { name: string; color: string };

export type CodeCollabSession = {
  doc: Y.Doc;
  text: Y.Text;
  awareness: Awareness;
  subscribeStatus: (callback: (status: CodeCollabStatus) => void) => () => void;
  subscribeSaveStatus: (callback: (status: "saving" | "saved" | "error") => void) => () => void;
  subscribePeers: (callback: (peers: { name: string; color: string }[]) => void) => () => void;
  applyServerContent: (content: string) => void;
  destroy: () => void;
};

const Y_UPDATE = 1;
const AWARENESS_UPDATE = 2;

function frame(kind: number, update: Uint8Array): Uint8Array {
  const out = new Uint8Array(update.byteLength + 1);
  out[0] = kind;
  out.set(update, 1);
  return out;
}

export function createCodeCollab(
  fileId: string,
  initialContent: string,
  collaborator: CodeCollaborator,
): CodeCollabSession {
  const doc = new Y.Doc();
  const text = doc.getText("content");
  if (initialContent) text.insert(0, initialContent);

  const awareness = new Awareness(doc);
  awareness.setLocalStateField("user", collaborator);

  const statusListeners = new Set<(status: CodeCollabStatus) => void>();
  const saveListeners = new Set<(status: "saving" | "saved" | "error") => void>();
  const peerListeners = new Set<(peers: { name: string; color: string }[]) => void>();
  let status: CodeCollabStatus = "connecting";
  let socket: WebSocket | null = null;
  let stopped = false;
  let retryDelay = 500;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (next: CodeCollabStatus) => {
    status = next;
    for (const listener of statusListeners) listener(next);
  };

  const setSaveStatus = (next: "saving" | "saved" | "error") => {
    for (const listener of saveListeners) listener(next);
  };

  const emitPeers = () => {    const peers: { name: string; color: string }[] = [];
    for (const state of awareness.getStates().values()) {
      const user = (state as { user?: { name?: string; color?: string } }).user;
      if (user?.name) peers.push({ name: user.name, color: user.color ?? "#f8c84a" });
    }
    for (const listener of peerListeners) listener(peers);
  };

  const send = (message: Uint8Array) => {
    if (!stopped && socket?.readyState === WebSocket.OPEN) socket.send(message);
  };

  const connect = () => {
    if (stopped) return;
    setStatus(retryDelay === 500 ? "connecting" : "reconnecting");
    const base = String(import.meta.env.BASE_URL || "/").replace(/\/+$/, "");
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const token = getStoredAuthToken();
    const query = token ? `?access_token=${encodeURIComponent(token)}` : "";
    const next = new WebSocket(
      `${protocol}//${window.location.host}${base}/api/code/${encodeURIComponent(fileId)}/collab${query}`,
    );
    next.binaryType = "arraybuffer";
    socket = next;

    next.onopen = () => {
      if (stopped || socket !== next) return;
      retryDelay = 500;
      setStatus("connected");
      send(frame(Y_UPDATE, Y.encodeStateAsUpdate(doc)));
      send(frame(AWARENESS_UPDATE, encodeAwarenessUpdate(awareness, [awareness.clientID])));
    };
    next.onmessage = async (event) => {
      if (stopped || socket !== next) return;
      if (typeof event.data === "string") {
        try {
          const message = JSON.parse(event.data) as { type?: unknown };
          if (message.type === "saved") setSaveStatus("saved");
          else if (message.type === "error") setSaveStatus("error");
        } catch {
          // Ignore malformed status messages.
        }
        return;
      }
      const binary = event.data instanceof ArrayBuffer
        ? new Uint8Array(event.data)
        : event.data instanceof Blob
          ? new Uint8Array(await event.data.arrayBuffer())
          : null;
      if (!binary?.length) return;
      const kind = binary[0];
      const update = binary.subarray(1);
      try {
        if (kind === Y_UPDATE) Y.applyUpdate(doc, update, next);
        else if (kind === AWARENESS_UPDATE) {
          applyAwarenessUpdate(awareness, update, next);
          emitPeers();
        }
      } catch {
        // Ignore malformed updates.
      }
    };
    next.onerror = () => next.close();
    next.onclose = () => {
      if (socket !== next) return;
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
      send(frame(Y_UPDATE, update));
    }
  });
  awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown) => {
    if (origin === socket) {
      emitPeers();
      return;
    }
    const ids = [...added, ...updated, ...removed];
    if (ids.length) send(frame(AWARENESS_UPDATE, encodeAwarenessUpdate(awareness, ids)));
    emitPeers();
  });

  connect();

  return {
    doc,
    text,
    awareness,
    subscribeStatus: (callback) => {
      statusListeners.add(callback);
      callback(status);
      return () => statusListeners.delete(callback);
    },
    subscribeSaveStatus: (callback) => {
      saveListeners.add(callback);
      callback("saved");
      return () => saveListeners.delete(callback);
    },
    subscribePeers: (callback) => {
      peerListeners.add(callback);
      emitPeers();
      return () => peerListeners.delete(callback);
    },
    applyServerContent: (content: string) => {
      const current = text.toString();
      if (current === content) return;
      doc.transact(() => {
        text.delete(0, current.length);
        if (content) text.insert(0, content);
      }, socket);
    },
    destroy: () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
      statusListeners.clear();
      saveListeners.clear();
      peerListeners.clear();
      awareness.destroy();
      doc.destroy();
    },
  };
}

export const COLLAB_COLORS = ["#f8c84a", "#51d2ad", "#6ea8fe", "#f08787", "#c39af5", "#f5b45f"];

export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return COLLAB_COLORS[Math.abs(hash) % COLLAB_COLORS.length];
}
