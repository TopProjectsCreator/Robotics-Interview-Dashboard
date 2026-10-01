import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhiteboardEditor } from "./WhiteboardEditor";
import { AUTH_TOKEN_STORAGE_KEY } from "../authSession";
import { excalidrawTestApi } from "../test-stubs/excalidraw";

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
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

  receive(data: string) {
    this.onmessage?.({ data } as MessageEvent);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
  MockWebSocket.instances = [];
});

function colorFromClass(element: HTMLElement, prefix: string, theme: "light" | "dark"): string {
  const themePrefix = theme === "dark" ? "dark:" : "";
  const colorClass = element.className
    .split(/\s+/)
    .find((name) => name.startsWith(`${themePrefix}${prefix}-[#`));
  const color = colorClass?.match(/\[#([0-9a-f]{6})\]$/i)?.[1];
  if (!color) throw new Error(`Expected a ${theme} ${prefix} color class`);
  return `#${color}`;
}

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255);
    const [red, green, blue] = channels.map((channel) => (
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    ));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe("WhiteboardEditor embed validation", () => {
  it("allows unlisted HTTP(S) hosts and rejects malformed or non-web URLs", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    const editor = screen.getByTestId("excalidraw-stub");
    expect(editor).toHaveAttribute("data-embed-valid-unlisted-http", "true");
    expect(editor).toHaveAttribute("data-embed-valid-unlisted-https", "true");
    expect(editor).toHaveAttribute("data-embed-invalid-malformed", "false");
    expect(editor).toHaveAttribute("data-embed-invalid-ftp", "false");
    expect(editor).toHaveAttribute("data-embed-invalid-javascript", "false");
  });

  it("explains that external websites may prohibit embedding", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.getByTestId("whiteboard-embed-policy-note")).toHaveTextContent(
      "Some websites prohibit iframe embedding.",
    );
    expect(screen.getByTestId("whiteboard-embed-policy-note")).toHaveTextContent(
      "security settings may be responsible",
    );
  });

  it("keeps the notice readable in light and dark themes and in normal mobile layout flow", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    const editor = screen.getByTestId("whiteboard-editor");
    const notice = screen.getByTestId("whiteboard-embed-policy-note");
    const canvasRegion = screen.getByTestId("whiteboard-canvas-region");

    expect(notice).toBeVisible();
    expect(notice).toHaveClass("flex-wrap", "leading-5");
    expect(notice).not.toHaveClass("absolute", "fixed");
    expect(editor.children[1]).toBe(notice);
    expect(editor.children[2]).toBe(canvasRegion);
    expect(editor).toHaveClass("flex-col");
    expect(canvasRegion).toHaveClass("min-h-0", "flex-1");
    expect(screen.getByTestId("whiteboard-actions")).toHaveClass("flex-wrap");

    for (const theme of ["light", "dark"] as const) {
      const foreground = colorFromClass(notice, "text", theme);
      const background = colorFromClass(notice, "bg", theme);
      expect(contrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps close, save, and share actions usable", () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    const data = JSON.stringify({ elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} });

    render(
      <WhiteboardEditor
        whiteboard={{ id: "", title: "Design review", data, createdBy: "interviewer", updatedAt: "" }}
        saving={false}
        error=""
        onClose={onClose}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByTestId("button-close-whiteboard"));
    fireEvent.click(screen.getByTestId("button-save-whiteboard"));
    fireEvent.click(screen.getByTestId("button-share-whiteboard"));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).toHaveBeenNthCalledWith(1, "Design review", expect.any(String), false);
    expect(onSave).toHaveBeenNthCalledWith(2, "Design review", expect.any(String), true);
  });

  it("offers a safe new-tab link only for a selected valid website embed", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    expect(screen.queryByTestId("link-open-embedded-site")).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId("button-select-test-embed"));

    const link = screen.getByTestId("link-open-embedded-site");
    expect(link).toHaveAttribute("href", "https://example.com/board");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not offer a new-tab link for an unsafe selected embed URL", () => {
    render(
      <WhiteboardEditor
        whiteboard={null}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId("button-select-invalid-test-embed"));

    expect(screen.queryByTestId("link-open-embedded-site")).not.toBeInTheDocument();
  });
});

describe("WhiteboardEditor collaboration session lifecycle", () => {
  it("closes on session expiry, ignores late scenes, and reconnects with a fresh session", () => {
    vi.stubGlobal("WebSocket", MockWebSocket);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "expired-session-token");
    const updateScene = vi.spyOn(excalidrawTestApi, "updateScene");
    const whiteboard = {
      id: "board-1",
      title: "Design review",
      data: JSON.stringify({ elements: [], appState: {}, files: {} }),
      createdBy: "interviewer",
      updatedAt: "",
    };
    const renderEditor = () => render(
      <WhiteboardEditor
        whiteboard={whiteboard}
        saving={false}
        error=""
        onClose={() => {}}
        onSave={() => {}}
      />,
    );
    const scene = (id: string) => JSON.stringify({
      type: "scene",
      data: JSON.stringify({
        elements: [{ id, type: "rectangle", version: 1, versionNonce: 1 }],
        appState: {},
        files: {},
      }),
    });

    const expiredEditor = renderEditor();
    const expiredSocket = MockWebSocket.instances[0];
    expiredSocket.open();
    expiredSocket.receive(scene("before-expiry"));
    expect(updateScene).toHaveBeenCalledOnce();

    updateScene.mockClear();
    expiredEditor.unmount();
    expect(expiredSocket.close).toHaveBeenCalledOnce();
    expiredSocket.receive(scene("late-update"));
    expect(updateScene).not.toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(1);

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "fresh-session-token");
    const freshEditor = renderEditor();
    const freshSocket = MockWebSocket.instances[1];
    expect(freshSocket.url).toContain("access_token=fresh-session-token");
    freshSocket.open();
    freshSocket.receive(scene("fresh-update"));
    expect(updateScene).toHaveBeenCalledOnce();
    freshEditor.unmount();
  });
});
