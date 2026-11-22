import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
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
      vi.fn(async () => new Response(name, { status: 200, headers: { "content-type": contentType } })),
    );
    const { container } = render(<WorkspaceFileViewer name={name} src={`/api/storage/objects/${name}`} />);

    await waitFor(() => expect(container.querySelector(preview)).not.toBeNull());
    const download = await screen.findByRole("link", { name: `Download ${name}` });
    expect(download).toHaveAttribute("download", name);
    expect(download).toHaveAttribute("href", expect.stringMatching(/^blob:/));
  });

  it("keeps the archive and an extracted text member downloadable", async () => {
    const archive = zipSync({ "notes/readme.txt": strToU8("Archive notes") });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(archive, { status: 200, headers: { "content-type": "application/zip" } })),
    );
    render(<WorkspaceFileViewer name="bundle.zip" src="/api/storage/objects/bundle.zip" />);

    await screen.findByTestId("chat-archive-preview");
    expect(screen.getByRole("link", { name: "Download bundle.zip" })).toHaveAttribute("download", "bundle.zip");
    fireEvent.click(screen.getByTestId("chat-archive-entry-notes/readme.txt"));
    expect(await screen.findByText("Archive notes")).toBeInTheDocument();

    const memberDownload = screen.getByRole("link", { name: "Download readme.txt" });
    expect(memberDownload).toHaveAttribute("download", "readme.txt");
    expect(memberDownload).toHaveAttribute("href", expect.stringMatching(/^blob:/));
  });
});
