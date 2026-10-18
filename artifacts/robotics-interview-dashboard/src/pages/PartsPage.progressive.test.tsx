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

vi.mock("@workspace/api-client-react", async () => {
  const { useQuery, useQueryClient } =
    await vi.importActual<typeof import("@tanstack/react-query")>("@tanstack/react-query");
  const getTeamId = () => mocks.sessionTeams.get(useQueryClient()) ?? "team-a";
  return {
    consumePartsCatalogSearchStream: mocks.consumeSearch,
    getGetPartsDashboardQueryKey: () => ["/parts/dashboard"],
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
});

describe("progressive Parts search", () => {
  beforeEach(() => {
    mocks.teamInventory.clear();
    mocks.teamInventory.set("team-a", []);
    mocks.teamInventory.set("team-b", []);
    mocks.createItem.mockResolvedValue({});
    mocks.identifyImage.mockResolvedValue({
      identified: true,
      name: "Photo suggested bracket",
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

  it("saves reviewed photo details through the Parts catalog path and refreshes inventory totals", async () => {
    const { queryClient } = await renderPartsPage();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    fireEvent.click(screen.getByRole("tab", { name: "Inventory" }));
    fireEvent.click(await screen.findByRole("button", { name: "Identify from photo" }));

    const file = new File([new Uint8Array([1, 2, 3])], "bracket.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload a part photo"), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Identify part" }));
    await screen.findByDisplayValue("Photo suggested bracket");
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

  it("shows a photo-added part and updated totals to a teammate without reloading, while keeping other teams separate", async () => {
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

    fireEvent.click(within(writer.container).getByRole("button", { name: "Identify from photo" }));
    const file = new File([new Uint8Array([1, 2, 3])], "bracket.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload a part photo"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Identify part" }));
    await screen.findByDisplayValue("Photo suggested bracket");
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
});
