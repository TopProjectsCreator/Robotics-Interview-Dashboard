import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CadWorkspacePage } from "./CadWorkspacePage";

const mocks = vi.hoisted(() => ({
  listLibrary: vi.fn(),
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

function renderPage(library = {
  bots: [bot],
  folders: [intakeFolder, chassisFolder],
  models: [model()],
}) {
  mocks.listLibrary.mockReturnValue({ data: library, isLoading: false });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CadWorkspacePage />
    </QueryClientProvider>,
  );
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

describe("CAD workspace tree", () => {
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
    dropTarget(screen.getByTestId("cad-model-grid"), {}, [cadFile("notes.pdf")]);
    expect(await screen.findByTestId("cad-notice")).toHaveTextContent(/not a supported CAD file/i);
    expect(mocks.uploadModelFile).not.toHaveBeenCalled();
    expect(mocks.createModel).not.toHaveBeenCalled();
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
