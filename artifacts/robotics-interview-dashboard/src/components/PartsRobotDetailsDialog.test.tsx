import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PartsRobotDetailsDialog } from "./PartsRobotDetailsDialog";

const mocks = vi.hoisted(() => ({
  getDetails: vi.fn(),
  uploadPreview: vi.fn(),
  updatePreview: vi.fn(),
  deletePreview: vi.fn(),
  updateCost: vi.fn(),
  createSnapshot: vi.fn(),
}));

vi.mock("@workspace/api-client-react", () => ({
  getGetPartsRobotDetailsQueryKey: (robotId: string) => ["/api/parts/robots", robotId, "details"],
  getListPartsCatalogQueryKey: () => ["/api/parts/catalog"],
  useGetPartsRobotDetails: mocks.getDetails,
  useUploadPartsRobotPreviewFile: () => ({ mutateAsync: mocks.uploadPreview, isPending: false }),
  useUpdatePartsRobotPreview: () => ({ mutateAsync: mocks.updatePreview, isPending: false }),
  useDeletePartsRobotPreview: () => ({ mutateAsync: mocks.deletePreview, isPending: false }),
  useUpdatePartsCatalogCost: () => ({ mutateAsync: mocks.updateCost, isPending: false }),
  useCreatePartsPriceSnapshot: () => ({ mutateAsync: mocks.createSnapshot, isPending: false }),
}));

const robot = {
  id: "robot-1",
  name: "Scout",
  preview: {
    objectPath: "/objects/preview-1234",
    fileName: "scout.png",
    contentType: "image/png",
  },
  createdAt: "2026-09-01T00:00:00.000Z",
  updatedAt: "2026-09-01T00:00:00.000Z",
};

const detail = {
  robot,
  parts: [
    {
      partId: "part-1",
      name: "Arm bracket",
      vendorKey: "vendor-a",
      vendorName: "Supplier A",
      sku: "AB-1",
      productUrl: "https://supplier.example.com/products/arm-bracket",
      quantity: 3,
      unitCost: 2.5,
      costCurrency: "USD",
      lineTotal: 7.5,
      priceSnapshots: [
        {
          id: "quote-1",
          partId: "part-1",
          vendorKey: "vendor-a",
          vendorName: "Supplier A",
          sourceUrl: "https://supplier.example.com/products/arm-bracket",
          unitPrice: 3,
          currency: "USD",
          capturedAt: "2026-07-01T00:00:00.000Z",
          isStartingAt: true,
          isStale: true,
        },
      ],
    },
    {
      partId: "part-2",
      name: "Sensor mount",
      vendorKey: "vendor-b",
      vendorName: "Supplier B",
      sku: null,
      productUrl: null,
      quantity: 1,
      unitCost: null,
      costCurrency: null,
      lineTotal: null,
      priceSnapshots: [],
    },
  ],
  subtotalsByCurrency: [{ currency: "USD", amount: 7.5 }],
  unpricedPartCount: 1,
};

function renderDialog(onClose = vi.fn(), onPreviewReplaced = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <PartsRobotDetailsDialog
          robot={robot}
          onClose={onClose}
          onPreviewReplaced={onPreviewReplaced}
        />
      </QueryClientProvider>,
    ),
    onClose,
    onPreviewReplaced,
  };
}

describe("PartsRobotDetailsDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getDetails.mockReturnValue({ data: detail, isLoading: false, isError: false });
    mocks.uploadPreview.mockResolvedValue({ objectPath: "/objects/new-preview-5678" });
    mocks.updatePreview.mockResolvedValue({});
    mocks.deletePreview.mockResolvedValue({});
    mocks.updateCost.mockResolvedValue({});
    mocks.createSnapshot.mockResolvedValue({});
  });

  it("shows currency subtotals, unknown costs, and quote provenance as estimates", () => {
    renderDialog();

    expect(screen.getByRole("dialog", { name: /Scout/ })).toBeInTheDocument();
    expect(screen.getByText("Quantity 3")).toBeInTheDocument();
    expect(screen.getByTestId("metric-saved-total-USD")).toHaveTextContent("7.5");
    expect(screen.getByTestId("status-unpriced-parts")).toHaveTextContent("1 part with unknown cost");
    expect(screen.getByTestId("text-saved-cost-part-2")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("text-line-total-part-2")).toHaveTextContent("Unknown");
    expect(screen.getByTestId("row-price-snapshot-quote-1")).toHaveTextContent("Stale estimate");
    expect(screen.getByTestId("row-price-snapshot-quote-1")).toHaveTextContent("Starting-at estimate");
    expect(screen.getByTestId("row-price-snapshot-quote-1")).toHaveTextContent("Supplier A");
    expect(screen.getByTestId("link-snapshot-source-quote-1")).toHaveAttribute(
      "href",
      "https://supplier.example.com/products/arm-bracket",
    );

    fireEvent.error(screen.getByTestId("img-robot-preview-robot-1"));
    expect(screen.getByTestId("error-robot-preview-image-robot-1")).toHaveTextContent(
      "This image could not be displayed.",
    );
    expect(screen.getByTestId("link-download-robot-preview-robot-1")).toHaveAttribute(
      "href",
      expect.stringContaining("/api/storage/objects/preview-1234"),
    );
  });

  it("saves part costs separately from supplier quote snapshots", async () => {
    renderDialog();

    const costInput = screen.getByTestId("input-saved-cost-part-1");
    fireEvent.change(costInput, { target: { value: "4.25" } });
    fireEvent.submit(screen.getByTestId("form-saved-cost-part-1"));
    await waitFor(() => expect(mocks.updateCost).toHaveBeenCalledWith({
      partId: "part-1",
      data: { unitCost: 4.25, costCurrency: "USD" },
    }));

    fireEvent.click(screen.getByTestId("button-toggle-quotes-part-1"));
    fireEvent.change(screen.getByTestId("input-quote-price-part-1"), { target: { value: "5.10" } });
    fireEvent.submit(screen.getByTestId("form-price-snapshot-part-1"));
    await waitFor(() => expect(mocks.createSnapshot).toHaveBeenCalledWith({
      partId: "part-1",
      data: {
        unitPrice: 5.1,
        currency: "USD",
        sourceUrl: "https://supplier.example.com/products/arm-bracket",
        isStartingAt: false,
      },
    }));
  });

  it("uploads a private replacement preview and closes on Escape", async () => {
    const { onClose, onPreviewReplaced } = renderDialog();
    const file = new File(["image"], "new-scout.png", { type: "image/png" });
    fireEvent.change(screen.getByTestId("input-robot-preview-file"), {
      target: { files: [file] },
    });
    fireEvent.submit(screen.getByTestId("form-upload-robot-preview"));

    await waitFor(() => expect(mocks.uploadPreview).toHaveBeenCalledWith({
      data: file,
      params: { fileName: "new-scout.png", contentType: "image/png" },
    }));
    expect(mocks.updatePreview).toHaveBeenCalledWith({
      robotId: "robot-1",
      data: {
        objectPath: "/objects/new-preview-5678",
        fileName: "new-scout.png",
        contentType: "image/png",
      },
    });
    expect(onPreviewReplaced).toHaveBeenCalled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("asks before removing a preview and refreshes robot details after success", async () => {
    const confirm = vi.fn().mockReturnValue(true);
    vi.stubGlobal("confirm", confirm);
    const { onPreviewReplaced } = renderDialog();

    fireEvent.click(screen.getByTestId("button-remove-robot-preview"));

    expect(confirm).toHaveBeenCalledWith(
      'Remove the preview from "Scout"? The robot and its part allocations will remain.',
    );
    await waitFor(() => expect(mocks.deletePreview).toHaveBeenCalledWith({ robotId: "robot-1" }));
    await waitFor(() => expect(onPreviewReplaced).toHaveBeenCalled());
    expect(screen.getByTestId("status-robot-preview")).toHaveTextContent("Preview removed.");

    vi.unstubAllGlobals();
  });

  it("does not remove a preview when the confirmation is cancelled", () => {
    vi.stubGlobal("confirm", vi.fn().mockReturnValue(false));
    renderDialog();

    fireEvent.click(screen.getByTestId("button-remove-robot-preview"));

    expect(mocks.deletePreview).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});