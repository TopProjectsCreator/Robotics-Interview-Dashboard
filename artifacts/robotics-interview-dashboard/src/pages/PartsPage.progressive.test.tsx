import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeSearch: vi.fn(),
  createItem: vi.fn(),
  getDetails: vi.fn(),
  identifyImage: vi.fn(),
  dashboardVendors: null as Array<Record<string, unknown>> | null,
  sessionTeams: new WeakMap<object, string>(),
  teamInventory: new Map<string, Array<Record<string, unknown>>>(),
  teamRobots: new Map<string, Array<Record<string, unknown>>>(),
  blockedVendors: new Map<string, Set<string>>(),
  blockVendor: vi.fn(),
  createRobot: vi.fn(),
  setAllocation: vi.fn(),
  syncCatalogs: vi.fn(),
  role: "coordinator" as string,
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
  blocked: false,
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
    getGetPartsVendorBlocksQueryKey: () => ["/parts/vendors/blocks"],
    getGetSessionQueryKey: () => ["/auth/session"],
    getGetPartsCatalogDetailsQueryKey: (partId: string) => ["/parts/catalog/details", partId],
    getListPartsCatalogQueryKey: () => ["/parts/catalog"],
    useIdentifyPartsImage: () => ({ mutateAsync: mocks.identifyImage, isPending: false }),
    useGetSession: () => ({ data: { role: mocks.role } }),
    useUpdatePartsVendorBlock: () => {
      const teamId = getTeamId();
      return {
        mutateAsync: async ({ vendorKey, data }: {
          vendorKey: string;
          data: { blocked: boolean };
        }) => {
          const result = await mocks.blockVendor({ vendorKey, data });
          const blocked = new Set(mocks.blockedVendors.get(teamId) ?? []);
          if (data.blocked) blocked.add(vendorKey);
          else blocked.delete(vendorKey);
          mocks.blockedVendors.set(teamId, blocked);
          return result;
        },
        isPending: false,
      };
    },
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
    useCreatePartsRobot: () => {
      const teamId = getTeamId();
      return {
        mutateAsync: async ({ data }: { data: { name: string } }) => {
          const result = await mocks.createRobot({ data });
          const robots = mocks.teamRobots.get(teamId) ?? [];
          mocks.teamRobots.set(teamId, [
            ...robots,
            { id: `${teamId}-robot-${robots.length + 1}`, name: data.name },
          ]);
          return result;
        },
        isPending: false,
      };
    },
    useGetPartsCatalogDetails: (partId: string, options?: {
      query?: Record<string, unknown> & { queryKey?: readonly unknown[] };
    }) => {
      const teamId = getTeamId();
      return useQuery({
        queryKey: options?.query?.queryKey ?? ["/parts/catalog", partId, "details"],
        queryFn: () => mocks.getDetails(partId, teamId),
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
          const assignedUnits = items.reduce(
            (total, item) => total + Number(item.quantityAssigned ?? 0),
            0,
          );
          return {
            vendors: (mocks.dashboardVendors ?? [testVendor]).map((vendor) => ({
              ...vendor,
              blocked: mocks.blockedVendors.get(teamId)?.has(String(vendor.key)) ?? false,
            })),
            robots: mocks.teamRobots.get(teamId) ?? [],
            summary: {
              vendorCount: 1,
              catalogItems: items.length,
              ownedUnits,
              assignedUnits,
              availableUnits: Math.max(0, ownedUnits - assignedUnits),
            },
          };
        },
        ...options?.query,
      });
    },
    useListPartsCatalog: (
      params: {
        manualOnly?: boolean;
        inventoryOnly?: boolean;
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
            (!params.inventoryOnly ||
              item.isManual !== false ||
              Number(item.quantityOwned ?? 0) > 0 ||
              Number(item.quantityAssigned ?? 0) > 0) &&
            (!params.manualOnly || item.isManual !== false) &&
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
    useSetPartsRobotAllocation: () => {
      const teamId = getTeamId();
      return {
        mutateAsync: async ({ robotId, partId, data }: {
          robotId: string;
          partId: string;
          data: { quantity: number };
        }) => {
          const result = await mocks.setAllocation({ robotId, partId, data });
          const robots = mocks.teamRobots.get(teamId) ?? [];
          const robot = robots.find((item) => item.id === robotId);
          const items = mocks.teamInventory.get(teamId) ?? [];
          mocks.teamInventory.set(teamId, items.map((item) => {
            if (item.id !== partId) return item;
            const allocations = (item.allocations as Array<Record<string, unknown>> ?? [])
              .filter((allocation) => allocation.robotId !== robotId);
            if (data.quantity > 0) {
              allocations.push({
                robotId,
                robotName: robot?.name ?? "Robot",
                quantity: data.quantity,
              });
            }
            const quantityAssigned = allocations.reduce(
              (total, allocation) => total + Number(allocation.quantity ?? 0),
              0,
            );
            return {
              ...item,
              allocations,
              quantityAssigned,
              quantityAvailable: Math.max(0, Number(item.quantityOwned ?? 0) - quantityAssigned),
            };
          }));
          return result;
        },
        isPending: false,
      };
    },
    useSyncPartsCatalog: () => ({ mutateAsync: mocks.syncCatalogs, isPending: false }),
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

async function loadMockPartDetails(partId: string, teamId: string) {
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
}

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

async function renderPartsPage(teamId = "team-a", initialView: "stockroom" | "find" | "builds" = "find") {
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
  await within(view.container).findByRole("tab", { name: "Stockroom" });
  if (initialView !== "stockroom") {
    fireEvent.click(within(view.container).getByRole("tab", {
      name: initialView === "find" ? "Find parts" : "Robot builds",
    }));
  }
  return { ...view, queryClient };
}

function openSupplierCoverage(container: HTMLElement) {
  fireEvent.click(within(container).getByTestId("button-toggle-parts-source-coverage"));
  fireEvent.click(within(container).getByTestId("button-show-parts-source-coverage"));
}

function openStockTotals(container: HTMLElement) {
  const trigger = within(container).getByTestId("button-toggle-parts-totals");
  if (trigger.getAttribute("aria-expanded") !== "true") fireEvent.click(trigger);
  return within(container).getByLabelText("Parts totals");
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
  mocks.dashboardVendors = null;
  mocks.blockedVendors.clear();
  mocks.teamRobots.clear();
  mocks.role = "coordinator";
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
    mocks.teamRobots.clear();
    mocks.teamRobots.set("team-a", []);
    mocks.teamRobots.set("team-b", []);
    mocks.blockedVendors.clear();
    mocks.role = "coordinator";
    mocks.getDetails.mockReset().mockImplementation(loadMockPartDetails);
    mocks.createItem.mockResolvedValue({});
    mocks.createRobot.mockResolvedValue({});
    mocks.setAllocation.mockResolvedValue({});
    mocks.syncCatalogs.mockResolvedValue({
      vendors: [{ status: "synced", vendorName: "AndyMark" }],
      totalItems: 1,
      created: 1,
      updated: 0,
    });
    window.localStorage.removeItem("robotics-parts-order-draft-v1");
    mocks.blockVendor.mockResolvedValue({});
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

  it("shows approximate crawl time only for incomplete supplier pagination", async () => {
    const lastSync = (status: string, remainingPages: number, etaSeconds: number) => ({
      status,
      checkedAt: "2026-10-28T12:00:00.000Z",
      itemCount: 120,
      source: "https://www.gobilda.com/xmlsitemap.php?type=products&page=1",
      message: status === "incomplete"
        ? `Product sitemap enumerated; ${remainingPages} pages still to crawl.`
        : "Supplier check complete.",
      remainingPages,
      estimatedSecondsRemaining: etaSeconds,
    });
    mocks.dashboardVendors = [
      {
        ...testVendor,
        key: "gobilda",
        name: "goBILDA",
        coverageState: "feed_sync_required",
        lastSync: lastSync("incomplete", 53, 3_660),
      },
      {
        ...testVendor,
        key: "andymark",
        name: "AndyMark",
        lastSync: lastSync("synced", 53, 3_660),
      },
      {
        ...testVendor,
        key: "servocity",
        name: "ServoCity",
        lastSync: lastSync("unavailable", 53, 3_660),
      },
      {
        ...testVendor,
        key: "optii",
        name: "Optii",
        lastSync: null,
      },
    ];

    const page = await renderPartsPage();
    openSupplierCoverage(page.container);
    expect(
      await within(page.container).findByTestId("status-parts-source-eta-gobilda"),
    ).toHaveTextContent(
      "Approximate completion estimate: about 1 hour 1 minute. Supplier response times and other crawls can affect it.",
    );
    expect(within(page.container).getByTestId("card-parts-source-gobilda"))
      .toHaveTextContent("53 pages still to crawl");
    expect(within(page.container).queryByTestId("status-parts-source-eta-andymark"))
      .not.toBeInTheDocument();
    expect(within(page.container).queryByTestId("status-parts-source-eta-servocity"))
      .not.toBeInTheDocument();
    expect(within(page.container).queryByTestId("status-parts-source-eta-optii"))
      .not.toBeInTheDocument();

    mocks.dashboardVendors = [
      {
        ...mocks.dashboardVendors[0],
        lastSync: lastSync("incomplete", 58, 640),
      },
      ...mocks.dashboardVendors.slice(1),
    ];
    await act(async () => {
      await page.queryClient.invalidateQueries({ queryKey: ["/parts/dashboard"] });
    });
    await waitFor(() => {
      expect(within(page.container).getByTestId("status-parts-source-eta-gobilda"))
        .toHaveTextContent("Approximate completion estimate: about 11 minutes.");
      expect(within(page.container).getByTestId("card-parts-source-gobilda"))
        .toHaveTextContent("58 pages still to crawl");
    });
  });

  it("lets admins block and restore suppliers from supplier status", async () => {
    mocks.dashboardVendors = [
      testVendor,
      {
        ...testVendor,
        key: "ferra",
        name: "Ferra",
        website: "https://ferracomponents.com",
        catalogSourceUrl: "https://ferracomponents.com/products.json",
      },
    ];
    const page = await renderPartsPage();
    openSupplierCoverage(page.container);

    fireEvent.click(within(page.container).getByTestId("button-parts-vendor-block-andymark"));
    await waitFor(() => {
      expect(mocks.blockVendor).toHaveBeenCalledWith({
        vendorKey: "andymark",
        data: { blocked: true },
      });
    });
    expect(await within(page.container).findByTestId("button-parts-vendor-unblock-andymark"))
      .toHaveTextContent("Unblock supplier");
    expect(within(page.container).getByTestId("card-parts-source-andymark"))
      .toHaveTextContent("Blocked for this team");

    fireEvent.click(within(page.container).getByTestId("button-parts-vendor-unblock-andymark"));
    await waitFor(() => {
      expect(mocks.blockVendor).toHaveBeenLastCalledWith({
        vendorKey: "andymark",
        data: { blocked: false },
      });
    });
    expect(await within(page.container).findByTestId("button-parts-vendor-block-andymark"))
      .toHaveTextContent("Block supplier");
  });

  it("shows blocked supplier state without management controls to team members", async () => {
    mocks.role = "interviewer";
    mocks.blockedVendors.set("team-a", new Set(["andymark"]));
    const page = await renderPartsPage();
    openSupplierCoverage(page.container);

    expect(within(page.container).getByTestId("card-parts-source-andymark"))
      .toHaveTextContent("Blocked for this team");
    expect(within(page.container).queryByTestId("button-parts-vendor-unblock-andymark"))
      .not.toBeInTheDocument();
  });

  it("keeps blocked suppliers available for inventory filtering but not new catalog entries", async () => {
    mocks.blockedVendors.set("team-a", new Set(["andymark"]));
    const page = await renderPartsPage();
    fireEvent.click(within(page.container).getByRole("tab", { name: "Stockroom" }));

    const inventoryFilter = within(page.container).getByLabelText("Filter supplier");
    expect(within(inventoryFilter).getByRole("option", {
      name: "AndyMark (blocked for this team)",
    })).toBeInTheDocument();

    fireEvent.click(within(page.container).getByRole("button", { name: "Add custom part" }));
    const customSupplier = screen.getByLabelText("Supplier *");
    expect(within(customSupplier).queryByRole("option", { name: "AndyMark" }))
      .not.toBeInTheDocument();
  });

  it("opens in Stockroom and keeps the three named views easy to switch between", async () => {
    const stockroom = await renderPartsPage("team-a", "stockroom");
    expect(within(stockroom.container).getByRole("tab", { name: "Stockroom" }))
      .toHaveAttribute("aria-selected", "true");
    expect(within(stockroom.container).getByLabelText("Stockroom")).toBeInTheDocument();
    expect(within(stockroom.container).queryByRole("textbox", { name: "Part, SKU, or material" }))
      .not.toBeInTheDocument();

    const stockroomTab = within(stockroom.container).getByRole("tab", { name: "Stockroom" });
    stockroomTab.focus();
    fireEvent.keyDown(stockroomTab, { key: "ArrowRight" });
    const findTab = within(stockroom.container).getByRole("tab", { name: "Find parts" });
    expect(findTab).toHaveFocus();
    fireEvent.keyDown(findTab, { key: "ArrowRight" });
    const buildsTab = within(stockroom.container).getByRole("tab", { name: "Robot builds" });
    expect(buildsTab)
      .toHaveFocus();
    expect(buildsTab)
      .toHaveAttribute("aria-selected", "true");
    expect(within(stockroom.container).getByRole("heading", { name: "Plan the parts on each robot" })).toBeInTheDocument();
    fireEvent.keyDown(buildsTab, { key: "Home" });
    expect(within(stockroom.container).getByRole("tab", { name: "Stockroom" })).toHaveFocus();
    fireEvent.keyDown(within(stockroom.container).getByRole("tab", { name: "Stockroom" }), { key: "End" });
    expect(buildsTab).toHaveFocus();
  });

  it("creates a robot from Robot builds and opens its build card", async () => {
    const page = await renderPartsPage("team-a", "builds");
    fireEvent.change(within(page.container).getByRole("textbox", { name: "New robot name" }), {
      target: { value: "Field test rover" },
    });
    fireEvent.click(within(page.container).getByRole("button", { name: "Add robot" }));

    await waitFor(() => expect(mocks.createRobot).toHaveBeenCalledWith({
      data: { name: "Field test rover" },
    }));
    expect(await within(page.container).findByRole("button", {
      name: "Open build details for Field test rover",
    })).toBeInTheDocument();
  });

  it("places the draft order beside supplier results and makes key disclosures actionable", async () => {
    const page = await renderPartsPage();
    expect(within(page.container).getByTestId("parts-find-results-layout")).toBeInTheDocument();
    expect(within(page.container).getByRole("link", { name: "Ask Parts Assistant" })).toHaveAttribute("href", "/parts/assistant");
    const tray = within(page.container).getByRole("complementary", { name: "Draft order tray" });
    expect(tray).toContainElement(within(page.container).getByTestId("details-parts-order"));

    const orderDetails = within(page.container).getByTestId("details-parts-order");
    const orderTrigger = orderDetails.querySelector("summary");
    if (!orderTrigger) throw new Error("The draft-order disclosure trigger was not found.");
    expect(orderTrigger).toHaveTextContent("View order");
    expect(orderTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(orderTrigger);
    expect(orderTrigger).toHaveTextContent("Hide order");
    expect(orderTrigger).toHaveAttribute("aria-expanded", "true");
    expect(orderDetails).toHaveAttribute("open");

    const coverageDetails = within(page.container).getByTestId("details-parts-coverage");
    const coverageTrigger = coverageDetails.querySelector("summary");
    if (!coverageTrigger) throw new Error("The supplier-coverage disclosure trigger was not found.");
    expect(coverageTrigger).toHaveTextContent("View supplier status");
    expect(coverageTrigger).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(coverageTrigger);
    expect(coverageTrigger).toHaveTextContent("Hide supplier status");
    expect(coverageTrigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(within(page.container).getByRole("tab", { name: "Stockroom" }));
    const totals = openStockTotals(page.container);
    expect(totals).toBeInTheDocument();
    expect(within(page.container).queryByTestId("details-parts-robots")).not.toBeInTheDocument();
  });

  it("lets a user allocate an inventory part to a robot from the reorganized workspace", async () => {
    mocks.teamRobots.set("team-a", [{ id: "team-a-robot-1", name: "Competition robot" }]);
    mocks.teamInventory.set("team-a", [{
      id: "team-a-shaft",
      vendorKey: "andymark",
      vendorName: "AndyMark",
      name: "Shaft collar",
      sku: "SC-1",
      category: "Hardware",
      description: null,
      productUrl: null,
      imageUrl: null,
      storageLocation: null,
      inventoryNotes: null,
      quantityOwned: 5,
      quantityAssigned: 0,
      quantityAvailable: 5,
      allocations: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);
    const page = await renderPartsPage();
    fireEvent.click(within(page.container).getByRole("tab", { name: "Stockroom" }));

    const quantity = await within(page.container).findByRole("spinbutton", {
      name: "Quantity of Shaft collar assigned to selected robot",
    });
    fireEvent.change(within(page.container).getByRole("combobox", {
      name: "Choose a robot for Shaft collar",
    }), { target: { value: "team-a-robot-1" } });
    fireEvent.change(quantity, { target: { value: "2" } });
    fireEvent.click(within(page.container).getByRole("button", { name: "Set" }));

    await waitFor(() => {
      expect(mocks.setAllocation).toHaveBeenCalledWith({
        robotId: "team-a-robot-1",
        partId: "team-a-shaft",
        data: { quantity: 2 },
      });
    });
    expect(await within(page.container).findByRole("status"))
      .toHaveTextContent("Robot allocation updated.");
    const totals = openStockTotals(page.container);
    await waitFor(() => {
      expect(within(totals).getByText("Assigned units").parentElement).toHaveTextContent("2");
    });
  });

  it("updates supplier lists from the supplier status area", async () => {
    const page = await renderPartsPage();
    fireEvent.click(within(page.container).getByTestId("button-toggle-parts-source-coverage"));
    fireEvent.click(within(page.container).getByRole("button", { name: "Update supplier lists" }));

    await waitFor(() => expect(mocks.syncCatalogs).toHaveBeenCalledTimes(1));
    expect(await within(page.container).findByText(/Supplier list update finished/))
      .toBeInTheDocument();
  });

  it("lets a user add a priced supplier result to the expandable draft order", async () => {
    mocks.consumeSearch.mockImplementation(async (_params, onEvent) => {
      await onEvent({
        type: "result",
        result: {
          ...earlyProduct,
          title: "Draft-order bracket",
          url: "https://www.andymark.com/products/draft-order-bracket",
          price: "14.50",
          currency: "USD",
        },
      });
      await onEvent({
        type: "complete",
        status: "available",
        providerCount: 2,
        failedProviderCount: 0,
        resultCount: 1,
      });
    });
    const page = await renderPartsPage();
    startSearch("priced bracket");

    fireEvent.click(await within(page.container).findByRole("button", { name: "Add to draft" }));
    expect(await within(page.container).findByText("Draft-order bracket added to the draft order. No purchase has been placed."))
      .toBeInTheDocument();

    const orderDetails = within(page.container).getByTestId("details-parts-order");
    const orderSummary = orderDetails.querySelector("summary");
    if (!orderSummary) throw new Error("The draft order summary was not found.");
    fireEvent.click(orderSummary);
    fireEvent.click(within(orderDetails).getByRole("button", {
      name: "Increase quantity of Draft-order bracket",
    }));
    expect(orderDetails).toHaveTextContent("2 items");
    expect(JSON.parse(window.localStorage.getItem("robotics-parts-order-draft-v1") ?? "[]"))
      .toMatchObject([{ product: { title: "Draft-order bracket" }, quantity: 2 }]);
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

    const saveButton = await screen.findByRole("button", { name: "Add to Stockroom" });
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
    expect(await screen.findByText("Added to Stockroom.")).toBeInTheDocument();
    expect(screen.queryByText(/Search complete/)).not.toBeInTheDocument();

    await act(async () => {
      finishSearch();
    });
    expect(await screen.findByText(/Search complete\. 1 verified supplier result/)).toBeInTheDocument();
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
      "Some suppliers could not be reached: 1 of 4 search providers failed",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Some suppliers could not be reached");
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
      "all 4 search providers could not be reached",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Search complete, but suppliers did not return live results",
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
      "Supplier search ended early",
    );
    expect(screen.getByRole("status")).toHaveTextContent("Some suppliers could not be reached");
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
    fireEvent.click(screen.getByRole("tab", { name: "Stockroom" }));
    fireEvent.click(await screen.findByRole("button", { name: "Scan part" }));
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
    expect(await screen.findByText("Reviewed bracket added to Stockroom.")).toBeInTheDocument();
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
      fireEvent.click(within(session.container).getByRole("tab", { name: "Stockroom" }));
    }
    await within(otherTeam.container).findByText("Team B private bracket");
    expect(within(writer.container).queryByText("Team B private bracket")).not.toBeInTheDocument();
    expect(within(teammate.container).queryByText("Team B private bracket")).not.toBeInTheDocument();

    fireEvent.click(within(writer.container).getByRole("button", { name: "Scan part" }));
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
      const totals = openStockTotals(teammate.container);
      expect(within(totals).getByText("Parts in catalog").parentElement).toHaveTextContent("1");
      expect(within(totals).getByText("Owned units").parentElement).toHaveTextContent("3");
    }, { timeout: 10_000 });

    expect(within(teammate.container).getByText("1 shown of 1 saved parts")).toBeInTheDocument();
    expect(within(otherTeam.container).queryByText("Photo-added team bracket")).not.toBeInTheDocument();
    expect(within(otherTeam.container).queryByText("Team B private bracket")).toBeInTheDocument();
  }, 15_000);

  it("shows all team-tracked supplier parts in inventory and matches dashboard stock totals", async () => {
    const item = (
      id: string,
      name: string,
      teamId: string,
      quantityOwned: number,
      quantityAssigned: number,
      isManual: boolean,
      vendorKey = "andymark",
    ) => ({
      id,
      teamId,
      vendorKey,
      vendorName: vendorKey === "andymark" ? "AndyMark" : "FERRA",
      name,
      sku: null,
      category: null,
      description: null,
      productUrl: null,
      imageUrl: null,
      storageLocation: null,
      inventoryNotes: null,
      quantityOwned,
      quantityAssigned,
      quantityAvailable: Math.max(0, quantityOwned - quantityAssigned),
      allocations: quantityAssigned > 0
        ? [{ robotId: `${teamId}-robot`, robotName: "Competition robot", quantity: quantityAssigned }]
        : [],
      isManual,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.teamInventory.set("team-a", [
      item("team-a-gear", "Tracked gear", "team-a", 5, 2, false),
      item("team-a-bearing", "Tracked bearing", "team-a", 3, 0, false),
      item("team-a-allocation", "Tracked allocation", "team-a", 1, 1, false),
      item("team-a-manual", "Manual spare", "team-a", 0, 0, true),
      item("team-a-untracked", "Supplier catalog only", "team-a", 0, 0, false),
    ]);
    mocks.teamInventory.set("team-b", [
      item("team-b-private", "Other team tracked part", "team-b", 7, 2, false),
    ]);

    const teamA = await renderPartsPage("team-a");
    const teamB = await renderPartsPage("team-b");
    for (const session of [teamA, teamB]) {
      fireEvent.click(within(session.container).getByRole("tab", { name: "Stockroom" }));
    }
    expect(await within(teamA.container).findByRole("button", { name: "Open details for Tracked gear" })).toBeInTheDocument();
    expect(within(teamA.container).getByRole("button", { name: "Open details for Tracked bearing" })).toBeInTheDocument();
    expect(within(teamA.container).getByRole("button", { name: "Open details for Tracked allocation" })).toBeInTheDocument();
    expect(within(teamA.container).getByRole("button", { name: "Open details for Manual spare" })).toBeInTheDocument();
    expect(within(teamA.container).queryByText("Supplier catalog only")).not.toBeInTheDocument();
    expect(within(teamA.container).queryByText("Other team tracked part")).not.toBeInTheDocument();
    expect(within(teamB.container).getByRole("button", { name: "Open details for Other team tracked part" })).toBeInTheDocument();
    expect(within(teamB.container).queryByText("Tracked gear")).not.toBeInTheDocument();

    const gearCard = within(teamA.container).getByRole("button", { name: "Open details for Tracked gear" }).closest("article");
    expect(gearCard).toHaveTextContent("Owned 5");
    expect(gearCard).toHaveTextContent("Assigned 2");
    const bearingCard = within(teamA.container).getByRole("button", { name: "Open details for Tracked bearing" }).closest("article");
    expect(bearingCard).toHaveTextContent("Owned 3");
    expect(bearingCard).toHaveTextContent("Assigned 0");

    const totals = openStockTotals(teamA.container);
    expect(within(totals).getByText("Parts in catalog").parentElement).toHaveTextContent("5");
    expect(within(totals).getByText("Owned units").parentElement).toHaveTextContent("9");
    expect(within(totals).getByText("Assigned units").parentElement).toHaveTextContent("3");
    expect(within(teamA.container).getByTestId("button-toggle-parts-totals"))
      .toHaveTextContent("5 parts in catalog · 6 units available");
    expect(within(teamA.container).getByText("4 shown of 4 saved parts")).toBeInTheDocument();
  });

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
    fireEvent.click(within(firstPage.container).getByRole("tab", { name: "Stockroom" }));
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
    fireEvent.click(within(reloadedPage.container).getByRole("tab", { name: "Stockroom" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open details for Precision bracket" }));
    const reloadedDialog = within(await screen.findByRole("dialog"));
    expect(await screen.findByDisplayValue("Shelf A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Keep with the spare fasteners.")).toBeInTheDocument();
    expect(screen.getByDisplayValue("13.25")).toBeInTheDocument();
    expect(screen.getByDisplayValue("CAD")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://images.example.test/bracket-v2.png")).toBeInTheDocument();
    expect(reloadedDialog.getByText("Supplier description for the bracket.")).toBeInTheDocument();
  });

  it("retries a temporary part-details failure in the open dialog", async () => {
    mocks.teamInventory.set("team-a", [{
      id: "team-a-retry-part",
      vendorKey: "andymark",
      vendorName: "AndyMark",
      name: "Retryable bracket",
      sku: "RETRY-1",
      category: "Structure",
      description: "Saved supplier details.",
      productUrl: "https://www.andymark.com/products/retryable-bracket",
      imageUrl: null,
      storageLocation: "Shelf B",
      inventoryNotes: "Team-specific note.",
      quantityOwned: 2,
      quantityAssigned: 0,
      quantityAvailable: 2,
      allocations: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);
    mocks.getDetails.mockReset()
      .mockRejectedValueOnce(Object.assign(new Error("Service unavailable"), { status: 503 }))
      .mockImplementationOnce(loadMockPartDetails);

    const page = await renderPartsPage("team-a");
    fireEvent.click(within(page.container).getByRole("tab", { name: "Stockroom" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open details for Retryable bracket" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: "Retryable bracket" })).toBeInTheDocument();
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The saved part details couldn’t be loaded. Check your connection and try again.",
    );

    fireEvent.click(within(dialog).getByRole("button", { name: "Retry loading details for Retryable bracket" }));
    expect(await within(dialog).findByLabelText("Storage location")).toHaveValue("Shelf B");
    expect(within(dialog).getByText("Saved supplier details.")).toBeInTheDocument();
    expect(within(dialog).getByText("Team-specific note.")).toBeInTheDocument();
    expect(mocks.getDetails).toHaveBeenCalledTimes(2);
  });

  it("explains when a saved part is missing or belongs to another team without offering a misleading retry", async () => {
    mocks.teamInventory.set("team-a", [{
      id: "team-a-missing-part",
      vendorKey: "andymark",
      vendorName: "AndyMark",
      name: "Unavailable bracket",
      sku: "GONE-1",
      category: null,
      description: null,
      productUrl: null,
      imageUrl: null,
      storageLocation: null,
      inventoryNotes: null,
      quantityOwned: 1,
      quantityAssigned: 0,
      quantityAvailable: 1,
      allocations: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);
    mocks.getDetails.mockReset().mockRejectedValue(
      Object.assign(new Error("Not found"), { status: 404 }),
    );

    const page = await renderPartsPage("team-a");
    fireEvent.click(within(page.container).getByRole("tab", { name: "Stockroom" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open details for Unavailable bracket" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "This part is no longer available in your team’s inventory. It may have been removed or belong to another team.",
    );
    expect(within(dialog).queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });

  it("asks the user to sign in again when authorization has expired", async () => {
    mocks.teamInventory.set("team-a", [{
      id: "team-a-auth-part",
      vendorKey: "andymark",
      vendorName: "AndyMark",
      name: "Protected bracket",
      sku: "AUTH-1",
      category: null,
      description: null,
      productUrl: null,
      imageUrl: null,
      storageLocation: null,
      inventoryNotes: null,
      quantityOwned: 1,
      quantityAssigned: 0,
      quantityAvailable: 1,
      allocations: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }]);
    mocks.getDetails.mockReset().mockRejectedValue(
      Object.assign(new Error("Authentication required"), { status: 401 }),
    );

    const page = await renderPartsPage("team-a");
    fireEvent.click(within(page.container).getByRole("tab", { name: "Stockroom" }));
    fireEvent.click(await screen.findByRole("button", { name: "Open details for Protected bracket" }));

    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Your session has expired. Sign in again to view this part’s details.",
    );
    expect(within(dialog).queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
  });
});
