import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { strToU8, zipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspaceFileViewer } from "./WorkspaceFileViewer";

vi.mock("./ChatGlbViewer", () => ({
  ChatGlbViewer: ({ name }: { name: string }) => <div data-testid="chat-glb-preview">{name}</div>,
}));
vi.mock("./ChatParasolidViewer", () => ({
  ChatParasolidViewer: ({ name }: { name: string }) => <div data-testid="chat-parasolid-preview">{name}</div>,
}));
vi.mock("./ChatStlViewer", () => ({
  ChatStlViewer: ({ name }: { name: string }) => <div data-testid="chat-stl-preview">{name}</div>,
}));
vi.mock("./ChatStepViewer", () => ({
  ChatStepViewer: ({ name }: { name: string }) => <div data-testid="chat-step-preview">{name}</div>,
}));
vi.mock("./CadMeshViewer", () => ({
  CadMeshViewer: ({ name }: { name: string }) => <div data-testid="cad-mesh-preview">{name}</div>,
}));
vi.mock("./CadThreeMfViewer", () => ({
  CadThreeMfViewer: ({ name }: { name: string }) => <div data-testid="cad-3mf-preview">{name}</div>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const previewCases = [
  { name: "notes.txt", contentType: "text/plain", preview: '[data-testid="text-attachment-preview"]' },
  { name: "photo.png", contentType: "image/png", preview: 'img[alt="photo.png"]' },
  { name: "agenda.ics", contentType: "text/calendar", preview: '[data-testid="ical-viewer"]' },
  { name: "report.pdf", contentType: "application/pdf", preview: 'iframe[title="report.pdf"]' },
  { name: "clip.mp4", contentType: "video/mp4", preview: "video" },
  { name: "voice.mp3", contentType: "audio/mpeg", preview: "audio" },
  { name: "robot.glb", contentType: "model/gltf-binary", preview: '[data-testid="chat-glb-preview"]' },
  { name: "assembly.x_t", contentType: "model/x-parasolid", preview: '[data-testid="chat-parasolid-preview"]' },
] as const;

describe("workspace attachment downloads", () => {
  it.each(previewCases)("$name stays downloadable alongside its preview", async ({ name, contentType, preview }) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(contentType === "application/pdf" ? "%PDF-1.4\nfixture" : name, {
          status: 200,
          headers: { "content-type": contentType },
        }),
      ),
    );
    const { container } = render(<WorkspaceFileViewer name={name} src={`/api/storage/objects/${name}`} />);

    await waitFor(() => expect(container.querySelector(preview)).not.toBeNull());
    const download = await screen.findByRole("button", { name: `Download ${name}` });
    expect(download).toHaveAttribute("type", "button");
  });

  it("does not start downloading when the viewer mounts; clicking the action downloads the original blob", async () => {
    const clickedAnchors: HTMLAnchorElement[] = [];
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchors.push(this);
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("original document bytes", { status: 200, headers: { "content-type": "text/plain" } })),
    );
    const { container } = render(<WorkspaceFileViewer name="notes.txt" src="/api/storage/objects/notes.txt" />);

    expect(await screen.findByTestId("text-attachment-preview")).toHaveTextContent("original document bytes");
    expect(container.querySelector('a[download]')).not.toBeInTheDocument();
    expect(clickSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Download notes.txt" }));

    expect(clickSpy).toHaveBeenCalledOnce();
    expect(clickedAnchors[0]?.download).toBe("notes.txt");
    expect(clickedAnchors[0]?.href).toMatch(/^blob:/);
  });

  it("does not embed unknown Office binaries in an iframe on mount or source change", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const legacyWordHeader = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(legacyWordHeader, { status: 200, headers: { "content-type": "application/octet-stream" } })),
    );
    const { container, rerender } = render(
      <WorkspaceFileViewer name="office-object-id" src="/api/storage/objects/office-object-id" />,
    );

    expect(await screen.findByTestId("unsupported-document-preview")).toHaveTextContent("preview unavailable");
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download office-object-id" })).toBeInTheDocument();
    expect(clickSpy).not.toHaveBeenCalled();

    rerender(
      <WorkspaceFileViewer name="next-office-object-id" src="/api/storage/objects/next-office-object-id" />,
    );

    expect(await screen.findByRole("button", { name: "Download next-office-object-id" })).toBeInTheDocument();
    expect(screen.getByTestId("unsupported-document-preview")).toHaveTextContent("next-office-object-id");
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("does not iframe Word bytes when the storage response incorrectly claims PDF", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const legacyWordHeader = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(legacyWordHeader, { status: 200, headers: { "content-type": "application/pdf" } })),
    );
    const { container } = render(
      <WorkspaceFileViewer name="8cf4a1a2-1e3d-4bc4-a0d9-3ed97570e61c" src="/api/storage/objects/8cf4a1a2-1e3d-4bc4-a0d9-3ed97570e61c" />,
    );

    expect(await screen.findByTestId("unsupported-document-preview")).toHaveTextContent("preview unavailable");
    expect(container.querySelector("iframe")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download 8cf4a1a2-1e3d-4bc4-a0d9-3ed97570e61c" })).toBeInTheDocument();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("keeps the archive and an extracted text member downloadable", async () => {
    const archive = zipSync({ "notes/readme.txt": strToU8("Archive notes") });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(archive, { status: 200, headers: { "content-type": "application/zip" } })),
    );
    render(<WorkspaceFileViewer name="bundle.zip" src="/api/storage/objects/bundle.zip" />);

    await screen.findByTestId("chat-archive-preview");
    expect(screen.getByRole("button", { name: "Download bundle.zip" })).toHaveAttribute("type", "button");
    fireEvent.click(screen.getByTestId("chat-archive-entry-notes/readme.txt"));
    expect(await screen.findByText("Archive notes")).toBeInTheDocument();

    const memberDownload = screen.getByRole("link", { name: "Download readme.txt" });
    expect(memberDownload).toHaveAttribute("download", "readme.txt");
    expect(memberDownload).toHaveAttribute("href", expect.stringMatching(/^blob:/));
  });
});
