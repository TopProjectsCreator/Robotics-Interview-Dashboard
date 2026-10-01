import * as Y from "yjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTH_TOKEN_STORAGE_KEY } from "../authSession";
import { createDocumentCollaboration } from "./documentCollaboration";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  binaryType: BinaryType = "blob";
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent("close"));
  });

  constructor(readonly url: string) {
    MockWebSocket.instances.push(this);
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event("open"));
  }

  receive(data: string | ArrayBuffer) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

function encodedDocumentUpdate(doc: Y.Doc): ArrayBuffer {
  const update = Y.encodeStateAsUpdate(doc);
  const packet = new Uint8Array(update.byteLength + 1);
  packet[0] = 1;
  packet.set(update, 1);
  return packet.buffer;
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  MockWebSocket.instances = [];
});

describe("document collaboration session lifecycle", () => {
  it("closes on session expiry, ignores late document updates, and opens for a fresh session", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "expired-session-token");
    const expiredSession = createDocumentCollaboration("document-1", JSON.stringify({ kind: "document" }), {
      name: "Interviewer",
      color: "#16869a",
    });
    const expiredSocket = MockWebSocket.instances[0];
    expiredSocket.open();

    const remoteDoc = new Y.Doc();
    remoteDoc.getText("content").insert(0, "before expiry");
    expiredSocket.receive(encodedDocumentUpdate(remoteDoc));
    expect(expiredSession.doc.getText("content").toString()).toBe("before expiry");

    expiredSession.destroy();
    expect(expiredSocket.close).toHaveBeenCalledOnce();
    remoteDoc.getText("content").insert(remoteDoc.getText("content").length, " - stale");
    expiredSocket.receive(encodedDocumentUpdate(remoteDoc));
    expect(expiredSession.doc.getText("content").toString()).toBe("before expiry");
    expect(MockWebSocket.instances).toHaveLength(1);

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "fresh-session-token");
    const freshSession = createDocumentCollaboration("document-1", JSON.stringify({ kind: "document" }), {
      name: "Interviewer",
      color: "#16869a",
    });
    const freshSocket = MockWebSocket.instances[1];
    expect(freshSocket.url).toContain("access_token=fresh-session-token");
    freshSocket.open();
    const freshRemoteDoc = new Y.Doc();
    freshRemoteDoc.getText("content").insert(0, "fresh update");
    freshSocket.receive(encodedDocumentUpdate(freshRemoteDoc));
    expect(freshSession.doc.getText("content").toString()).toBe("fresh update");

    freshSession.destroy();
    remoteDoc.destroy();
    freshRemoteDoc.destroy();
  });
});