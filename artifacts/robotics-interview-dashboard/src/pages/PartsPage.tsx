import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Boxes,
  Check,
  ExternalLink,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import {
  getGetPartsDashboardQueryKey,
  getListPartsCatalogQueryKey,
  searchPartsCatalog,
  useSyncPartsCatalog,
  useCreatePartsCatalogItem,
  useCreatePartsRobot,
  useGetPartsDashboard,
  useListPartsCatalog,
  useSetPartsRobotAllocation,
  useUpdatePartsCatalogStock,
  type PartsCatalogItem,
  type PartsCatalogSearchResult,
  type PartsVendor,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type PageTab = "inventory" | "search";
type Notice = { kind: "success" | "error"; text: string };
type PartsOrderLine = { product: PartsCatalogSearchResult; quantity: number };
type PartsCatalogSyncResult = Awaited<
  ReturnType<ReturnType<typeof useSyncPartsCatalog>["mutateAsync"]>
>;

const PARTS_ORDER_DRAFT_KEY = "robotics-parts-order-draft-v1";

const VENDOR_GROUPS: PartsVendor["group"][] = [
  "General Parts",
  "Specific Parts",
  "Machining Companies",
];

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { error?: unknown } } }).response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return fallback;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat().format(value);
}

function readPartsOrderDraft(): PartsOrderLine[] {
  if (typeof window === "undefined") return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(PARTS_ORDER_DRAFT_KEY) ?? "[]");
    if (!Array.isArray(saved)) return [];
    return saved.filter((line): line is PartsOrderLine =>
      typeof line === "object" &&
      line !== null &&
      typeof line.quantity === "number" &&
      Number.isInteger(line.quantity) &&
      line.quantity > 0 &&
      typeof line.product === "object" &&
      line.product !== null &&
      typeof line.product.url === "string" &&
      typeof line.product.title === "string" &&
      typeof line.product.price === "string" &&
      Number.isFinite(Number(line.product.price)) &&
      Number(line.product.price) >= 0 &&
      typeof line.product.currency === "string" &&
      /^[A-Z]{3}$/.test(line.product.currency) &&
      typeof line.product.imageUrl === "string",
    );
  } catch {
    return [];
  }
}

function formatMoney(amount: number, currency: string): string {
  if (!Number.isFinite(amount) || !/^[A-Z]{3}$/.test(currency)) return "Price unavailable";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function PartImage({ src, alt, className }: { src: string; alt: string; className: string }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-md border border-border bg-muted text-muted-foreground ${className}`}
        role="img"
        aria-label={alt ? `${alt} image unavailable` : "Part image unavailable"}
      >
        <Package size={22} aria-hidden="true" />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function QuantityMetric({
  label,
  value,
  icon: Icon,
  detail,
}: {
  label: string;
  value: number;
  icon: typeof Package;
  detail: string;
}) {
  return (
    <Card className="border-border bg-card">
      <CardContent className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatQuantity(value)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <span className="rounded-xl bg-primary/10 p-2.5 text-primary">
          <Icon size={19} aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}

function PartCard({
  item,
  robots,
  onSaveStock,
  onSetAllocation,
  busy,
}: {
  item: PartsCatalogItem;
  robots: { id: string; name: string }[];
  onSaveStock: (item: PartsCatalogItem, quantity: number) => Promise<void>;
  onSetAllocation: (item: PartsCatalogItem, robotId: string, quantity: number) => Promise<void>;
  busy: boolean;
}) {
  const currentRobotId = item.allocations[0]?.robotId ?? "";
  const [robotId, setRobotId] = useState(currentRobotId);
  const currentAllocation = item.allocations.find((allocation) => allocation.robotId === robotId)?.quantity ?? 0;
  const [stockDraft, setStockDraft] = useState(String(item.quantityOwned));
  const [allocationDraft, setAllocationDraft] = useState(String(currentAllocation));
  const selectedRobotAllocation = item.allocations.find((allocation) => allocation.robotId === robotId)?.quantity ?? 0;
  const maxAssignable = item.quantityAvailable + selectedRobotAllocation;

  useEffect(() => {
    setStockDraft(String(item.quantityOwned));
  }, [item.id, item.quantityOwned]);

  useEffect(() => {
    if (!robotId && item.allocations.length > 0) {
      setRobotId(item.allocations[0].robotId);
    }
    setAllocationDraft(String(item.allocations.find((allocation) => allocation.robotId === robotId)?.quantity ?? 0));
  }, [item.allocations, robotId]);

  return (
    <article className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{item.name}</h3>
            <Badge variant="secondary">{item.vendorName}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {item.sku && <span>SKU {item.sku}</span>}
            {item.category && <span>{item.category}</span>}
            {item.productUrl && (
              <a
                href={item.productUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Vendor page <ExternalLink size={12} aria-hidden="true" />
              </a>
            )}
          </div>
          {item.description && (
            <p className="mt-3 line-clamp-2 max-w-3xl text-sm text-muted-foreground">{item.description}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-muted px-2.5 py-1.5 text-foreground">
              Owned <strong className="ml-1 tabular-nums">{formatQuantity(item.quantityOwned)}</strong>
            </span>
            <span className="rounded-md bg-muted px-2.5 py-1.5 text-foreground">
              Assigned <strong className="ml-1 tabular-nums">{formatQuantity(item.quantityAssigned)}</strong>
            </span>
            <span className="rounded-md bg-primary/10 px-2.5 py-1.5 text-primary">
              Available <strong className="ml-1 tabular-nums">{formatQuantity(item.quantityAvailable)}</strong>
            </span>
          </div>
          {item.allocations.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Current robot assignments">
              {item.allocations.map((allocation) => (
                <span
                  key={allocation.robotId}
                  className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {allocation.robotName} · {allocation.quantity}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-3 rounded-lg bg-muted/50 p-3 sm:grid-cols-2 xl:w-[430px] xl:grid-cols-1">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const quantity = Number(stockDraft);
              if (Number.isInteger(quantity) && quantity >= 0) void onSaveStock(item, quantity);
            }}
          >
            <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              Owned stock
              <Input
                type="number"
                min={0}
                step={1}
                value={stockDraft}
                onChange={(event) => setStockDraft(event.target.value)}
                className="mt-1 h-9 bg-background text-foreground"
                aria-label={`Owned stock for ${item.name}`}
              />
            </label>
            <Button type="submit" variant="outline" size="sm" disabled={busy}>
              Save
            </Button>
          </form>

          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const quantity = Number(allocationDraft);
              if (robotId && Number.isInteger(quantity) && quantity >= 0) {
                void onSetAllocation(item, robotId, quantity);
              }
            }}
          >
            <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
              Assign to robot
              <select
                value={robotId}
                onChange={(event) => {
                  const nextRobotId = event.target.value;
                  setRobotId(nextRobotId);
                  setAllocationDraft(
                    String(item.allocations.find((allocation) => allocation.robotId === nextRobotId)?.quantity ?? 0),
                  );
                }}
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label={`Choose a robot for ${item.name}`}
                disabled={robots.length === 0}
              >
                <option value="">Choose robot</option>
                {robots.map((robot) => (
                  <option key={robot.id} value={robot.id}>{robot.name}</option>
                ))}
              </select>
            </label>
            <Input
              type="number"
              min={0}
              max={maxAssignable}
              step={1}
              value={allocationDraft}
              onChange={(event) => setAllocationDraft(event.target.value)}
              className="h-9 w-20 bg-background text-foreground"
              aria-label={`Quantity of ${item.name} assigned to selected robot`}
              disabled={!robotId}
            />
            <Button type="submit" size="sm" disabled={busy || !robotId}>
              Set
            </Button>
          </form>
        </div>
      </div>
    </article>
  );
}

export default function PartsPage() {
  const queryClient = useQueryClient();
  const dashboardQuery = useGetPartsDashboard();
  const [tab, setTab] = useState<PageTab>("inventory");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryVendor, setInventoryVendor] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<PartsCatalogSearchResult[]>([]);
  const [lastSearch, setLastSearch] = useState("");
  const [savedSearchOffset, setSavedSearchOffset] = useState(0);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [orderDraft, setOrderDraft] = useState<PartsOrderLine[]>(readPartsOrderDraft);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [robotName, setRobotName] = useState("");
  const [lastCatalogSync, setLastCatalogSync] = useState<PartsCatalogSyncResult | null>(null);

  const catalogQuery = useListPartsCatalog({
    search: inventorySearch.trim() || undefined,
    vendorKey: inventoryVendor || undefined,
    limit: pageSize,
    offset: 0,
  });
  const savedSearchParams = {
    search: lastSearch.trim() || undefined,
    limit: 100,
    offset: savedSearchOffset,
  };
  const savedCatalogSearchQuery = useListPartsCatalog(savedSearchParams, {
    query: {
      queryKey: getListPartsCatalogQueryKey(savedSearchParams),
      enabled: lastSearch.trim().length >= 2,
    },
  });
  const createItemMutation = useCreatePartsCatalogItem();
  const syncMutation = useSyncPartsCatalog();
  const createRobotMutation = useCreatePartsRobot();
  const stockMutation = useUpdatePartsCatalogStock();
  const allocationMutation = useSetPartsRobotAllocation();
  const vendors = dashboardQuery.data?.vendors ?? [];
  const robots = dashboardQuery.data?.robots ?? [];
  const catalogItems = catalogQuery.data?.items ?? [];
  const currentlyAdded = new Set(
    catalogItems.map((item) => item.productUrl).filter((url): url is string => Boolean(url)),
  );
  const draftQuantities = orderDraft.reduce((total, line) => total + line.quantity, 0);
  const orderTotalsByCurrency = orderDraft.reduce<Record<string, number>>((totals, line) => {
    const currency = line.product.currency;
    const unitPrice = Number(line.product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0 || !/^[A-Z]{3}$/.test(currency)) return totals;
    const total = (totals[currency] ?? 0) + unitPrice * line.quantity;
    if (Number.isFinite(total)) totals[currency] = total;
    return totals;
  }, {});

  useEffect(() => {
    try {
      window.localStorage.setItem(PARTS_ORDER_DRAFT_KEY, JSON.stringify(orderDraft));
    } catch {
      setNotice({
        kind: "error",
        text: "This browser blocked local storage. The order draft may not persist after you leave this page.",
      });
    }
  }, [orderDraft]);

  const refreshParts = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: getGetPartsDashboardQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListPartsCatalogQueryKey() }),
    ]);
  };

  const syncPublicCatalogs = async () => {
    setNotice(null);
    try {
      const result = await syncMutation.mutateAsync();
      setLastCatalogSync(result);
      await refreshParts();
      const synced = result.vendors.filter((vendor) => vendor.status === "synced").length;
      const incomplete = result.vendors.filter((vendor) => vendor.status === "incomplete").length;
      const unavailable = result.vendors.filter((vendor) => vendor.status === "unavailable").length;
      const searchOnly = result.vendors.filter((vendor) => vendor.status === "search_only").length;
      const syncedNames = result.vendors
        .filter((vendor) => vendor.status === "synced")
        .map((vendor) => vendor.vendorName);
      const incompleteNames = result.vendors
        .filter((vendor) => vendor.status === "incomplete")
        .map((vendor) => vendor.vendorName);
      const unavailableNames = result.vendors
        .filter((vendor) => vendor.status === "unavailable")
        .map((vendor) => vendor.vendorName);
      const searchOnlyNames = result.vendors
        .filter((vendor) => vendor.status === "search_only")
        .map((vendor) => vendor.vendorName);
      const details = [
        `Public feeds fully paginated: ${syncedNames.join(", ") || "none"}.`,
        incomplete > 0 ? `Pagination did not finish for: ${incompleteNames.join(", ")}.` : "",
        unavailable > 0 ? `Feeds unavailable: ${unavailableNames.join(", ")}.` : "",
        searchOnly > 0
          ? `No verified public full-catalog feed: ${searchOnlyNames.join(", ")}. They remain available in global search.`
          : "",
        "A completed feed sync covers only products exposed by that public feed.",
      ].filter(Boolean);
      setNotice({
        kind: synced > 0 ? "success" : "error",
        text: `Catalog sync finished: ${formatQuantity(result.totalItems)} product variants from ${synced} fully paginated public feed(s) (${formatQuantity(result.created)} new, ${formatQuantity(result.updated)} refreshed). ${details.join(" ")}`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: errorMessage(error, "Unable to sync public supplier catalogs."),
      });
    }
  };

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (searchText.trim().length < 2) {
      setSearchError("Enter at least two characters.");
      return;
    }
    setSearchBusy(true);
    setSearchError("");
    setSearchResults([]);
    setSavedSearchOffset(0);
    setLastSearch(searchText.trim());
    try {
      const result = await searchPartsCatalog({ q: searchText.trim() });
      setSearchResults(result.results);
      if (result.liveSearchStatus === "unavailable") {
        setSearchError(
          result.catalogTotal > 0
            ? "Live supplier discovery is unavailable right now. Indexed catalog matches are still shown below."
            : "Live supplier discovery is unavailable right now. Try again shortly.",
        );
      } else if (result.results.length === 0 && result.catalogTotal === 0) {
        setSearchError("No live product-page discoveries with verified details were found. Check the synced catalog matches below.");
      }
    } catch (error) {
      setSearchError(errorMessage(error, "Keyless supplier search is unavailable right now."));
    } finally {
      setSearchBusy(false);
    }
  };

  const addSearchResultToDraft = (product: PartsCatalogSearchResult) => {
    setOrderDraft((previous) => {
      const existing = previous.find((line) => line.product.url === product.url);
      return existing
        ? previous.map((line) => line.product.url === product.url
          ? { product, quantity: line.quantity + 1 }
          : line)
        : [...previous, { product, quantity: 1 }];
    });
    setNotice({ kind: "success", text: `${product.title} added to the draft order. No purchase has been placed.` });
  };

  const setDraftQuantity = (productUrl: string, quantity: number) => {
    setOrderDraft((previous) => previous
      .map((line) => line.product.url === productUrl ? { ...line, quantity } : line)
      .filter((line) => line.quantity > 0));
  };

  const saveSearchResultToInventory = async (product: PartsCatalogSearchResult) => {
    try {
      await createItemMutation.mutateAsync({
        data: {
          vendorKey: product.vendorKey,
          name: product.title,
          sku: product.sku,
          description: product.description,
          productUrl: product.url,
          imageUrl: product.imageUrl,
          quantityOwned: 0,
        },
      });
      setNotice({ kind: "success", text: `${product.title} saved to inventory.` });
      await refreshParts();
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "Unable to save this part to inventory.") });
    }
  };

  const createRobot = async (event: FormEvent) => {
    event.preventDefault();
    if (!robotName.trim()) return;
    try {
      await createRobotMutation.mutateAsync({ data: { name: robotName.trim() } });
      setRobotName("");
      setNotice({ kind: "success", text: "Robot added." });
      await queryClient.invalidateQueries({ queryKey: getGetPartsDashboardQueryKey() });
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "Unable to add the robot.") });
    }
  };

  const saveStock = async (item: PartsCatalogItem, quantityOwned: number) => {
    try {
      await stockMutation.mutateAsync({ partId: item.id, data: { quantityOwned } });
      setNotice({ kind: "success", text: `Stock updated for ${item.name}.` });
      await refreshParts();
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "Unable to update stock.") });
    }
  };

  const setAllocation = async (item: PartsCatalogItem, robotId: string, quantity: number) => {
    try {
      await allocationMutation.mutateAsync({
        robotId,
        partId: item.id,
        data: { quantity },
      });
      setNotice({ kind: "success", text: quantity === 0 ? "Robot allocation removed." : "Robot allocation updated." });
      await refreshParts();
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "Unable to update the robot allocation.") });
    }
  };

  const dashboard = dashboardQuery.data;
  const isMutating =
    stockMutation.isPending ||
    allocationMutation.isPending;

  return (
    <main className="min-h-[calc(100dvh-4rem)] space-y-6 bg-background p-4 text-foreground sm:p-6 xl:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">
              <ShieldCheck size={14} aria-hidden="true" />
              Protected team workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Parts & inventory</h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Search all 19 suppliers, sync verified public catalogs, track owned stock, and reserve parts for each robot.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/parts/assistant"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Bot size={16} aria-hidden="true" />
              Parts assistant
            </Link>
            <Button
              variant="outline"
              disabled={syncMutation.isPending}
              onClick={() => void syncPublicCatalogs()}
            >
              {syncMutation.isPending
                ? <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                : <RefreshCw size={16} aria-hidden="true" />}
              {syncMutation.isPending ? "Syncing catalogs…" : "Sync public catalogs"}
            </Button>
            <Button onClick={() => setTab("search")}>
              <Search size={16} aria-hidden="true" />
              Find parts
            </Button>
          </div>
        </header>

        {notice && (
          <div
            role={notice.kind === "error" ? "alert" : "status"}
            className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
              notice.kind === "error"
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-primary/25 bg-primary/10 text-foreground"
            }`}
          >
            {notice.kind === "error" ? <AlertCircle size={17} /> : <Check size={17} />}
            <span>{notice.text}</span>
          </div>
        )}

        {dashboardQuery.isError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Could not load the parts dashboard. Refresh the page or try again.
          </div>
        )}

        {dashboardQuery.isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            <Loader2 className="animate-spin" size={17} /> Loading parts workspace…
          </div>
        ) : dashboard ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Parts totals">
              <QuantityMetric
                label="Catalog items"
                value={dashboard.summary.catalogItems}
                icon={Package}
                detail="Saved supplier parts"
              />
              <QuantityMetric
                label="Owned units"
                value={dashboard.summary.ownedUnits}
                icon={Boxes}
                detail="Total tracked stock"
              />
              <QuantityMetric
                label="Assigned units"
                value={dashboard.summary.assignedUnits}
                icon={Users}
                detail="Allocated across robots"
              />
              <QuantityMetric
                label="Available units"
                value={dashboard.summary.availableUnits}
                icon={Wrench}
                detail={`${dashboard.summary.vendorCount} suppliers supported`}
              />
            </section>

            <Card className="border-border bg-card">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Robots</CardTitle>
                    <CardDescription className="mt-1">
                      Create the robots you build, then assign catalog quantities below.
                    </CardDescription>
                  </div>
                  <form onSubmit={createRobot} className="flex w-full gap-2 sm:max-w-md">
                    <Input
                      value={robotName}
                      onChange={(event) => setRobotName(event.target.value.slice(0, 80))}
                      placeholder="Robot name"
                      aria-label="New robot name"
                      maxLength={80}
                    />
                    <Button type="submit" disabled={createRobotMutation.isPending || !robotName.trim()}>
                      {createRobotMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                      Add robot
                    </Button>
                  </form>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {robots.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                    No robots yet. Add one to start assigning parts.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {robots.map((robot) => (
                      <span key={robot.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm">
                        <span className="size-2 rounded-full bg-primary" />
                        {robot.name}
                      </span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-wrap items-center gap-2 border-b border-border" role="tablist" aria-label="Parts views">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "inventory"}
                onClick={() => setTab("inventory")}
                className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  tab === "inventory"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Inventory
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "search"}
                onClick={() => setTab("search")}
                className={`border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                  tab === "search"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Supplier catalog
              </button>
            </div>

            {tab === "search" ? (
              <section className="space-y-4" aria-label="Search supplier catalogs">
                <Card className="border-border bg-card" data-testid="card-parts-source-coverage">
                  <CardHeader>
                    <CardTitle className="text-base">Supplier catalog coverage</CardTitle>
                    <CardDescription>
                      Every supplier has an official source listed. A feed is marked complete only when sync verifies that pagination reached its end; live search results are discovery samples.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-foreground" data-testid="status-parts-source-coverage">
                      {lastCatalogSync
                        ? `Last sync: ${lastCatalogSync.vendors.filter((item) => item.status === "synced").length} complete feed(s), ${lastCatalogSync.vendors.filter((item) => item.status === "incomplete").length} incomplete, ${lastCatalogSync.vendors.filter((item) => item.status === "search_only").length} discovery-only, and ${lastCatalogSync.vendors.filter((item) => item.status === "unavailable").length} unavailable.`
                        : `${vendors.filter((item) => item.coverageState === "feed_sync_required").length} public feed(s) await end-of-feed verification; other suppliers remain partial, access-restricted, or custom-fabrication sources.`}
                    </p>
                    <details className="rounded-lg border border-border bg-background p-3">
                      <summary
                        className="cursor-pointer text-sm font-medium text-foreground"
                        data-testid="button-show-parts-source-coverage"
                      >
                        Show all {vendors.length} supplier sources and coverage states
                      </summary>
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {vendors.map((vendor) => {
                          const syncResult = lastCatalogSync?.vendors.find(
                            (item) => item.vendorKey === vendor.key,
                          );
                          const stateLabel = syncResult
                            ? {
                                synced: "Complete feed",
                                search_only: "Discovery only",
                                unavailable: "Source unavailable",
                                incomplete: "Pagination incomplete",
                              }[syncResult.status]
                            : {
                                feed_sync_required: "Feed needs verification",
                                discovery_only: "Discovery only",
                                access_restricted: "Authorized API required",
                                custom_fabrication: "Custom fabrication",
                              }[vendor.coverageState];
                          const stateDetail = syncResult?.message ?? {
                            feed_sync_required: "A public feed is configured; completeness is confirmed only after sync reaches its end.",
                            discovery_only: "Official supplier pages are searchable, but a complete public SKU feed has not been verified.",
                            access_restricted: "The official product API requires approved customer access; public search remains discovery-only.",
                            custom_fabrication: "Custom fabrication services do not provide a verified, complete stock-SKU catalog.",
                          }[vendor.coverageState];
                          return (
                            <article
                              key={vendor.key}
                              className="rounded-md border border-border bg-card p-3"
                              data-testid={`card-parts-source-${vendor.key}`}
                            >
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-medium text-foreground">{vendor.name}</h3>
                                <Badge variant={syncResult?.status === "synced" ? "default" : "secondary"}>
                                  {stateLabel}
                                </Badge>
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">{stateDetail}</p>
                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                                <a
                                  className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                                  href={vendor.catalogSourceUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Official source <ExternalLink size={13} aria-hidden="true" />
                                </a>
                                {syncResult && (
                                  <a
                                    className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                                    href={syncResult.source}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Feed checked <ExternalLink size={13} aria-hidden="true" />
                                  </a>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </details>
                  </CardContent>
                </Card>

                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-base">Search all suppliers</CardTitle>
                    <CardDescription>
                      We search vendors separately to broaden coverage. Only official product pages with a verified image and price appear here. Search results are discovery, not an exhaustive catalog or live stock feed.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={runSearch} className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_auto]">
                      <label className="text-sm font-medium">
                        Part, SKU, or material
                        <Input
                          value={searchText}
                          onChange={(event) => setSearchText(event.target.value.slice(0, 120))}
                          placeholder="e.g. 8 mm shaft collar"
                          maxLength={120}
                          className="mt-1 h-10"
                        />
                      </label>
                      <Button type="submit" className="self-end" disabled={searchBusy || searchText.trim().length < 2}>
                        {searchBusy ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                        Search
                      </Button>
                    </form>
                    {searchError && (
                      <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                        <AlertCircle className="mt-0.5 shrink-0" size={16} /> {searchError}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/25 bg-card">
                  <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShoppingCart size={18} aria-hidden="true" />
                        Draft order
                        <Badge variant="secondary">{formatQuantity(draftQuantities)} items</Badge>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Saved in this browser. Prices are supplier-page snapshots; shipping, tax, and availability must be confirmed with the supplier.
                      </CardDescription>
                    </div>
                    {orderDraft.length > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setOrderDraft([])}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Clear
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {orderDraft.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                        Your draft is empty. Add a verified product below to start an order list.
                      </p>
                    ) : (
                      <>
                        <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                          {orderDraft.map(({ product, quantity }) => (
                            <div
                              key={product.url}
                              className="flex items-center gap-3 rounded-lg border border-border bg-background p-2.5"
                            >
                              <PartImage
                                src={product.imageUrl}
                                alt=""
                                className="size-14 shrink-0 rounded-md border border-border bg-muted object-contain"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">{product.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {product.vendorName} · {product.priceIsStartingAt ? "From " : ""}
                                  {formatMoney(Number(product.price), product.currency)} each
                                </p>
                                <p className="text-sm font-semibold tabular-nums text-foreground">
                                  {formatMoney(Number(product.price) * quantity, product.currency)}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="size-8"
                                  aria-label={`Decrease quantity of ${product.title}`}
                                  onClick={() => setDraftQuantity(product.url, quantity - 1)}
                                >
                                  <Minus size={14} aria-hidden="true" />
                                </Button>
                                <span className="w-7 text-center text-sm font-medium tabular-nums" aria-label={`Quantity ${quantity}`}>
                                  {quantity}
                                </span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="outline"
                                  className="size-8"
                                  aria-label={`Increase quantity of ${product.title}`}
                                  onClick={() => setDraftQuantity(product.url, quantity + 1)}
                                >
                                  <Plus size={14} aria-hidden="true" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-border pt-3">
                          <p className="text-xs text-muted-foreground">
                            {Object.keys(orderTotalsByCurrency).length > 1
                              ? "Subtotal by supplier currency"
                              : "Estimated subtotal"}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
                            {Object.entries(orderTotalsByCurrency).map(([currency, total]) => (
                              <p key={currency} className="text-lg font-semibold tabular-nums text-foreground">
                                {formatMoney(total, currency)}
                                {Object.keys(orderTotalsByCurrency).length > 1 && (
                                  <span className="ml-1 text-xs font-normal text-muted-foreground">{currency}</span>
                                )}
                              </p>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Draft only — no supplier order or payment has been submitted.
                          </p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {lastSearch && (
                  <Card className="border-primary/25 bg-card" data-testid="card-synced-catalog-matches">
                    <CardContent className="space-y-4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="font-semibold text-foreground">Synced catalog matches</h2>
                          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                            These are every matching part currently indexed from public supplier feeds or saved inventory, including common metric size spellings. This list is separate from live web discoveries.
                          </p>
                        </div>
                        {savedCatalogSearchQuery.data && (
                          <span className="text-sm font-medium text-foreground" data-testid="status-synced-catalog-total">
                            {formatQuantity(savedCatalogSearchQuery.data.total)} total
                          </span>
                        )}
                      </div>

                      {savedCatalogSearchQuery.isLoading && (
                        <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground">
                          <Loader2 className="animate-spin" size={16} /> Searching synced catalogs…
                        </div>
                      )}

                      {savedCatalogSearchQuery.isError && (
                        <p role="alert" className="text-sm text-destructive">
                          Could not search the synced parts catalog.
                        </p>
                      )}

                      {savedCatalogSearchQuery.data?.total === 0 && !savedCatalogSearchQuery.isLoading && (
                        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="max-w-2xl text-sm text-muted-foreground">
                            No matching items are indexed yet. Sync the available public supplier feeds to load their full catalogs; the live results below do not enumerate every SKU.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={syncMutation.isPending}
                            onClick={() => void syncPublicCatalogs()}
                            data-testid="button-sync-catalogs-from-search"
                          >
                            {syncMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                            {syncMutation.isPending ? "Syncing…" : "Sync public catalogs"}
                          </Button>
                        </div>
                      )}

                      {savedCatalogSearchQuery.data?.items.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-lg border border-border bg-background p-3"
                          data-testid={`card-synced-part-${item.id}`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <h3 className="font-medium text-foreground" data-testid={`text-synced-part-name-${item.id}`}>{item.name}</h3>
                              <p className="mt-1 text-sm text-muted-foreground" data-testid={`text-synced-part-details-${item.id}`}>
                                {item.vendorName}
                                {item.sku ? ` · SKU ${item.sku}` : ""}
                                {item.category ? ` · ${item.category}` : ""}
                              </p>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              In catalog · {formatQuantity(item.quantityOwned)} owned
                            </span>
                          </div>
                          {item.description && (
                            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
                          )}
                          {item.productUrl && (
                            <a
                              className="mt-2 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
                              href={item.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              data-testid={`link-supplier-page-${item.id}`}
                            >
                              Open supplier product page
                            </a>
                          )}
                        </article>
                      ))}

                      {savedCatalogSearchQuery.data && savedCatalogSearchQuery.data.total > 100 && (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">
                            Showing {savedSearchOffset + 1}–{Math.min(savedSearchOffset + 100, savedCatalogSearchQuery.data.total)} of {formatQuantity(savedCatalogSearchQuery.data.total)}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              disabled={savedSearchOffset === 0 || savedCatalogSearchQuery.isFetching}
                              onClick={() => setSavedSearchOffset((offset) => Math.max(0, offset - 100))}
                              data-testid="button-synced-catalog-previous-page"
                            >
                              Previous
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={savedSearchOffset + 100 >= savedCatalogSearchQuery.data.total || savedCatalogSearchQuery.isFetching}
                              onClick={() => setSavedSearchOffset((offset) => offset + 100)}
                              data-testid="button-synced-catalog-next-page"
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {searchBusy && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin" size={16} /> Searching across 19 suppliers…
                  </div>
                )}

                {lastSearch && searchResults.length > 0 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{searchResults.length} live verified product-page discovery result(s) for “{lastSearch}”</span>
                    <span>Confirm final price, options, stock, shipping, and tax with the supplier.</span>
                  </div>
                )}
                {lastSearch && (
                  <p className="text-xs leading-5 text-muted-foreground">
                    Live web results are discovery samples, not complete SKU listings. The synced catalog list above shows all matching records currently indexed; complete coverage still depends on each supplier exposing a verifiable public catalog feed.
                  </p>
                )}
                <div className="grid gap-3 lg:grid-cols-2">
                  {searchResults.map((result) => {
                    const alreadyAdded = orderDraft.some((line) => line.product.url === result.url);
                    const alreadyInInventory = currentlyAdded.has(result.url);
                    return (
                      <Card key={result.url} className="border-border bg-card">
                        <CardContent className="flex h-full flex-col gap-3 p-4">
                          <PartImage
                            src={result.imageUrl}
                            alt={result.title}
                            className="h-44 w-full rounded-lg border border-border bg-muted/40 object-contain p-2"
                          />
                          <div className="min-w-0">
                            <h3 className="font-medium text-foreground">{result.title}</h3>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{result.vendorName}</Badge>
                              {result.sku && <span className="text-xs text-muted-foreground">SKU {result.sku}</span>}
                            </div>
                            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{result.description}</p>
                            <p className="mt-3 text-lg font-semibold tabular-nums text-foreground">
                              {result.priceIsStartingAt ? "From " : ""}
                              {formatMoney(Number(result.price), result.currency)}
                              <span className="ml-1 text-xs font-normal text-muted-foreground">{result.currency}</span>
                            </p>
                          </div>
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                            >
                              Supplier page <ArrowUpRight size={14} aria-hidden="true" />
                            </a>
                            <span className="ml-auto flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={alreadyInInventory || createItemMutation.isPending}
                                onClick={() => void saveSearchResultToInventory(result)}
                              >
                                {alreadyInInventory ? <Check size={15} /> : <Package size={15} />}
                                {alreadyInInventory ? "In inventory" : "Save to inventory"}
                              </Button>
                              <Button
                                size="sm"
                                variant={alreadyAdded ? "secondary" : "default"}
                                onClick={() => addSearchResultToDraft(result)}
                              >
                                {alreadyAdded ? <Check size={15} /> : <Plus size={15} />}
                                {alreadyAdded ? "Add another" : "Add to draft"}
                              </Button>
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ) : (
              <section className="space-y-4" aria-label="Parts inventory">
                <Card className="border-border bg-card">
                  <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">
                        Search saved parts
                        <span className="relative mt-1 block">
                          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                          <Input
                            value={inventorySearch}
                            onChange={(event) => {
                              setInventorySearch(event.target.value);
                              setPageSize(100);
                            }}
                            placeholder="Part name or SKU"
                            className="pl-9"
                          />
                        </span>
                      </label>
                      <label className="text-sm font-medium">
                        Filter supplier
                        <select
                          value={inventoryVendor}
                          onChange={(event) => {
                            setInventoryVendor(event.target.value);
                            setPageSize(100);
                          }}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">All suppliers</option>
                          {VENDOR_GROUPS.map((group) => (
                            <optgroup key={group} label={group}>
                              {vendors.filter((vendor) => vendor.group === group).map((vendor) => (
                                <option key={vendor.key} value={vendor.key}>{vendor.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    {catalogQuery.isLoading
                      ? "Loading catalog…"
                      : `${formatQuantity(catalogItems.length)} shown of ${formatQuantity(catalogQuery.data?.total ?? 0)} saved item(s)`}
                  </span>
                  {catalogQuery.isError && <span role="alert" className="text-destructive">Could not load saved catalog items.</span>}
                </div>

                {catalogQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin" size={16} /> Loading inventory…
                  </div>
                ) : catalogItems.length === 0 ? (
                  <Card className="border-dashed border-border bg-card">
                    <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                      <span className="rounded-2xl bg-primary/10 p-3 text-primary"><Package size={24} /></span>
                      <h2 className="mt-4 font-semibold text-foreground">No saved parts yet</h2>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        Sync available public catalogs or search across all suppliers to add parts to the team inventory.
                      </p>
                      <Button className="mt-4" onClick={() => setTab("search")}>
                        <Search size={16} /> Find supplier parts
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {catalogItems.map((item) => (
                      <PartCard
                        key={item.id}
                        item={item}
                        robots={robots}
                        onSaveStock={saveStock}
                        onSetAllocation={setAllocation}
                        busy={isMutating}
                      />
                    ))}
                  </div>
                )}

                {catalogQuery.data && catalogQuery.data.total > catalogItems.length && (
                  <div className="flex justify-center">
                    <Button variant="outline" onClick={() => setPageSize((size) => Math.min(size + 100, catalogQuery.data?.total ?? size + 100))}>
                      Load more parts
                    </Button>
                  </div>
                )}
              </section>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}