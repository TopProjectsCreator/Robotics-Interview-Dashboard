import * as fs from "fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { CadStorageStatus } from "@workspace/api-client-react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CadWorkspacePage } from "./CadWorkspacePage";

const mocks = vi.hoisted(() => ({
  listLibrary: vi.fn(),
  getCadStorageStatus: vi.fn(),
  createBot: vi.fn(),
  updateBot: vi.fn(),
  deleteBot: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  createModel: vi.fn(),
  updateModel: vi.fn(),
  deleteModel: vi.fn(),
  uploadModelFile: vi.fn(),
  uploadChunked: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getListCadLibraryQueryKey: () => ["/api/cad/library"],
  getCadStorageStatus: mocks.getCadStorageStatus,
  useListCadLibrary: mocks.listLibrary,
  createCadBot: mocks.createBot,
  updateCadBot: mocks.updateBot,
  deleteCadBot: mocks.deleteBot,
  createCadFolder: mocks.createFolder,
  updateCadFolder: mocks.updateFolder,
  deleteCadFolder: mocks.deleteFolder,
  createCadModel: mocks.createModel,
  updateCadModel: mocks.updateModel,
  deleteCadModel: mocks.deleteModel,
  uploadCadModelFile: mocks.uploadModelFile,
}));

vi.mock("@/lib/chunkedUpload", () => ({
  shouldUseChunkedUpload: (size: number) => size > 1024,
  uploadChunked: mocks.uploadChunked,
}));

// The inline viewers pull in three.js and a WASM build; the page only needs to
// prove it picked the right one per format.
vi.mock("@/components/CadModelViewer", () => ({
  CadModelViewer: ({ name }: { name: string }) => (
    <div data-testid="cad-model-viewer">{name}</div>
  ),
  describeCadModel: (name: string) => ({ format: name.split(".").pop()?.toUpperCase(), hint: "" }),
}));

const bot = {
  id: "bot-1",
  name: "Scout",
  notes: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const intakeFolder = {
  id: "folder-intake",
  botId: bot.id,
  parentId: null,
  name: "Intake",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const chassisFolder = {
  id: "folder-chassis",
  botId: bot.id,
  // Nested under Intake, to prove subfolders render in the tree.
  parentId: intakeFolder.id,
  name: "Chassis",
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

function model(overrides: Record<string, unknown> = {}) {
  return {
    id: "model-1",
    name: "Arm bracket",
    fileName: "arm-bracket.step",
    contentType: "model/step",
    objectPath: "/objects/cad-12345678",
    sizeBytes: 2048,
    botId: bot.id,
    folderId: intakeFolder.id,
    notes: null,
    uploadedBy: "Ada",
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage(
  library = {
    bots: [bot],
    folders: [intakeFolder, chassisFolder],
    models: [model()],
  },
  // Annotated so the timestamps can be real values: without it TypeScript infers
  // the literal `null` from the default below and rejects any actual timestamp.
  cadStatus: CadStorageStatus = {
    usingBackupStorage: false,
    lastFailoverAt: null,
    lastRecoveryAt: null,
  },
  statusError?: Error,
  cachedCadStatus?: CadStorageStatus,
) {
  mocks.listLibrary.mockReturnValue({ data: library, isLoading: false });
  if (statusError) mocks.getCadStorageStatus.mockRejectedValue(statusError);
  else mocks.getCadStorageStatus.mockResolvedValue(cadStatus);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (cachedCadStatus) {
    queryClient.setQueryData(["/api/storage/cad-status"], cachedCadStatus);
  }
  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <CadWorkspacePage />
    </QueryClientProvider>,
  );
  return { ...rendered, queryClient };
}

function cadFile(name: string, size = 10): File {
  return new File([new Uint8Array(size)], name, { type: "application/octet-stream" });
}

/** Minimal DataTransfer stand-in; jsdom has no real implementation. */
function dropTarget(element: Element, data: Record<string, string>, files: File[] = []) {
  const transfer = {
    dataTransfer: {
      getData: (type: string) => data[type] ?? "",
      setData: () => undefined,
      types: Object.keys(data),
      files,
      dropEffect: "move",
      effectAllowed: "all",
    },
  };
  fireEvent.dragOver(element, transfer);
  fireEvent.drop(element, transfer);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createBot.mockResolvedValue(bot);
  mocks.createFolder.mockResolvedValue(intakeFolder);
  mocks.updateModel.mockResolvedValue(model());
  mocks.deleteModel.mockResolvedValue(undefined);
  mocks.createModel.mockResolvedValue(model({ id: "model-new" }));
  mocks.uploadModelFile.mockResolvedValue({
    objectPath: "/objects/cad-99999999",
    contentType: "model/3mf",
    sizeBytes: 10,
  });
  mocks.uploadChunked.mockResolvedValue("/objects/chunk/upload-1");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CAD workspace tree", () => {
  it("marks the library layout for desktop viewport fill while preserving natural page flow on small screens", () => {
    renderPage();

    expect(screen.getByTestId("cad-workspace-page")).toHaveClass("cad-workspace-page");
    expect(screen.getByTestId("cad-library-layout")).toHaveClass(
      "cad-library-layout",
      "lg:grid-cols-[290px_minmax(0,1fr)]",
    );
    expect(screen.getByTestId("cad-model-grid")).toHaveClass("cad-model-panel", "min-h-[420px]");
  });

  it("limits viewport sizing to taller desktops and keeps long CAD content scrollable", () => {
    const css = fs.readFileSync("src/index.css", "utf8");

    expect(css).toMatch(/@media \(min-width:\s*1024px\) and \(min-height:\s*700px\)/);
    expect(css).toMatch(/\.cad-workspace-shell\s*\{[^}]*height:\s*100dvh/s);
    expect(css).toMatch(/\.cad-workspace-main\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto/s);
    expect(css).toMatch(/\.cad-library-layout\s*\{[^}]*min-height:\s*0;[^}]*flex:\s*1 1 auto/s);
    expect(css).toMatch(/\.cad-library-sidebar,\s*\.cad-model-panel\s*\{[^}]*overflow-y:\s*auto/s);
  });

  it("shows the failover notice when the permitted admin receives backup status", async () => {
    renderPage(undefined, {
      usingBackupStorage: true,
      lastFailoverAt: "2026-10-15T10:00:00.000Z",
      lastRecoveryAt: null,
    });

    expect(await screen.findByTestId("cad-storage-failover")).toHaveTextContent(
      "CAD uploads are using backup storage",
    );
    expect(screen.getByTestId("cad-storage-failover")).toHaveTextContent(
      "New CAD files are being written to secondary storage",
    );
  });

  it("does not show the notice when the status request is denied", async () => {
    const failoverStatus = {
      usingBackupStorage: true,
      lastFailoverAt: "2026-10-15T10:00:00.000Z",
      lastRecoveryAt: null,
    };
    const { queryClient } = renderPage(
      undefined,
      failoverStatus,
      new Error("Forbidden"),
      failoverStatus,
    );

    await waitFor(() =>
      expect(queryClient.getQueryState(["/api/storage/cad-status"])?.status).toBe("error"),
    );
    expect(screen.queryByTestId("cad-storage-failover")).not.toBeInTheDocument();
  });

  it("does not show the notice when storage is healthy", async () => {
    renderPage();

    await waitFor(() => expect(mocks.getCadStorageStatus).toHaveBeenCalled());
    expect(screen.queryByTestId("cad-storage-failover")).not.toBeInTheDocument();
  });

  it("lists bots and renders nested folders", async () => {
    renderPage();
    expect(await screen.findByTestId("cad-bot-bot-1")).toHaveTextContent("Scout");
    expect(screen.getByTestId("cad-folder-folder-intake")).toHaveTextContent("Intake");
    // Chassis is nested under Intake, so it must appear without collapsing it.
    expect(screen.getByTestId("cad-folder-folder-chassis")).toHaveTextContent("Chassis");
  });

  it("shows only the models in the selected location", async () => {
    renderPage({
      bots: [bot],
      folders: [intakeFolder, chassisFolder],
      models: [
        model(),
        model({ id: "model-2", name: "Wheel", folderId: chassisFolder.id }),
        model({ id: "model-3", name: "Stray", fileName: "stray.glb", contentType: "model/gltf-binary", botId: null, folderId: null }),
      ],
    });

    // Intake includes nested models, so the wheel in Chassis shows up here too.
    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));
    expect(screen.getByTestId("cad-model-model-1")).toBeInTheDocument();
    expect(screen.getByTestId("cad-model-model-2")).toBeInTheDocument();
    // Parent badges count nested models, so Intake reads 2 and not 0.
    expect(screen.getByTestId("cad-folder-folder-intake")).toHaveTextContent("2");
    expect(screen.getByTestId("cad-bot-bot-1")).toHaveTextContent("2");

    fireEvent.click(screen.getByTestId("cad-folder-folder-chassis"));
    expect(screen.getByTestId("cad-model-model-2")).toBeInTheDocument();
    expect(screen.queryByTestId("cad-model-model-1")).not.toBeInTheDocument();

    // The bot view includes every model filed under it, at any depth.
    fireEvent.click(screen.getByTestId("cad-bot-bot-1"));
    expect(screen.getByTestId("cad-model-model-1")).toBeInTheDocument();
    expect(screen.getByTestId("cad-model-model-2")).toBeInTheDocument();
    expect(screen.queryByTestId("cad-model-model-3")).not.toBeInTheDocument();

    // Unfiled holds only the model with no bot or folder.
    fireEvent.click(screen.getByTestId("cad-location-unfiled"));
    expect(screen.getByTestId("cad-model-model-3")).toBeInTheDocument();
  });

  it("filters the visible models by name without changing the location", async () => {
    renderPage({
      bots: [bot],
      folders: [intakeFolder],
      models: [model(), model({ id: "model-2", name: "Wheel", folderId: intakeFolder.id })],
    });
    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));
    fireEvent.change(screen.getByTestId("cad-search"), { target: { value: "wheel" } });
    expect(screen.getByTestId("cad-model-model-2")).toBeInTheDocument();
    expect(screen.queryByTestId("cad-model-model-1")).not.toBeInTheDocument();
  });
});

describe("CAD workspace uploads", () => {
  it("uploads a dropped CAD file and records it in the active folder", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));

    dropTarget(screen.getByTestId("cad-model-grid"), {}, [cadFile("widget.3mf")]);

    await waitFor(() => {
      expect(mocks.uploadModelFile).toHaveBeenCalledTimes(1);
    });
    const [blob, params] = mocks.uploadModelFile.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(params.fileName).toBe("widget.3mf");
    // The extension decides the type, since browsers send octet-stream.
    expect(params.contentType).toBe("model/3mf");
    await waitFor(() => {
      expect(mocks.createModel).toHaveBeenCalledWith(
        expect.objectContaining({
          objectPath: "/objects/cad-99999999",
          fileName: "widget.3mf",
          botId: bot.id,
          folderId: intakeFolder.id,
        }),
      );
    });
  });

  it("refuses an unsupported file and says why", async () => {
    renderPage();
    dropTarget(screen.getByTestId("cad-model-grid"), {}, [cadFile("notes.exe")]);
    expect(await screen.findByTestId("cad-notice")).toHaveTextContent(/not a supported file/i);
    expect(mocks.uploadModelFile).not.toHaveBeenCalled();
    expect(mocks.createModel).not.toHaveBeenCalled();
  });

  it("uploads a reference file like chat attachments do", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));

    dropTarget(screen.getByTestId("cad-model-grid"), {}, [cadFile("notes.pdf")]);

    await waitFor(() => {
      expect(mocks.uploadModelFile).toHaveBeenCalledTimes(1);
    });
    const [blob, params] = mocks.uploadModelFile.mock.calls[0];
    expect(blob).toBeInstanceOf(Blob);
    expect(params.fileName).toBe("notes.pdf");
    expect(params.contentType).toBe("application/pdf");
  });

  it("streams a large file in parts instead of buffering it", async () => {
    renderPage();
    dropTarget(screen.getByTestId("cad-model-grid"), {}, [cadFile("huge.step", 4096)]);

    await waitFor(() => {
      expect(mocks.uploadChunked).toHaveBeenCalledTimes(1);
    });
    expect(mocks.uploadChunked.mock.calls[0][1]).toBe("huge.step");
    expect(mocks.uploadChunked.mock.calls[0][2]).toBe("model/step");
    expect(mocks.uploadModelFile).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mocks.createModel).toHaveBeenCalledWith(
        expect.objectContaining({ objectPath: "/objects/chunk/upload-1" }),
      );
    });
  });

  it("does not start a second batch while an upload is running", async () => {
    let releaseUpload: (value: unknown) => void = () => undefined;
    mocks.uploadModelFile.mockImplementation(
      () => new Promise((resolve) => { releaseUpload = resolve; }),
    );
    renderPage();

    dropTarget(screen.getByTestId("cad-model-grid"), {}, [cadFile("one.3mf")]);
    await waitFor(() => expect(mocks.uploadModelFile).toHaveBeenCalledTimes(1));

    dropTarget(screen.getByTestId("cad-model-grid"), {}, [cadFile("two.3mf")]);
    expect(mocks.uploadModelFile).toHaveBeenCalledTimes(1);

    releaseUpload({ objectPath: "/objects/cad-1", contentType: "model/3mf", sizeBytes: 10 });
  });
});

describe("CAD workspace drag and drop", () => {
  it("moves a model into a folder it is dropped on", async () => {
    renderPage();
    await screen.findByTestId("cad-folder-folder-chassis");

    dropTarget(
      document.querySelector('[data-drop-target="folder:folder-chassis"]')!,
      { "application/x-cad-model-id": "model-1" },
    );

    await waitFor(() => {
      expect(mocks.updateModel).toHaveBeenCalledWith("model-1", {
        botId: bot.id,
        folderId: chassisFolder.id,
      });
    });
    expect(mocks.createModel).not.toHaveBeenCalled();
    expect(mocks.uploadModelFile).not.toHaveBeenCalled();
  });

  it("sends a model dragged onto Unfiled back to the unfiled pile", async () => {
    renderPage();
    dropTarget(document.querySelector('[data-drop-target="unfiled"]')!, {
      "application/x-cad-model-id": "model-1",
    });
    await waitFor(() => {
      expect(mocks.updateModel).toHaveBeenCalledWith("model-1", {
        botId: null,
        folderId: null,
      });
    });
  });
});

describe("CAD workspace preview", () => {
  it("renders a supported format inline and offers the original download", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));
    fireEvent.click(await screen.findByLabelText("Preview Arm bracket"));

    const dialog = await screen.findByTestId("cad-preview-dialog");
    expect(within(dialog).getByTestId("cad-model-viewer")).toHaveTextContent("arm-bracket.step");
    const download = within(dialog).getByRole("link", { name: /download/i });
    expect(download).toHaveAttribute("href", "/api/storage/objects/cad-12345678");
  });

  it("lists nested folders as move targets in the preview", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));
    fireEvent.click(await screen.findByLabelText("Preview Arm bracket"));
    const select = await screen.findByTestId("cad-preview-location");
    const options = Array.from(select.querySelectorAll("option")).map((option) =>
      (option.textContent ?? "").trim(),
    );
    expect(options).toContain("Unfiled");
    expect(options).toContain("Scout (root)");
    // Subfolders are listed with their full path so a deep move target is
    // unambiguous.
    expect(options).toContain("Intake");
    expect(options).toContain("Intake / Chassis");
  });

  it("saves a rename through the preview dialog", async () => {
    renderPage();
    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));
    fireEvent.click(await screen.findByLabelText("Preview Arm bracket"));
    fireEvent.change(await screen.findByTestId("cad-preview-name"), {
      target: { value: "Arm bracket v2" },
    });
    fireEvent.click(screen.getByTestId("cad-preview-save"));

    await waitFor(() => {
      expect(mocks.updateModel).toHaveBeenCalledWith(
        "model-1",
        expect.objectContaining({ name: "Arm bracket v2" }),
      );
    });
  });
});

describe("CAD README preview", () => {
  function readme(
    id: string,
    folderId: string | null,
    fileName = "README.md",
    objectPath = `/objects/${id}`,
    botId: string | null = bot.id,
  ) {
    return model({
      id,
      name: fileName,
      fileName,
      contentType: "text/markdown",
      objectPath,
      sizeBytes: 128,
      botId,
      folderId,
    });
  }

  it("automatically renders a case-insensitive location README safely with theme styles", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        "# Build notes\n\nUse **M3 screws** and `threadlocker`.\n\n| Part | Count |\n| --- | ---: |\n| Spacer | 4 |\n\n<img src=x onerror=\"alert(1)\">\n\n[unsafe](javascript:alert(1))",
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPage({
      bots: [bot],
      folders: [intakeFolder, chassisFolder],
      models: [model(), readme("readme-intake", intakeFolder.id, "ReadMe.MD")],
    });

    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));

    const preview = await screen.findByTestId("cad-readme-preview");
    expect(await within(preview).findByRole("heading", { name: "Build notes" })).toBeInTheDocument();
    expect(preview).toHaveTextContent("M3 screws");
    expect(preview).toHaveTextContent("threadlocker");
    expect(within(preview).getByRole("table")).toBeInTheDocument();
    expect(preview).toHaveTextContent("Spacer");
    expect(preview.querySelector("img")).toBeNull();
    expect(within(preview).queryByRole("link", { name: "unsafe" })).not.toBeInTheDocument();
    expect(preview).toHaveClass("border-border", "bg-background", "text-foreground");
    expect(preview.querySelector(".dark\\:prose-invert")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/storage/objects/readme-intake",
      { credentials: "include" },
    );
  });

  it("does not fetch oversized READMEs and keeps the library-card download available", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPage({
      bots: [bot],
      folders: [intakeFolder],
      models: [
        readme("readme-large", intakeFolder.id, "README.md", "/objects/readme-large"),
      ].map((entry) => ({ ...entry, sizeBytes: 1024 * 1024 + 1 })),
    });

    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));

    expect(await screen.findByTestId("cad-readme-too-large")).toHaveTextContent(
      "larger than 1 MiB",
    );
    expect(screen.getByTestId("cad-readme-too-large")).toHaveTextContent(
      "Download it from its library card",
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Download README.md" })).toHaveAttribute(
      "href",
      "/api/storage/objects/readme-large",
    );
  });

  it("switches to the exact selected folder README and does not show unrelated locations", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      status: 200,
      text: async () => String(input).includes("readme-intake") ? "# Intake notes" : "# Chassis notes",
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage({
      bots: [bot],
      folders: [intakeFolder, chassisFolder],
      models: [
        readme("readme-intake", intakeFolder.id),
        readme("readme-chassis", chassisFolder.id),
      ],
    });

    expect(screen.queryByTestId("cad-readme-preview")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("cad-bot-bot-1"));
    expect(screen.queryByTestId("cad-readme-preview")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("cad-folder-folder-intake"));
    const preview = await screen.findByTestId("cad-readme-preview");
    expect(await within(preview).findByRole("heading", { name: "Intake notes" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/storage/objects/readme-intake");

    fireEvent.click(screen.getByTestId("cad-folder-folder-chassis"));
    const updatedPreview = await screen.findByTestId("cad-readme-preview");
    expect(await within(updatedPreview).findByRole("heading", { name: "Chassis notes" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/storage/objects/readme-chassis");
  });

  it("switches between bot-root READMEs without selecting a folder README", async () => {
    const secondBot = { ...bot, id: "bot-2", name: "Rover" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      status: 200,
      text: async () => String(input).includes("readme-scout") ? "# Scout root" : "# Rover root",
    }));
    vi.stubGlobal("fetch", fetchMock);
    renderPage({
      bots: [bot, secondBot],
      folders: [intakeFolder],
      models: [
        readme("readme-scout", null, "README.md", "/objects/readme-scout", bot.id),
        readme("readme-rover", null, "README.md", "/objects/readme-rover", secondBot.id),
        readme("readme-folder", intakeFolder.id),
      ],
    });

    fireEvent.click(await screen.findByTestId("cad-bot-bot-1"));
    expect(await screen.findByRole("heading", { name: "Scout root" })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("cad-bot-bot-2"));
    expect(await screen.findByRole("heading", { name: "Rover root" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/storage/objects/readme-scout",
      "/api/storage/objects/readme-rover",
    ]);
  });

  it("shows a loading state while the protected README request is pending", async () => {
    let finishFetch: ((response: { ok: boolean; status: number; text: () => Promise<string> }) => void) | undefined;
    const fetchMock = vi.fn(
      () => new Promise<{ ok: boolean; status: number; text: () => Promise<string> }>((resolve) => {
        finishFetch = resolve;
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    renderPage({
      bots: [bot],
      folders: [intakeFolder],
      models: [readme("readme-intake", intakeFolder.id)],
    });

    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));
    expect(await screen.findByTestId("cad-readme-loading")).toHaveTextContent("Loading README");
    finishFetch?.({ ok: true, status: 200, text: async () => "# Loaded" });
    expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();
  });

  it("shows a recoverable error and retries a failed protected README request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "# Back online" });
    vi.stubGlobal("fetch", fetchMock);
    renderPage({
      bots: [bot],
      folders: [intakeFolder],
      models: [readme("readme-intake", intakeFolder.id)],
    });

    fireEvent.click(await screen.findByTestId("cad-folder-folder-intake"));
    const retry = await screen.findByTestId("cad-readme-retry");
    expect(screen.getByTestId("cad-readme-error")).toHaveTextContent("README could not be loaded");
    fireEvent.click(retry);

    expect(await screen.findByRole("heading", { name: "Back online" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not render an empty README panel when the active location has no README", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    renderPage({
      bots: [bot],
      folders: [intakeFolder],
      models: [model(), readme("readme-intake", intakeFolder.id)],
    });

    expect(screen.queryByTestId("cad-readme-preview")).not.toBeInTheDocument();
    fireEvent.click(await screen.findByTestId("cad-bot-bot-1"));
    expect(screen.queryByTestId("cad-readme-preview")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
