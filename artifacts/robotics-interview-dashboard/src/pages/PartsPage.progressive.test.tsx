import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeSearch: vi.fn(),
  createItem: vi.fn(),
  identifyImage: vi.fn(),
  sessionTeams: new WeakMap<object, string>(),
  teamInventory: new Map<string, Array<Record<string, unknown>>>(),
}));

let mediaDevicesDescriptor: PropertyDescriptor | undefined;

const testVendor = {
  key: "andymark",
  name: "AndyMark",
  group: "General Parts",
  website: "https://www.andymark.com",
  catalogMode: "products",
  catalogSourceUrl: "https://www.andymark.com",
  coverageState: "discovery_only",
  lastSync: null,
};

const testPriceSnapshot = {
  id: "detail-quote-1",
  partId: "team-a-detail-part",
  vendorKey: "andymark",
  vendorName: "AndyMark",
  sourceUrl: "https://www.andymark.com/products/precision-bracket",
  unitPrice: 14.75,
  currency: "USD",
  capturedAt: "2026-01-15T00:00:00.000Z",
  isStartingAt: true,
  isStale: true,
};

vi.mock("@workspace/api-client-react", async () => {
  const { useQuery, useQueryClient } =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  const getTeamId = () => mocks.sessionTeams.get(useQueryClient()) ?? "team-a";
  return {
    consumePartsCatalogSearchStream: mocks.consumeSearch,
    getGetPartsDashboardQueryKey: () => ["/parts/dashboard"],
    getGetPartsCatalogDetailsQueryKey: (partId: string) => ["/parts/catalog/details", partId],
    getListPartsCatalogQueryKey: () => ["/parts/catalog"],
    useIdentifyPartsImage: () => ({ mutateAsync: mocks.identifyImage, isPending: false }),
    useCreatePartsCatalogItem: () => {
      const teamId = getTeamId();
      return {
        mutateAsync: async (input: { data: Record<string, unknown> }) => {
          const result = await mocks.createItem(input);
          const items = mocks.teamInventory.get(teamId) ?? [];
          const quantityOwned = Number(input.data.quantityOwned);
          mocks.teamInventory.set(teamId, [
            ...items,
            {
              id: `${teamId}-part-${items.length + 1}`,
              vendorKey: input.data.vendorKey,
              vendorName: testVendor.name,
              name: input.data.name,
              sku: input.data.sku,
              category: input.data.category,
              description: input.data.description,
              productUrl: input.data.productUrl,
              imageUrl: input.data.imageUrl,
              storageLocation: null,
              inventoryNotes: null,
              quantityOwned,
              quantityAssigned: 0,
              quantityAvailable: quantityOwned,
              allocations: [],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ]);
          return result;
        },
        isPending: false,
      };
    },
    useCreatePartsRobot: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useGetPartsCatalogDetails: (partId: string, options?: {
      query?: Record<string, unknown> & { queryKey?: readonly unknown[] };
    }) => {
      const teamId = getTeamId();
      return useQuery({
        queryKey: options?.query?.queryKey ?? ["/parts/catalog", partId, "details"],
        queryFn: async () => {
          const items = mocks.teamInventory.get(teamId) ?? [];
          const item = items.find((candidate) => candidate.id === partId);
          if (!item) throw new Error("Catalog item not found.");
          return {
            item,
            priceSnapshots: [testPriceSnapshot],
            locations: [...new Set(items
              .map((candidate) => candidate.storageLocation)
              .filter((location): location is string => typeof location === "string" && Boolean(location)))],
          };
        },
        ...options?.query,
      });
    },
    useGetPartsDashboard: (options?: {
      query?: Record<string, unknown>;
    }) => {
      const teamId = getTeamId();
      return useQuery({
        queryKey: ["/parts/dashboard"],
        queryFn: async () => {
          const items = mocks.teamInventory.get(teamId) ?? [];
          const ownedUnits = items.reduce(
            (total, item) => total + Number(item.quantityOwned ?? 0),
            0,
          );
          return {
            vendors: [testVendor],
            robots: [],
            summary: {
              vendorCount: 1,
              catalogItems: items.length,
              ownedUnits,
              assignedUnits: 0,
              availableUnits: ownedUnits,
            },
          };
        },
        ...options?.query,
      });
    },
    useListPartsCatalog: (
      params: {
        manualOnly?: boolean;
        search?: string;
        vendorKey?: string;
        limit?: number;
        offset?: number;
      },
      options?: { query?: Record<string, unknown> & { queryKey?: readonly unknown[] } },
    ) => {
      const teamId = getTeamId();
      return useQuery({
        queryKey: options?.query?.queryKey ?? ["/parts/catalog", params],
        queryFn: async () => {
          const allItems = mocks.teamInventory.get(teamId) ?? [];
          const items = allItems.filter((item) =>
            (!params.vendorKey || item.vendorKey === params.vendorKey) &&
            (!params.search || String(item.name).toLowerCase().includes(params.search.toLowerCase())),
          );
          const offset = params.offset ?? 0;
          const limit = params.limit ?? items.length;
          return { items: items.slice(offset, offset + limit), total: items.length };
        },
        ...options?.query,
      });
    },
    useSetPartsRobotAllocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useSyncPartsCatalog: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdatePartsCatalogStock: () => ({ mutateAsync: vi.fn(), isPending: false }),
    useUpdatePartsCatalogDetails: () => {
      const teamId = getTeamId();
      return {
        mutateAsync: async ({ partId, data }: { partId: string; data: Record<string, unknown> }) => {
          const items = mocks.teamInventory.get(teamId) ?? [];
          const updated = items.map((item) => item.id === partId ? { ...item, ...data } : item);
          mocks.teamInventory.set(teamId, updated);
          const item = updated.find((candidate) => candidate.id === partId);
          if (!item) throw new Error("Catalog item not found.");
          return {
            item,
            priceSnapshots: [testPriceSnapshot],
            locations: [...new Set(updated
              .map((candidate) => candidate.storageLocation)
              .filter((location): location is string => typeof location === "string" && Boolean(location)))],
          };
        },
        isPending: false,
      };
    },
  };
});

vi.mock("@/components/PartsRobotDetailsDialog", () => ({
  PartsRobotDetailsDialog: () => null,
}));

import PartsPage from "./PartsPage";

const earlyProduct = {
  vendorKey: "andymark",
  vendorName: "AndyMark",
  title: "Early result part",
  url: "https://www.andymark.com/products/early-result-part",
  description: "A verified part returned before search completion.",
  sku: "EARLY-1",
  imageUrl: null,
  price: null,
  currency: null,
  priceIsStartingAt: false,
  inStock: true,
};

async function renderPartsPage(teamId = "team-a") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  mocks.sessionTeams.set(queryClient, teamId);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <Router>
        <PartsPage />
      </Router>
    </QueryClientProvider>,
  );
  fireEvent.click(within(view.container).getByRole("button", { name: "Find parts" }));
  await within(view.container).findByRole("tab", { name: "Supplier catalog" });
  return { ...view, queryClient };
}

function startSearch(query = "early result") {
  fireEvent.change(screen.getByRole("textbox", { name: "Part, SKU, or material" }), {
    target: { value: query },
  });
  const input = screen.getByRole("textbox", { name: "Part, SKU, or material" });
  const form = input.closest("form");
  if (!form) throw new Error("Search form was not found.");
  fireEvent.submit(form);
}

afterEach(() => {
  vi.clearAllMocks();
  if (mediaDevicesDescriptor) {
    Object.defineProperty(navigator, "mediaDevices", mediaDevicesDescriptor);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
});

describe("progressive Parts search", () => {
  beforeEach(() => {
    mediaDevicesDescriptor = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
    const track = {
      stop: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as MediaStreamTrack;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [track],
          getVideoTracks: () => [track],
        }),
      },
    });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D & GPUCanvasContext);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0x42])], { type: "image/jpeg" }));
    });
    Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, value: 640 });
    Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, value: 480 });
    mocks.teamInventory.clear();
    mocks.teamInventory.set("team-a", []);
    mocks.teamInventory.set("team-b", []);
    mocks.createItem.mockResolvedValue({});
    mocks.identifyImage.mockResolvedValue({
      identified: true,
      name: "Camera suggested bracket",
      category: "Structure",
      description: "A visible robotics bracket.",
      sku: null,
      uncertainty: "medium",
      uncertaintyReason: "The exact bracket version is unclear.",
    });
  });

  it("lets a user save a verified result before the stream completes", async () => {
    let finishSearch!: () => void;
    const waitingForCompletion = new Promise<void>((resolve) => {
      finishSearch = resolve;
    });
    mocks.consumeSearch.mockImplementation(async (_params, onEvent) => {
      await onEvent({ type: "result", result: earlyProduct });
      await waitingForCompletion;
      await onEvent({
        type: "complete",
        status: "available",
        providerCount: 2,
        failedProviderCount: 0,
        resultCount: 1,
      });
    });

    await renderPartsPage();
    startSearch();

    const saveButton = await screen.findByRole("button", { name: "Save to inventory" });
    expect(screen.getByText("Searching across 19 suppliers…")).toBeInTheDocument();
    expect(screen.queryByText(/Search complete/)).not.toBeInTheDocument();

    fireEvent.click(saveButton);
    await waitFor(() => expect(mocks.createItem).toHaveBeenCalledWith({
      data: {
        vendorKey: "andymark",
        name: "Early result part",
        sku: "EARLY-1",
        description: "A verified part returned before search completion.",
        productUrl: "https://www.andymark.com/products/early-result-part",
        imageUrl: null,
        quantityOwned: 0,
      },
    }));
    expect(await screen.findByText("Saved to inventory.")).toBeInTheDocument();
    expect(screen.queryByText(/Search complete/)).not.toBeInTheDocument();

    await act(async () => {
      finishSearch();
    });
    expect(await screen.findByText(/Search complete\. 1 verified live product group/)).toBeInTheDocument();
  });

  it("communicates partial provider failure without removing found results", async () => {
    mocks.consumeSearch.mockImplementation(async (_params, onEvent) => {
      await onEvent({ type: "result", result: earlyProduct });
      await onEvent({
        type: "complete",
        status: "partial",
        providerCount: 4,
        failedProviderCount: 1,
        resultCount: 1,
      });
    });

    await renderPartsPage();
    startSearch();

    expect(await screen.findByText("Early result part")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "partial supplier coverage: 1 of 4 discovery providers failed",
    );
    expect(screen.getByRole("status")).toHaveTextContent("partial supplier coverage");
  });

  it("communicates when every live provider fails", async () => {
    mocks.consumeSearch.mockImplementation(async (_params, onEvent) => {
      await onEvent({
        type: "complete",
        status: "unavailable",
        providerCount: 4,
        failedProviderCount: 4,
        resultCount: 0,
      });
    });

    await renderPartsPage();
    startSearch("total outage");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "all 4 of 4 discovery providers were unavailable",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Search complete, but live supplier discovery did not return results",
    );
    expect(screen.queryByText("No matching supplier products or indexed catalog records were found.")).not.toBeInTheDocument();
  });

  it("keeps early results and reports partial coverage if the stream closes early", async () => {
    mocks.consumeSearch.mockImplementation(async (_params, onEvent) => {
      await onEvent({ type: "result", result: earlyProduct });
      throw new Error("connection interrupted");
    });

    await renderPartsPage();
    startSearch("connection drop");

    expect(await screen.findByText("Early result part")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Supplier search ended before completion",
    );
    expect(screen.getByRole("status")).toHaveTextContent("partial supplier coverage");
  });

  it("ignores results and completion events from an older search", async () => {
    let releaseOldSearch!: () => void;
    const waitingForOldSearch = new Promise<void>((resolve) => {
      releaseOldSearch = resolve;
    });
    const staleProduct = {
      ...earlyProduct,
      title: "Stale result",
      sku: "STALE-1",
      url: "https://www.andymark.com/products/stale-result",
    };
    const currentProduct = {
      ...earlyProduct,
      title: "Current result",
      sku: "CURRENT-1",
      url: "https://www.andymark.com/products/current-result",
    };
    mocks.consumeSearch.mockImplementation(async ({ q }, onEvent) => {
      if (q === "older search") {
        await waitingForOldSearch;
        await onEvent({ type: "result", result: staleProduct });
        await onEvent({
          type: "complete",
          status: "available",
          providerCount: 2,
          failedProviderCount: 0,
          resultCount: 1,
        });
        return;
      }
      await onEvent({ type: "result", result: currentProduct });
      await onEvent({
        type: "complete",
        status: "available",
        providerCount: 2,
        failedProviderCount: 0,
        resultCount: 1,
      });
    });

    await renderPartsPage();
    startSearch("older search");
    await waitFor(() => expect(mocks.consumeSearch).toHaveBeenCalledTimes(1));

    const input = screen.getByRole("textbox", { name: "Part, SKU, or material" });
    fireEvent.change(input, { target: { value: "current search" } });
    const form = input.closest("form");
    if (!form) throw new Error("Search form was not found.");
    fireEvent.submit(form);

    expect(await screen.findByText("Current result")).toBeInTheDocument();
    await act(async () => {
      releaseOldSearch();
    });
    expect(screen.queryByText("Stale result")).not.toBeInTheDocument();
    expect(screen.getByText("Current result")).toBeInTheDocument();
  });

  it("saves reviewed camera details through the Parts catalog path and refreshes inventory totals", async () => {
    const { queryClient } = await renderPartsPage();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(screen.getByRole("tab", { name: "Inventory" }));
    fireEvent.click(await screen.findByRole("button", { name: "Scan with camera" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Capture and identify" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Capture and identify" }));
    await screen.findByDisplayValue("Camera suggested bracket");
    expect(mocks.createItem).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Part name *"), { target: { value: "Reviewed bracket" } });
    fireEvent.change(screen.getByLabelText("Supplier *"), { target: { value: "andymark" } });
    fireEvent.change(screen.getByLabelText("Owned quantity *"), { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed part" }));

    await waitFor(() => expect(mocks.createItem).toHaveBeenCalledWith({
      data: {
        vendorKey: "andymark",
        name: "Reviewed bracket",
        sku: null,
        category: "Structure",
        description: "A visible robotics bracket.",
        productUrl: null,
        imageUrl: null,
        quantityOwned: 3,
      },
    }));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/parts/dashboard"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["/parts/catalog"] });
    expect(await screen.findByText("Reviewed bracket added to inventory.")).toBeInTheDocument();
  });

  it("shows a camera-added part and updated totals to a teammate without reloading, while keeping other teams separate", async () => {
    mocks.teamInventory.set("team-b", [{
      id: "team-b-private-part",
      vendorKey: "andymark",
      vendorName: "AndyMark",
      name: "Team B private bracket",
      sku: "TEAM-B-1",
      category: "Structure",
      description: "Belongs to another team.",
      productUrl: null,
      imageUrl: null,
      storageLocation: null,
      inventoryNotes: null,
      quantityOwned: 8,
      quantityAssigned: 0,
      quantityAvailable: 8,
      allocations: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);

    const writer = await renderPartsPage("team-a");
    const teammate = await renderPartsPage("team-a");
    const otherTeam = await renderPartsPage("team-b");
    for (const session of [writer, teammate, otherTeam]) {
      fireEvent.click(within(session.container).getByRole("tab", { name: "Inventory" }));
    }

    await within(otherTeam.container).findByText("Team B private bracket");
    expect(within(writer.container).queryByText("Team B private bracket")).not.toBeInTheDocument();
    expect(within(teammate.container).queryByText("Team B private bracket")).not.toBeInTheDocument();

    fireEvent.click(within(writer.container).getByRole("button", { name: "Scan with camera" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Capture and identify" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Capture and identify" }));
    await screen.findByDisplayValue("Camera suggested bracket");
    fireEvent.change(screen.getByLabelText("Part name *"), {
      target: { value: "Photo-added team bracket" },
    });
    fireEvent.change(screen.getByLabelText("Supplier *"), {
      target: { value: "andymark" },
    });
    fireEvent.change(screen.getByLabelText("Owned quantity *"), {
      target: { value: "3" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save reviewed part" }));

    await within(writer.container).findByText("Photo-added team bracket");
    await within(teammate.container).findByText("Photo-added team bracket", {}, { timeout: 10_000 });
    await waitFor(() => {
      const totals = within(teammate.container).getByLabelText("Parts totals");
      expect(within(totals).getByText("Catalog items").parentElement).toHaveTextContent("1");
      expect(within(totals).getByText("Owned units").parentElement).toHaveTextContent("3");
    }, { timeout: 10_000 });

    expect(within(teammate.container).getByText("1 shown of 1 saved item(s)")).toBeInTheDocument();
    expect(within(otherTeam.container).queryByText("Photo-added team bracket")).not.toBeInTheDocument();
    expect(within(otherTeam.container).queryByText("Team B private bracket")).toBeInTheDocument();
  }, 15_000);

  it("opens part details, saves inventory fields separately, and reloads the persisted values", async () => {
    mocks.teamInventory.set("team-a", [{
      id: "team-a-detail-part",
      vendorKey: "andymark",
      vendorName: "AndyMark",
      name: "Precision bracket",
      sku: "PREC-42",
      category: "Structure",
      description: "Supplier description for the bracket.",
      productUrl: "https://www.andymark.com/products/precision-bracket",
      imageUrl: "https://images.example.test/bracket.png",
      storageLocation: null,
      inventoryNotes: null,
      unitCost: 12.5,
      costCurrency: "USD",
      quantityOwned: 4,
      quantityAssigned: 1,
      quantityAvailable: 3,
      allocations: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);

    const firstPage = await renderPartsPage("team-a");
    fireEvent.click(within(firstPage.container).getByRole("tab", { name: "Inventory" }));
    expect(within(firstPage.container).getByLabelText("Owned stock for Precision bracket")).toHaveValue(4);
    fireEvent.click(await screen.findByRole("button", { name: "Open details for Precision bracket" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await screen.findByLabelText("Storage location");
    const firstDialog = within(screen.getByRole("dialog"));
    expect(firstDialog.getByText("Supplier description for the bracket.")).toBeInTheDocument();
    expect(firstDialog.getByText(/Stale quote/)).toBeInTheDocument();
    expect(firstDialog.getByText(/starting at/)).toBeInTheDocument();
    expect(firstDialog.getByText(/Current saved cost:/)).toHaveTextContent("12.50");
    expect(firstDialog.getByText(/Current saved cost:/)).not.toHaveTextContent("14.75");
    expect(screen.getByRole("spinbutton", { name: "Saved unit cost" })).toHaveValue(12.5);
    expect(screen.getByRole("textbox", { name: "Saved cost currency" })).toHaveValue("USD");
    fireEvent.change(screen.getByLabelText("Storage location"), {
      target: { value: "Shelf A" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Inventory notes" }), {
      target: { value: "Keep with the spare fasteners." },
    });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Saved unit cost" }), {
      target: { value: "13.25" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Saved cost currency" }), {
      target: { value: "CAD" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Product image URL" }), {
      target: { value: "https://images.example.test/bracket-v2.png" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save details" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Part details saved."));
    const saved = mocks.teamInventory.get("team-a")?.[0];
    expect(saved).toMatchObject({
      storageLocation: "Shelf A",
      inventoryNotes: "Keep with the spare fasteners.",
      unitCost: 13.25,
      costCurrency: "CAD",
      imageUrl: "https://images.example.test/bracket-v2.png",
      description: "Supplier description for the bracket.",
      quantityOwned: 4,
    });

    firstPage.unmount();
    const reloadedPage = await renderPartsPage("team-a");
    fireEvent.click(within(reloadedPage.container).getByRole("tab", { name: "Inventory" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open details for Precision bracket" }));
    const reloadedDialog = within(await screen.findByRole("dialog"));
    expect(await screen.findByDisplayValue("Shelf A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep with the spare fasteners.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("13.25")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CAD")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://images.example.test/bracket-v2.png")).toBeInTheDocument();
    expect(reloadedDialog.getByText("Supplier description for the bracket.")).toBeInTheDocument();
  });
});
