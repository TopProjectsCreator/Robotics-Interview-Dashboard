import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatParasolidViewer } from "./ChatParasolidViewer";

vi.mock("@google/model-viewer", () => ({}));

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
) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, init });
    if (url === "blob:original-model") {
      return new Response(new Blob(["private model bytes"], { type: "model/x-parasolid" }), { status: 200 });
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