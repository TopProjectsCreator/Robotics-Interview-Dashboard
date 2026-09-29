import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatParasolidViewer } from "./ChatParasolidViewer";

vi.mock("@google/model-viewer", () => ({}));
vi.mock("./ChatProgressiveGlbViewer", () => ({
  ChatProgressiveGlbViewer: ({ name }: { name: string }) => (
    <div data-testid="chat-progressive-glb-attachment">{name}</div>
  ),
}));

const NativeURL = globalThis.URL;
let requests: { url: string; init?: RequestInit }[] = [];
let fetchMock: ReturnType<typeof vi.fn>;

function installBrowserObjectUrlMock() {
  class TestURL extends NativeURL {}
  Object.defineProperties(TestURL, {
    createObjectURL: { configurable: true, value: vi.fn(() => "blob:converted-preview") },
    revokeObjectURL: { configurable: true, value: vi.fn() },
  });
  vi.stubGlobal("URL", TestURL);
}

function installFetchMock(
  previewResponse: Response | (() => Response) = () => new Response(new Blob(["glb"]), { status: 200 }),
  sourceResponse: () => Response = () =>
    new Response(new Blob(["private model bytes"], { type: "model/x-parasolid" }), { status: 200 }),
) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === "blob:original-model") {
      return sourceResponse();
    }
    if (url.includes("api/storage/parasolid-preview")) {
      return typeof previewResponse === "function" ? previewResponse() : previewResponse;
    }
    return new Response(null, { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  requests = [];
  installBrowserObjectUrlMock();
  installFetchMock();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ChatParasolidViewer", () => {
  it.each([
    ["assembly.x_t", "x-t"],
    ["assembly.x_b", "x-b"],
  ])("requests a private inline preview for %s", async (name, expectedFormat) => {
    render(<ChatParasolidViewer name={name} src="blob:original-model" />);

    await screen.findByTestId("chat-glb-attachment");
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].url).toContain("api/storage/parasolid-preview");
    expect(requests[1].init?.method).toBe("POST");
    expect(requests[1].init?.credentials).toBe("include");
    expect((requests[1].init?.headers as Record<string, string>)["X-Parasolid-Format"]).toBe(expectedFormat);
    expect(screen.getByRole("link", { name: "Download original Parasolid" })).toHaveAttribute("href", "blob:original-model");
  });

  it("sends a 173 MB X_T file through the private inline-preview route", async () => {
    const sourceBytes = 173 * 1024 * 1024;
    const sourceFile = new Blob(["private model bytes"], { type: "model/x-parasolid" });
    Object.defineProperty(sourceFile, "size", { value: sourceBytes });
    const sourceResponse = {
      ok: true,
      headers: new Headers({ "Content-Length": String(sourceBytes) }),
      blob: async () => sourceFile,
    } as Response;

    installFetchMock(
      () => new Response(JSON.stringify({
        previewId: "00000000-0000-4000-8000-000000000000",
        overviewBytes: 4096,
        detailBytes: 1024,
        triangles: 12,
        tiles: [{
          id: "g0",
          bytes: 1024,
          triangles: 12,
          center: [0, 0, 0],
          radius: 1,
        }],
      }), { status: 200, headers: { "Content-Type": "application/json" } }),
      () => sourceResponse,
    );
    render(<ChatParasolidViewer name="large-assembly.x_t" src="blob:original-model" />);

    await screen.findByTestId("chat-progressive-glb-attachment");
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].init?.body).toBe(sourceFile);
    expect((requests[1].init?.headers as Record<string, string>)["X-Parasolid-Format"]).toBe("x-t");
  });

  it("keeps the 50 MB preview limit for X_B files", async () => {
    const sourceBytes = 51 * 1024 * 1024;
    const sourceResponse = {
      ok: true,
      headers: new Headers({ "Content-Length": String(sourceBytes) }),
      blob: async () => new Blob(["private model bytes"], { type: "model/x-parasolid" }),
    } as Response;
    installFetchMock(undefined, () => sourceResponse);
    render(<ChatParasolidViewer name="large-assembly.x_b" src="blob:original-model" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("50 MB");
    expect(requests).toHaveLength(1);
  });

  it("keeps the original download and lets the user retry after a conversion error", async () => {
    let attempts = 0;
    installFetchMock(() => attempts++ === 0
      ? new Response(
          JSON.stringify({ error: "This Parasolid model could not be converted for inline preview." }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        )
      : new Response(new Blob(["glb"]), { status: 200 }),
    );
    render(<ChatParasolidViewer name="assembly.x_t" src="blob:original-model" />);

    expect(await screen.findByRole("alert")).toHaveTextContent("could not be converted");
    expect(screen.getByRole("link", { name: "Download CAD file" })).toHaveAttribute("href", "blob:original-model");
    fireEvent.click(screen.getByRole("button", { name: "Try preview again" }));
    await screen.findByTestId("chat-glb-attachment");
    expect(attempts).toBe(2);
  });
});