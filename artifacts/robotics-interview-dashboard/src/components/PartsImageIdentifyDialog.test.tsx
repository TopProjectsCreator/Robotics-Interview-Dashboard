import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identify: vi.fn(),
  save: vi.fn(),
  onOpenChange: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  useIdentifyPartsImage: () => ({ mutateAsync: mocks.identify, isPending: false }),
}));

import { PartsImageIdentifyDialog } from "./PartsImageIdentifyDialog";

const vendors = [{
  key: "andymark",
  name: "AndyMark",
  group: "General Parts",
  website: "https://www.andymark.com",
  catalogMode: "products",
  catalogSourceUrl: "https://www.andymark.com",
  coverageState: "discovery_only",
  lastSync: null,
}] as const;

const identifiedPart = {
  identified: true,
  name: "Aluminum channel",
  category: "Structure",
  description: "Extruded aluminum profile.",
  sku: "CH-42",
  uncertainty: "medium",
  uncertaintyReason: "The exact profile series is not visible.",
};

function renderDialog() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <PartsImageIdentifyDialog
        open
        onOpenChange={mocks.onOpenChange}
        vendors={[...vendors]}
        saving={false}
        onSave={mocks.save}
      />
    </QueryClientProvider>,
  );
}

function choosePng() {
  const file = new File([new Uint8Array([1, 2, 3, 4])], "part.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Upload a part photo"), { target: { files: [file] } });
  return file;
}

beforeEach(() => {
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:part-preview") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });
  mocks.identify.mockResolvedValue(identifiedPart);
  mocks.save.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Parts image identification review", () => {
  it("previews the selected photo and only saves edited fields after explicit confirmation", async () => {
    renderDialog();
    choosePng();
    expect(await screen.findByAltText("Selected part photo: part.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Identify part" }));
    await screen.findByDisplayValue("Aluminum channel");
    expect(mocks.identify).toHaveBeenCalledWith({
      data: { contentType: "image/png", imageBase64: "AQIDBA==" },
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(screen.getByText(/Visual suggestion · medium uncertainty/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Part name *"), { target: { value: "Edited channel" } });
    fireEvent.change(screen.getByLabelText("Supplier *"), { target: { value: "andymark" } });
    fireEvent.change(screen.getByLabelText("Owned quantity *"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed part" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      name: "Edited channel",
      vendorKey: "andymark",
      sku: "CH-42",
      category: "Structure",
      description: "Extruded aluminum profile.",
      quantityOwned: 6,
    }));
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("keeps the photo visible while a user switches an unclear result to manual entry", async () => {
    mocks.identify.mockResolvedValue({
      identified: false,
      name: "",
      category: null,
      description: null,
      sku: null,
      uncertainty: "high",
      uncertaintyReason: "The photo is too blurry.",
    });
    renderDialog();
    choosePng();
    fireEvent.click(screen.getByRole("button", { name: "Identify part" }));

    expect(await screen.findByText("The photo is unclear")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continue in manual entry" }));
    expect(await screen.findByText("Manual part details")).toBeInTheDocument();
    expect(screen.getByAltText("Selected part photo: part.png")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Part name *"), { target: { value: "Hand-entered bracket" } });
    fireEvent.change(screen.getByLabelText("Supplier *"), { target: { value: "andymark" } });
    fireEvent.change(screen.getByLabelText("Owned quantity *"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed part" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      name: "Hand-entered bracket",
      vendorKey: "andymark",
      sku: "",
      category: "",
      description: "",
      quantityOwned: 2,
    }));
  });

  it("keeps the photo available while manually recovering from a recognition service error", async () => {
    mocks.identify.mockRejectedValue(new Error("Vision service unavailable"));
    renderDialog();
    choosePng();
    fireEvent.click(screen.getByRole("button", { name: "Identify part" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Vision service unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Continue in manual entry" }));
    expect(await screen.findByText("Manual part details")).toBeInTheDocument();
    expect(screen.getByAltText("Selected part photo: part.png")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("shows a service error, preserves the preview for retry, and offers manual entry", async () => {
    mocks.identify.mockRejectedValue(new Error("Vision service unavailable"));
    renderDialog();
    choosePng();
    fireEvent.click(screen.getByRole("button", { name: "Identify part" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Vision service unavailable");
    expect(screen.getByAltText("Selected part photo: part.png")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry identification" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue in manual entry" })).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("rejects unsupported and oversized files before sending them to recognition", async () => {
    renderDialog();
    const unsupported = new File(["gif"], "part.gif", { type: "image/gif" });
    fireEvent.change(screen.getByLabelText("Upload a part photo"), { target: { files: [unsupported] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose a JPEG, PNG, or WebP image");
    expect(mocks.identify).not.toHaveBeenCalled();

    const oversized = new File([new Uint8Array(3 * 1024 * 1024 + 1)], "large.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload a part photo"), { target: { files: [oversized] } });
    expect(await screen.findByRole("alert")).toHaveTextContent("smaller than 3 MiB");
    expect(mocks.identify).not.toHaveBeenCalled();
  });
});
