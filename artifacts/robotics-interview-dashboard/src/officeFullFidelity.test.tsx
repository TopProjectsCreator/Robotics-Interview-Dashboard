import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceFileViewer } from "./components/WorkspaceFileViewer";
import { fullFidelityOfficeKind, isOfficePreviewAttachment } from "./lib/officePreview";
import { officeAttachmentFixtures } from "./test-fixtures/officeAttachments";

const mocks = vi.hoisted(() => ({
  pptxPreviewRendered: vi.fn(),
  wordViewerCreated: vi.fn(),
  presentationViewerRendered: vi.fn(),
  failPptx: false,
}));

vi.mock("pptx-preview", () => ({
  init: (dom: HTMLElement) => ({
    preview: async () => {
      if (mocks.failPptx) throw new Error("PPTX renderer unavailable");
      mocks.pptxPreviewRendered(dom);
      const slide = document.createElement("div");
      slide.className = "pptx-preview-slide-wrapper";
      slide.textContent = "Full fidelity slide";
      dom.append(slide);
    },
  }),
}));

vi.mock("@extend-ai/react-docx/vanilla", () => ({
  createDocxViewer: (container: Element, options: { fileName?: string }) => {
    mocks.wordViewerCreated(options);
    const page = document.createElement("div");
    page.textContent = `Full fidelity page for ${options.fileName ?? "document"}`;
    container.append(page);
    let listener: ((controller: { hasDocument?: boolean; error?: Error }) => void) | undefined;
    queueMicrotask(() => listener?.({ hasDocument: true }));
    return {
      destroy: () => undefined,
      subscribe: (callback: (controller: { hasDocument?: boolean; error?: Error }) => void) => {
        listener = callback;
        return () => undefined;
      },
    };
  },
}));

vi.mock("@extend-ai/react-pptx", () => ({
  ReactPptxViewer: (props: { onReady?: () => void }) => {
    mocks.presentationViewerRendered(props);
    queueMicrotask(() => props.onReady?.());
    return null;
  },
}));

function fixtureFor(name: string) {
  const fixture = officeAttachmentFixtures.find((entry) => entry.name === name);
  if (!fixture) throw new Error(`Missing fixture ${name}`);
  return fixture;
}

async function serve(fixture: ReturnType<typeof fixtureFor>) {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(await fixture.body.arrayBuffer(), {
      status: 200,
      headers: { "content-type": fixture.contentType },
    }),
  );
}

beforeEach(() => {
  // The WASM viewers require a real browser environment; jsdom deliberately
  // lacks Worker, so the tests opt in explicitly.
  vi.stubGlobal("Worker", class MockWorker {});
  mocks.failPptx = false;
  mocks.pptxPreviewRendered.mockClear();
  mocks.wordViewerCreated.mockClear();
  mocks.presentationViewerRendered.mockClear();
  delete window.officeParser;
  vi.stubGlobal("fetch", vi.fn(async () => new Response("unexpected", { status: 500 })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("full-fidelity Office format selection", () => {
  it("routes PPTX to pptx-preview and keeps the download button", async () => {
    await serve(fixtureFor("deck-modern.pptx"));
    const { container } = render(<WorkspaceFileViewer name="deck-modern.pptx" src="/api/storage/objects/deck" />);

    const preview = await screen.findByTestId("pptx-preview", undefined, { timeout: 15_000 });
    await waitFor(() => expect(preview).toHaveTextContent("Full fidelity slide"));
    expect(mocks.pptxPreviewRendered).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="text-attachment-preview"]')).not.toBeInTheDocument();
    expect(screen.getByTestId("workspace-attachment-download")).toHaveTextContent("Download deck-modern.pptx");
  });

  it("falls back to readable text when the PPTX renderer throws", async () => {
    mocks.failPptx = true;
    window.officeParser = {
      parseOffice: vi.fn(async () => ({ toMarkdown: () => "Recovered PPTX outline" })),
    };
    await serve(fixtureFor("deck-modern.pptx"));
    render(<WorkspaceFileViewer name="bad.pptx" src="/api/storage/objects/bad" />);

    const preview = await screen.findByTestId("text-attachment-preview", undefined, { timeout: 15_000 });
    expect(preview).toHaveTextContent("Recovered PPTX outline");
    expect(window.officeParser?.parseOffice).toHaveBeenCalled();
  });

  it("shows the download card when both PPTX rendering and text extraction fail", async () => {
    mocks.failPptx = true;
    window.officeParser = { parseOffice: vi.fn().mockRejectedValue(new Error("Not an Office file")) };
    await serve(fixtureFor("deck-modern.pptx"));
    render(<WorkspaceFileViewer name="bad.pptx" src="/api/storage/objects/bad" />);

    const alert = await screen.findByRole("alert", undefined, { timeout: 15_000 });
    expect(alert).toHaveTextContent("Couldn’t preview bad.pptx");
    expect(screen.getByTestId("workspace-attachment-download")).toBeInTheDocument();
  });

  it.each(["legacy.doc", "notes.odt"])("renders %s with the WASM Word viewer", async (name) => {
    await serve(fixtureFor(name));
    const { container } = render(<WorkspaceFileViewer name={name} src="/api/storage/objects/word" />);

    const preview = await screen.findByTestId("office-word-preview", undefined, { timeout: 15_000 });
    await waitFor(() => expect(preview).toHaveTextContent(`Full fidelity page for ${name}`));
    expect(mocks.wordViewerCreated).toHaveBeenCalledWith(expect.objectContaining({ fileName: name }));
    expect(container.querySelector('[data-testid="text-attachment-preview"]')).not.toBeInTheDocument();
  });

  it.each(["deck.ppt", "slides.odp"])("renders %s with the WASM presentation viewer", async (name) => {
    await serve(fixtureFor(name));
    const { container } = render(<WorkspaceFileViewer name={name} src="/api/storage/objects/slides" />);

    expect(await screen.findByTestId("presentation-preview", undefined, { timeout: 15_000 })).toBeInTheDocument();
    await waitFor(() => expect(mocks.presentationViewerRendered).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="text-attachment-preview"]')).not.toBeInTheDocument();
  });

  it("renders ODS through the spreadsheet table renderer instead of the text parser", async () => {
    await serve(fixtureFor("scores.ods"));
    render(<WorkspaceFileViewer name="scores.ods" src="/api/storage/objects/sheet" />);

    const table = await screen.findByRole("table", undefined, { timeout: 15_000 });
    expect(table).toHaveTextContent("Readable Office fixture");
    expect(screen.queryByTestId("text-attachment-preview")).not.toBeInTheDocument();
  });

  it("keeps extension-less presentation bytes on the text fallback", () => {
    const mime = fixtureFor("slides-without-extension").contentType;
    expect(isOfficePreviewAttachment("slides-without-extension", mime)).toBe(true);
    expect(fullFidelityOfficeKind("slides-without-extension")).toBeNull();
  });

  it("excludes full-fidelity formats from the text path", () => {
    expect(fullFidelityOfficeKind("brief.pptx")).toBe("pptx");
    expect(fullFidelityOfficeKind("brief.ppt")).toBe("presentation");
    expect(fullFidelityOfficeKind("brief.odp")).toBe("presentation");
    expect(fullFidelityOfficeKind("notes.doc")).toBe("word");
    expect(fullFidelityOfficeKind("notes.odt")).toBe("word");
    expect(fullFidelityOfficeKind("scores.ods")).toBe("spreadsheet");
    for (const name of ["brief.pptx", "brief.ppt", "brief.odp", "notes.doc", "notes.odt", "scores.ods"]) {
      expect(isOfficePreviewAttachment(name, "application/octet-stream")).toBe(false);
    }
  });
});
