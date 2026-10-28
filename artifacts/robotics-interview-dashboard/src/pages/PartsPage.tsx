import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertCircle,
  ArrowUpRight,
  Bot,
  Camera,
  Check,
  ChevronDown,
  ExternalLink,
  Info,
  Loader2,
  Minus,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import {
  getGetPartsDashboardQueryKey,
  getGetPartsVendorBlocksQueryKey,
  getGetSessionQueryKey,
  getListPartsCatalogQueryKey,
  consumePartsCatalogSearchStream,
  useSyncPartsCatalog,
  useCreatePartsCatalogItem,
  useCreatePartsRobot,
  useGetPartsDashboard,
  useGetSession,
  useListPartsCatalog,
  useSetPartsRobotAllocation,
  useUpdatePartsCatalogStock,
  useUpdatePartsVendorBlock,
  type PartsCatalogItem,
  type PartsCatalogSearchResult,
  type PartsCatalogSearchStreamEvent,
  type PartsRobot,
  type PartsVendor,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PartsRobotDetailsDialog } from "@/components/PartsRobotDetailsDialog";
import { PartsInventoryDetailsDialog } from "@/components/PartsInventoryDetailsDialog";
import {
  PartsImageIdentifyDialog,
  type PartsImageReviewedPart,
} from "@/components/PartsImageIdentifyDialog";

type PageTab = "stockroom" | "find" | "builds";
type Notice = { kind: "success" | "error"; text: string };
type PricedPartsCatalogSearchResult = Omit<PartsCatalogSearchResult, "price" | "currency"> & {
  price: string;
  currency: string;
};
type PartsOrderLine = { product: PricedPartsCatalogSearchResult; quantity: number };

const PARTS_ORDER_DRAFT_KEY = "robotics-parts-order-draft-v1";
const PARTS_REFRESH_INTERVAL_MS = 5_000;

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

function formatApproximateDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.ceil(seconds / 60));
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (totalHours < 24) {
    return minutes === 0
      ? `${totalHours} hour${totalHours === 1 ? "" : "s"}`
      : `${totalHours} hour${totalHours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours === 0
    ? `${days} day${days === 1 ? "" : "s"}`
    : `${days} day${days === 1 ? "" : "s"} ${hours} hour${hours === 1 ? "" : "s"}`;
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
      (line.product.imageUrl === null || typeof line.product.imageUrl === "string"),
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

type GroupedSearchResult = {
  key: string;
  title: string;
  sku: string | null;
  description: string;
  imageUrl: string | null;
  currency: string | null;
  offers: PartsCatalogSearchResult[];
  defaultOffer: PartsCatalogSearchResult;
};

function normalizeGroupText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function searchResultGroupKey(result: PartsCatalogSearchResult): string {
  const sku = result.sku?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (sku) return `sku:${sku}`;
  return `title:${normalizeGroupText(result.title)}`;
}

function searchResultPriceValue(result: PartsCatalogSearchResult): number {
  if (result.price === null) return Number.POSITIVE_INFINITY;
  const value = Number(result.price);
  return Number.isFinite(value) && value >= 0 ? value : Number.POSITIVE_INFINITY;
}

function mergeSearchResults(
  current: PartsCatalogSearchResult[],
  incoming: PartsCatalogSearchResult,
): PartsCatalogSearchResult[] {
  const incomingKey = normalizedProductUrl(incoming.url) ?? incoming.url;
  const existingIndex = current.findIndex(
    (result) => (normalizedProductUrl(result.url) ?? result.url) === incomingKey,
  );
  if (existingIndex === -1) return [...current, incoming];
  return current.map((result, index) => index === existingIndex ? incoming : result);
}

function isOfferInStock(result: PartsCatalogSearchResult): boolean {
  return (result as { inStock?: boolean }).inStock ?? true;
}

function pickDefaultOffer(offers: PartsCatalogSearchResult[]): PartsCatalogSearchResult {
  const sorted = [...offers].sort(
    (left, right) => searchResultPriceValue(left) - searchResultPriceValue(right),
  );
  return sorted.find((offer) => isOfferInStock(offer)) ?? sorted[0];
}

function groupSearchResults(results: PartsCatalogSearchResult[]): GroupedSearchResult[] {
  const groups = new Map<string, PartsCatalogSearchResult[]>();
  for (const result of results) {
    const key = searchResultGroupKey(result);
    const existing = groups.get(key);
    if (existing) existing.push(result);
    else groups.set(key, [result]);
  }
  return [...groups.entries()].map(([key, offers]) => {
    const defaultOffer = pickDefaultOffer(offers);
    const sortedOffers = [...offers].sort(
      (left, right) => searchResultPriceValue(left) - searchResultPriceValue(right),
    );
    return {
      key,
      title: defaultOffer.title,
      sku: defaultOffer.sku,
      description: defaultOffer.description,
      imageUrl: defaultOffer.imageUrl,
      currency: defaultOffer.currency,
      offers: sortedOffers,
      defaultOffer,
    };
  });
}

function normalizedSku(value: string | null): string {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "") ?? "";
}

function normalizedProductUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return null;
  }
}

function catalogItemHasLiveResult(
  item: PartsCatalogItem,
  results: PartsCatalogSearchResult[],
): boolean {
  const itemSku = normalizedSku(item.sku);
  const itemUrl = normalizedProductUrl(item.productUrl);
  const itemName = normalizeGroupText(item.name);
  return results.some((result) => {
    if (result.vendorKey !== item.vendorKey) return false;
    const resultSku = normalizedSku(result.sku);
    return (
      (itemSku !== "" && itemSku === resultSku) ||
      (itemUrl !== null && itemUrl === normalizedProductUrl(result.url)) ||
      (itemSku === "" && resultSku === "" && itemName === normalizeGroupText(result.title))
    );
  });
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

function CatalogSearchCard({ item }: { item: PartsCatalogItem }) {
  return (
    <Card className="border-border bg-card" data-testid={`card-catalog-search-result-${item.id}`}>
      <CardContent className="flex h-full flex-col gap-3 p-4">
        <PartImage
          src={item.imageUrl ?? ""}
          alt={item.name}
          className="h-44 w-full rounded-lg border border-border bg-muted/40 object-contain p-2"
        />
        <div className="min-w-0">
          <h3 className="font-medium text-foreground">{item.name}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{item.vendorName}</Badge>
            {item.sku && <span className="text-xs text-muted-foreground">SKU {item.sku}</span>}
            {item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}
          </div>
          {item.description && (
            <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{item.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-md bg-muted px-2.5 py-1.5 text-foreground">Saved supplier item</span>
            <span className="rounded-md bg-primary/10 px-2.5 py-1.5 text-primary">
              Team stock: {formatQuantity(item.quantityAvailable)} available
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Price and current supplier availability are not included in this saved item.
          </p>
        </div>
        <div className="mt-auto border-t border-border pt-3">
          {item.productUrl ? (
            <a
              href={item.productUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Supplier product page <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          ) : (
            <span className="text-sm text-muted-foreground">No supplier product page saved</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PartCard({
  item,
  robots,
  onSaveStock,
  onSetAllocation,
  onOpenDetails,
  busy,
}: {
  item: PartsCatalogItem;
  robots: { id: string; name: string }[];
  onSaveStock: (item: PartsCatalogItem, quantity: number) => Promise<void>;
  onSetAllocation: (item: PartsCatalogItem, robotId: string, quantity: number) => Promise<void>;
  onOpenDetails: (item: PartsCatalogItem) => void;
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
            <button
              type="button"
              onClick={() => onOpenDetails(item)}
              className="inline-flex min-w-0 items-center gap-1.5 text-left font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Open details for ${item.name}`}
            >
              <span>{item.name}</span>
              <Info size={15} className="shrink-0 text-primary" aria-hidden="true" />
            </button>
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
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

function DraftOrderTray({
  orderDraft,
  draftQuantities,
  orderTotalsByCurrency,
  isOpen,
  onToggle,
  onClear,
  onSetQuantity,
}: {
  orderDraft: PartsOrderLine[];
  draftQuantities: number;
  orderTotalsByCurrency: Record<string, number>;
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
  onSetQuantity: (url: string, quantity: number) => void;
}) {
  return (
    <details open={isOpen} className="parts-disclosure h-fit rounded-xl border border-border bg-card" data-testid="details-parts-order">
      <summary
        aria-expanded={isOpen}
        aria-controls="parts-order-content"
        onClick={(event) => { event.preventDefault(); onToggle(); }}
      >
        <span className="parts-disclosure-trigger">
          <span className="inline-flex items-center gap-2 font-semibold">
            <ShoppingCart size={16} className="text-primary" aria-hidden="true" />
            Order tray <Badge variant="secondary">{formatQuantity(draftQuantities)} items</Badge>
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {Object.entries(orderTotalsByCurrency).map(([currency, total]) => formatMoney(total, currency)).join(" · ") || "No priced items"}
          </span>
        </span>
        <span className="parts-disclosure-cue">{isOpen ? "Hide order" : "View order"} <ChevronDown size={15} aria-hidden="true" /></span>
      </summary>
      <section id="parts-order-content" className="p-3 pt-0" aria-label="Draft order tray">
        <div className="rounded-xl border border-primary/25 bg-card">
          <header className="flex items-start justify-between gap-3 border-b border-border p-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                Draft order <Badge variant="secondary">{formatQuantity(draftQuantities)} items</Badge>
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Saved in this browser. Confirm price, shipping, tax, and availability with the supplier.</p>
            </div>
            {orderDraft.length > 0 && (
              <Button type="button" size="sm" variant="outline" onClick={onClear} aria-label="Clear draft order">
                <Trash2 size={14} aria-hidden="true" /> Clear
              </Button>
            )}
          </header>
          <div className="space-y-3 p-3">
            {orderDraft.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
                Nothing in the tray yet. Add a priced supplier result to start a draft.
              </p>
            ) : (
              <>
                <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
                  {orderDraft.map(({ product, quantity }) => (
                    <article key={product.url} className="flex items-center gap-2 rounded-lg border border-border bg-background p-2">
                      <PartImage src={product.imageUrl ?? ""} alt="" className="size-12 shrink-0 rounded-md border border-border bg-muted object-contain" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{product.title}</p>
                        <p className="text-xs text-muted-foreground">{product.vendorName} · {product.priceIsStartingAt ? "From " : ""}{formatMoney(Number(product.price), product.currency)}</p>
                        <p className="text-sm font-semibold tabular-nums text-foreground">{formatMoney(Number(product.price) * quantity, product.currency)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button type="button" size="icon" variant="outline" className="size-9" aria-label={`Decrease quantity of ${product.title}`} onClick={() => onSetQuantity(product.url, quantity - 1)}>
                          <Minus size={14} aria-hidden="true" />
                        </Button>
                        <span className="w-7 text-center text-sm font-medium tabular-nums" aria-label={`Quantity ${quantity}`}>{quantity}</span>
                        <Button type="button" size="icon" variant="outline" className="size-9" aria-label={`Increase quantity of ${product.title}`} onClick={() => onSetQuantity(product.url, quantity + 1)}>
                          <Plus size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">{Object.keys(orderTotalsByCurrency).length > 1 ? "Subtotal by supplier currency" : "Estimated subtotal"}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    {Object.entries(orderTotalsByCurrency).map(([currency, total]) => (
                      <p key={currency} className="text-lg font-semibold tabular-nums text-foreground">{formatMoney(total, currency)}</p>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Draft only — no supplier order or payment has been submitted.</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    </details>
  );
}

export default function PartsPage() {
  const queryClient = useQueryClient();
  const sessionQuery = useGetSession({
    query: { queryKey: getGetSessionQueryKey() },
  });
  const dashboardQuery = useGetPartsDashboard({
    query: {
      queryKey: getGetPartsDashboardQueryKey(),
      refetchInterval: PARTS_REFRESH_INTERVAL_MS,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
  });
  const [tab, setTab] = useState<PageTab>("stockroom");
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryVendor, setInventoryVendor] = useState("");
  const [pageSize, setPageSize] = useState(100);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState<PartsCatalogSearchResult[]>([]);
  const [lastSearch, setLastSearch] = useState("");
  const [savedSearchOffset, setSavedSearchOffset] = useState(0);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchStatus, setSearchStatus] = useState<"available" | "partial" | "unavailable" | null>(null);
  const [searchError, setSearchError] = useState("");
  const [saveFeedback, setSaveFeedback] = useState<Record<string, {
    status: "pending" | "success" | "error";
    message: string;
  }>>({});
  const searchRunId = useRef(0);
  const [orderDraft, setOrderDraft] = useState<PartsOrderLine[]>(readPartsOrderDraft);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [robotName, setRobotName] = useState("");
  const [customName, setCustomName] = useState("");
  const [customVendor, setCustomVendor] = useState("");
  const [customSku, setCustomSku] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customProductUrl, setCustomProductUrl] = useState("");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [customQuantity, setCustomQuantity] = useState("0");
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [selectedRobot, setSelectedRobot] = useState<PartsRobot | null>(null);
  const [selectedPart, setSelectedPart] = useState<PartsCatalogItem | null>(null);
  const [vendorBlockBusyKey, setVendorBlockBusyKey] = useState<string | null>(null);
  const inventoryTabRef = useRef<HTMLButtonElement>(null);
  const supplierTabRef = useRef<HTMLButtonElement>(null);
  const buildsTabRef = useRef<HTMLButtonElement>(null);
  const [partsOrderOpen, setPartsOrderOpen] = useState(false);
  const [partsTotalsOpen, setPartsTotalsOpen] = useState(false);
  const [partsCoverageOpen, setPartsCoverageOpen] = useState(false);
  const [coverageSourcesOpen, setCoverageSourcesOpen] = useState(false);

  const catalogQuery = useListPartsCatalog({
    search: inventorySearch.trim() || undefined,
    vendorKey: inventoryVendor || undefined,
    inventoryOnly: true,
    limit: pageSize,
    offset: 0,
  }, {
    query: {
      queryKey: getListPartsCatalogQueryKey({
        search: inventorySearch.trim() || undefined,
        vendorKey: inventoryVendor || undefined,
        inventoryOnly: true,
        limit: pageSize,
        offset: 0,
      }),
      refetchInterval: PARTS_REFRESH_INTERVAL_MS,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
    },
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
  const vendorBlockMutation = useUpdatePartsVendorBlock();
  const vendors = dashboardQuery.data?.vendors ?? [];
  const canManageVendors =
    sessionQuery.data?.role === "admin" || sessionQuery.data?.role === "coordinator";
  const availableVendors = vendors.filter((vendor) => !vendor.blocked);
  const robots = dashboardQuery.data?.robots ?? [];
  const catalogItems = catalogQuery.data?.items ?? [];
  const currentlyAdded = new Set(
    catalogItems
      .map((item) => normalizedProductUrl(item.productUrl))
      .filter((url): url is string => Boolean(url)),
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
      queryClient.invalidateQueries({ queryKey: getGetPartsVendorBlocksQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListPartsCatalogQueryKey() }),
    ]);
  };

  const toggleVendorBlock = async (vendor: PartsVendor) => {
    const blocked = !vendor.blocked;
    setNotice(null);
    setVendorBlockBusyKey(vendor.key);
    // Ignore in-flight stream events and clear results tied to the old policy.
    searchRunId.current += 1;
    setSearchBusy(false);
    setSearchResults([]);
    setSearchStatus(null);
    setSearchError("");
    try {
      await vendorBlockMutation.mutateAsync({
        vendorKey: vendor.key,
        data: { blocked },
      });
      await refreshParts();
      setNotice({
        kind: "success",
        text: `${vendor.name} ${blocked ? "blocked from" : "restored to"} supplier search for this team.`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: errorMessage(error, `Unable to ${blocked ? "block" : "unblock"} ${vendor.name}.`),
      });
    } finally {
      setVendorBlockBusyKey(null);
    }
  };

  const syncPublicCatalogs = async () => {
    setNotice(null);
    try {
      const result = await syncMutation.mutateAsync();
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
          ? `A full supplier list is not available for: ${searchOnlyNames.join(", ")}. Those suppliers remain available in product search.`
          : "",
        "A completed feed sync covers only products exposed by that public feed.",
      ].filter(Boolean);
      setNotice({
        kind: synced > 0 ? "success" : "error",
        text: `Supplier list update finished: ${formatQuantity(result.totalItems)} products from ${synced} supplier list(s) (${formatQuantity(result.created)} new, ${formatQuantity(result.updated)} refreshed). ${details.join(" ")}`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        text: errorMessage(error, "Unable to update supplier lists."),
      });
    }
  };

  const runSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (searchText.trim().length < 2) {
      setSearchError("Enter at least two characters.");
      return;
    }
    const query = searchText.trim();
    const runId = ++searchRunId.current;
    setSearchBusy(true);
    setSearchStatus(null);
    setSearchError("");
    setSearchResults([]);
    setSavedSearchOffset(0);
    setLastSearch(query);
    let receivedCompletion = false;
    let receivedResultCount = 0;
    try {
      await consumePartsCatalogSearchStream({ q: query }, (event: PartsCatalogSearchStreamEvent) => {
        if (searchRunId.current !== runId) return;
        if (event.type === "result") {
          receivedResultCount += 1;
          setSearchResults((previous) => mergeSearchResults(previous, event.result));
          return;
        }
        if (event.type !== "complete") return;
        receivedCompletion = true;
        setSearchStatus(event.status);
        if (event.status === "partial") {
          setSearchError(
            `Some suppliers could not be reached: ${event.failedProviderCount} of ${event.providerCount} search providers failed. Verified products found so far are shown below.`,
          );
        } else if (event.status === "unavailable") {
          setSearchError(
            `Supplier search is temporarily unavailable: all ${event.failedProviderCount} search providers could not be reached. Saved product matches may still appear below; try again shortly.`,
          );
        } else if (event.resultCount === 0) {
          setSearchError("No verified supplier products matched this search. Try a broader term or search again.");
        }
      });
      if (!receivedCompletion) {
        throw new Error("Supplier search ended before the completion status arrived.");
      }
    } catch (error) {
      if (searchRunId.current === runId) {
        if (receivedResultCount > 0) {
          setSearchStatus("partial");
          setSearchError(
            `Supplier search ended early. ${receivedResultCount} verified product(s) found so far remain available; more may be missing.`,
          );
        } else {
          setSearchStatus("unavailable");
          setSearchError(
            `${errorMessage(error, "Supplier search is unavailable right now.")} Parts already saved in Stockroom may still appear below.`,
          );
        }
      }
    } finally {
      if (searchRunId.current === runId) setSearchBusy(false);
    }
  };

  const addSearchResultToDraft = (product: PartsCatalogSearchResult) => {
    if (product.price === null || product.currency === null) {
      setNotice({
        kind: "error",
        text: `${product.title} has no verified price, so it cannot be added to the estimated order draft.`,
      });
      return;
    }
    const pricedProduct: PricedPartsCatalogSearchResult = {
      ...product,
      price: product.price,
      currency: product.currency,
    };
    setOrderDraft((previous) => {
      const existing = previous.find((line) => line.product.url === pricedProduct.url);
      return existing
        ? previous.map((line) => line.product.url === pricedProduct.url
          ? { product: pricedProduct, quantity: line.quantity + 1 }
          : line)
        : [...previous, { product: pricedProduct, quantity: 1 }];
    });
    setNotice({ kind: "success", text: `${product.title} added to the draft order. No purchase has been placed.` });
  };

  const setDraftQuantity = (productUrl: string, quantity: number) => {
    setOrderDraft((previous) => previous
      .map((line) => line.product.url === productUrl ? { ...line, quantity } : line)
      .filter((line) => line.quantity > 0));
  };

  const saveSearchResultToInventory = async (product: PartsCatalogSearchResult) => {
    const url = normalizedProductUrl(product.url) ?? product.url;
    setSaveFeedback((previous) => ({
      ...previous,
      [url]: { status: "pending", message: "Adding to Stockroom…" },
    }));
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
      setNotice({ kind: "success", text: `${product.title} added to Stockroom.` });
      setSaveFeedback((previous) => ({
        ...previous,
        [url]: { status: "success", message: "Added to Stockroom." },
      }));
      await refreshParts();
    } catch (error) {
      const message = errorMessage(error, "Unable to add this part to Stockroom.");
      setNotice({ kind: "error", text: message });
      setSaveFeedback((previous) => ({
        ...previous,
        [url]: { status: "error", message },
      }));
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

  const createCustomPart = async (event: FormEvent) => {
    event.preventDefault();
    const name = customName.trim();
    if (!name || !customVendor) {
      setNotice({ kind: "error", text: "Enter a part name and choose a supplier." });
      return;
    }
    const quantity = customQuantity.trim() === "" ? 0 : Number(customQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      setNotice({ kind: "error", text: "Owned quantity must be a non-negative whole number." });
      return;
    }
    try {
      await createItemMutation.mutateAsync({
        data: {
          vendorKey: customVendor,
          name,
          sku: customSku.trim() || null,
          category: customCategory.trim() || null,
          description: customDescription.trim() || null,
          productUrl: customProductUrl.trim() || null,
          imageUrl: customImageUrl.trim() || null,
          quantityOwned: quantity,
        },
      });
      setCustomName("");
      setCustomVendor("");
      setCustomSku("");
      setCustomCategory("");
      setCustomDescription("");
      setCustomProductUrl("");
      setCustomImageUrl("");
      setCustomQuantity("0");
      setCustomDialogOpen(false);
      setNotice({ kind: "success", text: `${name} added to Stockroom.` });
      await refreshParts();
    } catch (error) {
      setNotice({ kind: "error", text: errorMessage(error, "Unable to add this part.") });
    }
  };

  const savePhotoIdentifiedPart = async (part: PartsImageReviewedPart) => {
    if (!vendors.some((vendor) => vendor.key === part.vendorKey)) {
      throw new Error("Choose a supported supplier before saving.");
    }
    try {
      await createItemMutation.mutateAsync({
        data: {
          vendorKey: part.vendorKey,
          name: part.name,
          sku: part.sku || null,
          category: part.category || null,
          description: part.description || null,
          productUrl: null,
          imageUrl: null,
          quantityOwned: part.quantityOwned,
        },
      });
      setNotice({ kind: "success", text: `${part.name} added to Stockroom.` });
      await refreshParts();
    } catch (error) {
      const message = errorMessage(error, "Unable to add this part.");
      setNotice({ kind: "error", text: message });
      throw new Error(message);
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
  const liveResultGroups = groupSearchResults(searchResults);
  const catalogSearchItems = savedCatalogSearchQuery.data?.items ?? [];
  const additionalCatalogSearchItems = catalogSearchItems.filter(
    (item) => !catalogItemHasLiveResult(item, searchResults),
  );
  const closeRobotDetails = useCallback(() => setSelectedRobot(null), []);
  const refreshRobotDashboard = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: getGetPartsDashboardQueryKey() });
  }, [queryClient]);
  const focusPartsTab = (nextTab: PageTab) => {
    setTab(nextTab);
    ({
      stockroom: inventoryTabRef,
      find: supplierTabRef,
      builds: buildsTabRef,
    })[nextTab].current?.focus();
  };
  const handlePartsTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const tabOrder: PageTab[] = ["stockroom", "find", "builds"];
    const currentIndex = tabOrder.indexOf(tab);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusPartsTab(tabOrder[(currentIndex + 1) % tabOrder.length]);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusPartsTab(tabOrder[(currentIndex + tabOrder.length - 1) % tabOrder.length]);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusPartsTab("stockroom");
    } else if (event.key === "End") {
      event.preventDefault();
      focusPartsTab("builds");
    }
  };

  return (
    <main className="parts-workspace min-h-[calc(100dvh-4rem)] space-y-6 bg-background p-4 text-foreground sm:p-6 xl:p-8">
      <div className="mx-auto w-full max-w-[1440px] space-y-6">
        <header className="parts-hero flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="parts-kicker mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.15em]">
              <ShieldCheck size={14} aria-hidden="true" />
              Robotics · parts bench
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Parts</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Track parts your team owns, find supplier parts, and reserve stock for each robot.
            </p>
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
            <div className="parts-tablist flex flex-wrap items-center gap-2" role="tablist" aria-label="Parts views">
              <button
                type="button"
                role="tab"
                id="parts-stockroom-tab"
                ref={inventoryTabRef}
                aria-controls={tab === "stockroom" ? "parts-stockroom-panel" : undefined}
                aria-selected={tab === "stockroom"}
                tabIndex={tab === "stockroom" ? 0 : -1}
                onClick={() => setTab("stockroom")}
                onKeyDown={handlePartsTabKeyDown}
                className={`parts-tab text-sm font-semibold transition-colors ${
                  tab === "stockroom"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Stockroom
              </button>
              <button
                type="button"
                role="tab"
                id="parts-find-tab"
                ref={supplierTabRef}
                aria-controls={tab === "find" ? "parts-supplier-panel" : undefined}
                aria-selected={tab === "find"}
                tabIndex={tab === "find" ? 0 : -1}
                onClick={() => setTab("find")}
                onKeyDown={handlePartsTabKeyDown}
                className={`parts-tab text-sm font-semibold transition-colors ${
                  tab === "find"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Find parts
              </button>
              <button
                type="button"
                role="tab"
                id="parts-builds-tab"
                ref={buildsTabRef}
                aria-controls={tab === "builds" ? "parts-builds-panel" : undefined}
                aria-selected={tab === "builds"}
                tabIndex={tab === "builds" ? 0 : -1}
                onClick={() => setTab("builds")}
                onKeyDown={handlePartsTabKeyDown}
                className={`parts-tab text-sm font-semibold transition-colors ${tab === "builds" ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
              >
                Robot builds
              </button>
            </div>

            {tab === "find" ? (
              <section
                id="parts-supplier-panel"
                role="tabpanel"
                tabIndex={0}
                aria-labelledby="parts-find-tab"
                className="flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Find supplier parts"
              >
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle className="text-base">Find a part across suppliers</CardTitle>
                    <CardDescription>
                      Search supplier pages and parts already saved in your Stockroom. Confirm current price and availability on the supplier&apos;s page.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={runSearch} className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_auto_auto]">
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
                      <Link
                        href="/parts/assistant"
                        className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-md border border-input bg-background px-4 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        data-testid="link-parts-assistant"
                      >
                        <Bot size={16} aria-hidden="true" />
                        Ask Parts Assistant
                      </Link>
                    </form>
                    {searchError && (
                      <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                        <AlertCircle className="mt-0.5 shrink-0" size={16} /> {searchError}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <details open={partsCoverageOpen} className="parts-disclosure order-last rounded-xl border border-border bg-card" data-testid="details-parts-coverage">
                  <summary
                    aria-expanded={partsCoverageOpen}
                    aria-controls="parts-coverage-content"
                    onClick={(event) => { event.preventDefault(); setPartsCoverageOpen((open) => !open); }}
                    data-testid="button-toggle-parts-source-coverage"
                  >
                    <span className="parts-disclosure-trigger">
                    <span className="font-semibold">Supplier updates</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {formatQuantity(vendors.length)} suppliers · {vendors.filter((vendor) => vendor.lastSync?.status === "synced").length} full lists checked
                    </span>
                    </span>
                    <span className="parts-disclosure-cue">
                      {partsCoverageOpen ? "Hide supplier status" : "View supplier status"} <ChevronDown size={15} aria-hidden="true" />
                    </span>
                  </summary>
                  <div id="parts-coverage-content">
                  <Card className="m-3 mt-0 border-border bg-card" data-testid="card-parts-source-coverage">
                    <CardHeader>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <CardTitle className="text-base">Supplier status</CardTitle>
                          <CardDescription className="mt-1 max-w-2xl">
                            A full list means the supplier&apos;s published product list finished loading. Search-only suppliers can still return products, but no full list is available here.
                          </CardDescription>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={syncMutation.isPending}
                          onClick={() => void syncPublicCatalogs()}
                          data-testid="button-sync-parts-suppliers"
                        >
                          {syncMutation.isPending ? <Loader2 className="animate-spin" size={15} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
                          {syncMutation.isPending ? "Checking supplier lists…" : "Update supplier lists"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-foreground" data-testid="status-parts-source-coverage">
                        {vendors.some((item) => item.lastSync)
                          ? `Latest update: ${vendors.filter((item) => item.lastSync?.status === "synced").length} supplier list(s) finished, ${vendors.filter((item) => item.lastSync?.status === "incomplete").length} still loading, ${vendors.filter((item) => item.lastSync?.status === "search_only").length} available through search only, and ${vendors.filter((item) => item.lastSync?.status === "unavailable").length} could not be reached.`
                          : `${vendors.filter((item) => item.coverageState === "feed_sync_required").length} supplier list(s) are ready to check. Other suppliers can be searched, require supplier access, or provide made-to-order work.`}
                      </p>
                      <details open={coverageSourcesOpen} className="parts-disclosure rounded-lg border border-border bg-background">
                        <summary
                          aria-expanded={coverageSourcesOpen}
                          aria-controls="parts-supplier-sources"
                          onClick={(event) => { event.preventDefault(); setCoverageSourcesOpen((open) => !open); }}
                          className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid="button-show-parts-source-coverage"
                        >
                          <span>{coverageSourcesOpen ? "Hide" : "Show"} supplier update details</span>
                          <span className="parts-disclosure-cue">
                            {coverageSourcesOpen ? "Hide suppliers" : "View suppliers"} <ChevronDown size={15} aria-hidden="true" />
                          </span>
                        </summary>
                      <div id="parts-supplier-sources" className="grid gap-2 p-3 pt-0 md:grid-cols-2">
                        {vendors.map((vendor) => {
                          const syncResult = vendor.lastSync;
                          const stateLabel = syncResult
                            ? {
                                synced: "Full list checked",
                                search_only: "Search only",
                                unavailable: "Could not reach supplier",
                                incomplete: "Still loading",
                              }[syncResult.status]
                            : {
                                feed_sync_required: "Ready to check",
                                discovery_only: "Search only",
                                access_restricted: "Supplier access required",
                                custom_fabrication: "Made to order",
                              }[vendor.coverageState];
                          const stateDetail = syncResult?.message ?? {
                            feed_sync_required: "A public supplier list can be checked for saved products.",
                            discovery_only: "Supplier products can be found with search; no full product list is available here.",
                            access_restricted: "A supplier-approved account is needed to load the full list. Public search may still find items.",
                            custom_fabrication: "This supplier makes parts to order instead of listing standard stock items.",
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
                              {vendor.blocked && (
                                <Badge variant="destructive" className="mt-2">
                                  Blocked for this team
                                </Badge>
                              )}
                              <p className="mt-1 text-sm text-muted-foreground">{stateDetail}</p>
                              {vendor.blocked && (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  This supplier is excluded from search and new orders. Parts already saved to Stockroom remain available.
                                </p>
                              )}
                              {syncResult?.status === "incomplete" &&
                                typeof syncResult.remainingPages === "number" &&
                                syncResult.remainingPages > 0 &&
                                typeof syncResult.estimatedSecondsRemaining === "number" &&
                                syncResult.estimatedSecondsRemaining > 0 && (
                                  <p
                                    className="mt-1 text-sm text-muted-foreground"
                                    data-testid={`status-parts-source-eta-${vendor.key}`}
                                  >
                                    Approximate completion estimate: about {formatApproximateDuration(syncResult.estimatedSecondsRemaining)}. Supplier response times and other crawls can affect it.
                                  </p>
                                )}
                              {syncResult && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Checked {new Date(syncResult.checkedAt).toLocaleString()} · {formatQuantity(syncResult.itemCount)} products added
                                </p>
                              )}
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
                              {canManageVendors && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="mt-3"
                                  disabled={vendorBlockMutation.isPending}
                                  onClick={() => void toggleVendorBlock(vendor)}
                                  data-testid={`button-parts-vendor-${vendor.blocked ? "unblock" : "block"}-${vendor.key}`}
                                >
                                  {vendorBlockBusyKey === vendor.key
                                    ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                                    : <ShieldCheck size={14} aria-hidden="true" />}
                                  {vendorBlockBusyKey === vendor.key
                                    ? vendor.blocked ? "Unblocking…" : "Blocking…"
                                    : vendor.blocked ? "Unblock supplier" : "Block supplier"}
                                </Button>
                              )}
                            </article>
                          );
                        })}
                      </div>
                      </details>
                    </CardContent>
                  </Card>
                  </div>
                </details>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]" data-testid="parts-find-results-layout">
                <div className="min-w-0 space-y-4">
                {searchBusy && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin" size={16} /> Searching across 19 suppliers…
                  </div>
                )}
                {!searchBusy && searchStatus && (
                  <p role="status" className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
                    {searchStatus === "available"
                      ? `Search complete. ${liveResultGroups.length} verified supplier result(s) found.`
                      : searchStatus === "partial"
                        ? "Some suppliers could not be reached. Products found so far are still available below."
                        : "Search complete, but suppliers did not return live results. Saved product matches may still appear below."}
                  </p>
                )}

                {lastSearch && savedCatalogSearchQuery.isLoading && (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin" size={16} aria-hidden="true" /> Loading Stockroom matches…
                  </div>
                )}

                {lastSearch && savedCatalogSearchQuery.isError && (
                  <p role="alert" className="text-sm text-destructive">
                    Could not load parts already saved in Stockroom. Live supplier results remain available.
                  </p>
                )}

                {lastSearch && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>
                      {liveResultGroups.length} supplier result(s)
                      {savedCatalogSearchQuery.data
                        ? ` · ${formatQuantity(savedCatalogSearchQuery.data.total)} Stockroom part match(es)`
                        : ""}
                      {` for “${lastSearch}”`}
                    </span>
                    {liveResultGroups.length > 0 && (
                      <span>Confirm final price, options, stock, shipping, and tax with the supplier.</span>
                    )}
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-2" aria-label="Product search results">
                  {liveResultGroups.map((group) => {
                    const result = group.defaultOffer;
                    const alreadyAdded = orderDraft.some((line) => line.product.url === result.url);
                    const resultSaveKey = normalizedProductUrl(result.url) ?? result.url;
                    const saveState = saveFeedback[resultSaveKey];
                    const alreadyInInventory =
                      currentlyAdded.has(resultSaveKey) || saveState?.status === "success";
                    const canAddToDraft = result.price !== null && result.currency !== null;
                    const otherOffers = group.offers.filter((offer) => offer.url !== result.url);
                    return (
                      <Card key={`live-${group.key}`} className="border-border bg-card">
                        <CardContent className="flex h-full flex-col gap-3 p-4">
                          <PartImage
                            src={result.imageUrl ?? ""}
                            alt={result.title}
                            className="h-44 w-full rounded-lg border border-border bg-muted/40 object-contain p-2"
                          />
                          <div className="min-w-0">
                            <h3 className="font-medium text-foreground">{group.title}</h3>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {group.offers.map((offer) => (
                                <Badge
                                  key={offer.url}
                                  variant={offer.url === result.url ? "secondary" : "outline"}
                                  className={isOfferInStock(offer) ? undefined : "opacity-60"}
                                >
                                  {offer.vendorName}
                                  {!isOfferInStock(offer) ? " · out of stock" : ""}
                                </Badge>
                              ))}
                              {group.sku && <span className="text-xs text-muted-foreground">SKU {group.sku}</span>}
                            </div>
                            {group.offers.length > 1 && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {group.offers.length} vendors · showing cheapest{isOfferInStock(result) ? " in-stock" : ""} price
                                {!isOfferInStock(result) ? " · all offers currently out of stock" : ""}
                              </p>
                            )}
                            {group.description && (
                              <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{group.description}</p>
                            )}
                            <p className="mt-3 text-lg font-semibold tabular-nums text-foreground">
                              {canAddToDraft && result.currency
                                ? <>
                                    {result.priceIsStartingAt ? "From " : ""}
                                    {formatMoney(Number(result.price), result.currency)}
                                    <span className="ml-1 text-xs font-normal text-muted-foreground">{result.currency}</span>
                                  </>
                                : "Price not published"}
                            </p>
                          </div>
                          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                              >
                                Supplier page <ArrowUpRight size={14} aria-hidden="true" />
                              </a>
                              {otherOffers.map((offer) => (
                                <a
                                  key={offer.url}
                                  href={offer.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
                                >
                                  {offer.vendorName} <ArrowUpRight size={12} aria-hidden="true" />
                                </a>
                              ))}
                            </span>
                            <span className="ml-auto flex flex-wrap justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={alreadyInInventory || saveState?.status === "pending"}
                                onClick={() => void saveSearchResultToInventory(result)}
                              >
                                {saveState?.status === "pending"
                                  ? <Loader2 className="animate-spin" size={15} />
                                  : alreadyInInventory ? <Check size={15} /> : <Package size={15} />}
                                {alreadyInInventory ? "In Stockroom" : saveState?.status === "pending" ? "Adding…" : "Add to Stockroom"}
                              </Button>
                              <Button
                                size="sm"
                                variant={alreadyAdded ? "secondary" : "default"}
                                disabled={!canAddToDraft}
                                title={!canAddToDraft ? "A verified supplier price is required for the draft subtotal." : undefined}
                                onClick={() => addSearchResultToDraft(result)}
                              >
                                {alreadyAdded ? <Check size={15} /> : <Plus size={15} />}
                                {alreadyAdded ? "Add another" : canAddToDraft ? "Add to draft" : "Price unavailable"}
                              </Button>
                            </span>
                            {saveState && (
                              <span
                                role={saveState.status === "error" ? "alert" : "status"}
                                className={`w-full text-right text-xs ${
                                  saveState.status === "error" ? "text-destructive" : "text-muted-foreground"
                                }`}
                                data-testid={`status-save-search-result-${resultSaveKey}`}
                              >
                                {saveState.message}
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {additionalCatalogSearchItems.map((item) => (
                    <CatalogSearchCard key={`catalog-${item.id}`} item={item} />
                  ))}
                </div>

                {lastSearch &&
                  !searchBusy &&
                  searchStatus !== "unavailable" &&
                  !savedCatalogSearchQuery.isLoading &&
                  !savedCatalogSearchQuery.isError &&
                  liveResultGroups.length === 0 &&
                  additionalCatalogSearchItems.length === 0 && (
                    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-sm text-muted-foreground">
                         No matching supplier parts or Stockroom items were found.
                      </p>
                      {savedCatalogSearchQuery.data?.total === 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          disabled={syncMutation.isPending}
                          onClick={() => void syncPublicCatalogs()}
                          data-testid="button-sync-catalogs-from-search"
                        >
                          {syncMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                          {syncMutation.isPending ? "Updating supplier lists…" : "Update supplier lists"}
                        </Button>
                      )}
                    </div>
                  )}

                {savedCatalogSearchQuery.data && savedCatalogSearchQuery.data.total > 100 && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">
                      Stockroom parts {savedSearchOffset + 1}–{Math.min(savedSearchOffset + 100, savedCatalogSearchQuery.data.total)} of {formatQuantity(savedCatalogSearchQuery.data.total)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={savedSearchOffset === 0 || savedCatalogSearchQuery.isFetching}
                        onClick={() => setSavedSearchOffset((offset) => Math.max(0, offset - 100))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={savedSearchOffset + 100 >= savedCatalogSearchQuery.data.total || savedCatalogSearchQuery.isFetching}
                        onClick={() => setSavedSearchOffset((offset) => offset + 100)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
                </div>
                <aside className="order-first min-w-0 xl:order-none xl:sticky xl:top-5 xl:self-start" aria-label="Draft order tray">
                  <DraftOrderTray
                    orderDraft={orderDraft}
                    draftQuantities={draftQuantities}
                    orderTotalsByCurrency={orderTotalsByCurrency}
                    isOpen={partsOrderOpen}
                    onToggle={() => setPartsOrderOpen((open) => !open)}
                    onClear={() => setOrderDraft([])}
                    onSetQuantity={setDraftQuantity}
                  />
                </aside>
                </div>
              </section>
            ) : tab === "builds" ? (
              <section
                id="parts-builds-panel"
                role="tabpanel"
                tabIndex={0}
                aria-labelledby="parts-builds-tab"
                aria-label="Robot builds"
                className="space-y-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="border-border bg-card">
                  <CardHeader>
                    <p className="text-xs font-semibold uppercase tracking-[.14em] text-primary">Robot builds</p>
                    <h2 className="text-2xl font-semibold tracking-tight">Plan the parts on each robot</h2>
                    <CardDescription>Create a robot, open its parts list, then reserve stock from the Stockroom view.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <form onSubmit={createRobot} className="flex flex-col gap-2 sm:flex-row sm:max-w-xl">
                      <Input
                        value={robotName}
                        onChange={(event) => setRobotName(event.target.value.slice(0, 80))}
                        placeholder="Robot name"
                        aria-label="New robot name"
                        maxLength={80}
                      />
                      <Button type="submit" disabled={createRobotMutation.isPending || !robotName.trim()} data-testid="button-add-parts-robot">
                        {createRobotMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                        Add robot
                      </Button>
                    </form>
                    {robots.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-background px-5 py-10 text-center">
                        <Bot size={24} className="mx-auto text-primary" aria-hidden="true" />
                        <h2 className="mt-3 font-semibold text-foreground">No robot builds yet</h2>
                         <p className="mt-1 text-sm text-muted-foreground">Add a robot above to open its parts list and cost details.</p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {robots.map((robot) => (
                          <button
                            key={robot.id}
                            type="button"
                            onClick={() => setSelectedRobot(robot)}
                            className="group flex min-h-36 flex-col justify-between rounded-xl border border-border bg-background p-4 text-left transition-[border-color,background-color,transform] hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            data-testid={`card-robot-${robot.id}`}
                            aria-label={`Open build details for ${robot.name}`}
                          >
                            <span className="flex items-center justify-between gap-3">
                              <span className="flex min-w-0 items-center gap-2">
                                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Bot size={17} aria-hidden="true" /></span>
                                <span className="truncate text-sm font-semibold text-foreground">{robot.name}</span>
                              </span>
                              <ArrowUpRight size={15} className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                            </span>
                            <span className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-primary">Open build details <ArrowUpRight size={13} aria-hidden="true" /></span>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </section>
            ) : (
              <section
                id="parts-stockroom-panel"
                role="tabpanel"
                tabIndex={0}
                aria-labelledby="parts-stockroom-tab"
                className="flex flex-col gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Stockroom"
              >
                <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add a custom part</DialogTitle>
                      <DialogDescription>
                        Can&apos;t find it in search? Add it manually with a name and supplier.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={createCustomPart} className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">
                        Part name *
                        <Input
                          value={customName}
                          onChange={(event) => setCustomName(event.target.value.slice(0, 250))}
                          placeholder="Custom bracket"
                          className="mt-1"
                          maxLength={250}
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Supplier *
                        <select
                          value={customVendor}
                          onChange={(event) => setCustomVendor(event.target.value)}
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">Choose supplier</option>
                          {VENDOR_GROUPS.map((group) => (
                            <optgroup key={group} label={group}>
                              {availableVendors.filter((vendor) => vendor.group === group).map((vendor) => (
                                <option key={vendor.key} value={vendor.key}>{vendor.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm font-medium">
                        SKU
                        <Input
                          value={customSku}
                          onChange={(event) => setCustomSku(event.target.value.slice(0, 200))}
                          placeholder="Optional"
                          className="mt-1"
                          maxLength={200}
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Category
                        <Input
                          value={customCategory}
                          onChange={(event) => setCustomCategory(event.target.value.slice(0, 200))}
                          placeholder="Optional"
                          className="mt-1"
                          maxLength={200}
                        />
                      </label>
                      <label className="text-sm font-medium sm:col-span-2">
                        Description
                        <Input
                          value={customDescription}
                          onChange={(event) => setCustomDescription(event.target.value.slice(0, 1200))}
                          placeholder="Optional"
                          className="mt-1"
                          maxLength={1200}
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Product URL
                        <Input
                          value={customProductUrl}
                          onChange={(event) => setCustomProductUrl(event.target.value.slice(0, 2000))}
                          placeholder="Must belong to the selected supplier"
                          className="mt-1"
                          inputMode="url"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Image URL
                        <Input
                          value={customImageUrl}
                          onChange={(event) => setCustomImageUrl(event.target.value.slice(0, 2000))}
                          placeholder="https://…"
                          className="mt-1"
                          inputMode="url"
                        />
                      </label>
                      <label className="text-sm font-medium">
                        Owned quantity
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          value={customQuantity}
                          onChange={(event) => setCustomQuantity(event.target.value)}
                          className="mt-1"
                        />
                      </label>
                      <div className="flex items-end gap-2 sm:col-span-2">
                        <Button
                          type="submit"
                          disabled={createItemMutation.isPending || !customName.trim() || !customVendor}
                        >
                          {createItemMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                          Add part
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setCustomDialogOpen(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
                <PartsImageIdentifyDialog
                  open={photoDialogOpen}
                  onOpenChange={setPhotoDialogOpen}
                  vendors={availableVendors}
                  saving={createItemMutation.isPending}
                  onSave={savePhotoIdentifiedPart}
                />
                <details open={partsTotalsOpen} className="parts-disclosure order-last rounded-xl border border-border bg-card" data-testid="details-parts-totals">
                  <summary
                    aria-expanded={partsTotalsOpen}
                    aria-controls="parts-totals-content"
                    onClick={(event) => { event.preventDefault(); setPartsTotalsOpen((open) => !open); }}
                    data-testid="button-toggle-parts-totals"
                  >
                    <span className="parts-disclosure-trigger">
                      <span className="font-semibold">Stock totals</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {formatQuantity(dashboard.summary.catalogItems)} parts in catalog · {formatQuantity(dashboard.summary.availableUnits)} units available
                      </span>
                    </span>
                    <span className="parts-disclosure-cue">{partsTotalsOpen ? "Hide totals" : "View stock totals"} <ChevronDown size={15} aria-hidden="true" /></span>
                  </summary>
                  <section id="parts-totals-content" className="grid gap-3 p-3 pt-0 sm:grid-cols-2 xl:grid-cols-4" aria-label="Parts totals">
                    {[
                      { label: "Parts in catalog", value: dashboard.summary.catalogItems, note: "catalog entries", highlight: false },
                      { label: "Owned units", value: dashboard.summary.ownedUnits, note: "on hand", highlight: false },
                      { label: "Assigned units", value: dashboard.summary.assignedUnits, note: "on robot builds", highlight: false },
                      { label: "Available units", value: dashboard.summary.availableUnits, note: "ready to allocate", highlight: true },
                    ].map((metric) => (
                      <Card key={metric.label} className={`border-border bg-card ${metric.highlight ? "border-primary/35 bg-primary/[.045]" : ""}`}>
                        <CardContent className="p-4">
                          <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">{metric.label}</p>
                          <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatQuantity(metric.value)}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{metric.note}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </section>
                </details>
                <Card className="border-border bg-card" data-testid="card-stockroom-tools">
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">Find a part in your stockroom</CardTitle>
                        <CardDescription>Filter the team’s saved stock, then update quantities or allocate parts to a robot.</CardDescription>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={() => setPhotoDialogOpen(true)} data-testid="button-scan-stockroom-part">
                          <Camera size={14} aria-hidden="true" /> Scan part
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setCustomDialogOpen(true)} data-testid="button-add-stockroom-part">
                          <Plus size={14} aria-hidden="true" /> Add custom part
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="text-sm font-medium">
                        Search stockroom
                        <span className="relative mt-1 block">
                          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                          <Input
                            value={inventorySearch}
                            onChange={(event) => {
                              setInventorySearch(event.target.value);
                              setPageSize(100);
                            }}
                            placeholder="Part name or SKU"
                            aria-label="Search stockroom"
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
                          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="">All suppliers</option>
                          {VENDOR_GROUPS.map((group) => (
                            <optgroup key={group} label={group}>
                              {vendors.filter((vendor) => vendor.group === group).map((vendor) => (
                                <option key={vendor.key} value={vendor.key}>
                                  {vendor.name}{vendor.blocked ? " (blocked for this team)" : ""}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm text-muted-foreground">
                          {catalogQuery.isLoading
                            ? "Loading stockroom…"
                            : `${formatQuantity(catalogItems.length)} shown of ${formatQuantity(catalogQuery.data?.total ?? 0)} saved parts`}
                        </span>
                        {catalogQuery.isError && <span role="alert" className="text-sm text-destructive">Could not load saved parts.</span>}
                      </div>
                      {catalogQuery.data && catalogQuery.data.total > catalogItems.length && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setPageSize((size) => Math.min(size + 100, catalogQuery.data?.total ?? size + 100))}
                          data-testid="button-load-more-stockroom"
                        >
                          Load more parts
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {catalogQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
                    <Loader2 className="animate-spin" size={16} /> Loading Stockroom…
                  </div>
                ) : catalogItems.length === 0 ? (
                  <Card className="border-dashed border-border bg-card">
                    <CardContent className="flex flex-col items-center px-6 py-12 text-center">
                      <span className="rounded-2xl bg-primary/10 p-3 text-primary"><Package size={24} /></span>
                      <h2 className="mt-4 font-semibold text-foreground">No saved parts yet</h2>
                      <p className="mt-1 max-w-md text-sm text-muted-foreground">
                        Search suppliers and save parts here, or add a custom part to start tracking stock.
                      </p>
                      <Button className="mt-4" onClick={() => setTab("find")}>
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
                        onOpenDetails={setSelectedPart}
                        busy={isMutating}
                      />
                    ))}
                  </div>
                )}

              </section>
            )}

          </>
        ) : null}
       </div>
       <PartsRobotDetailsDialog
         robot={selectedRobot}
         onClose={closeRobotDetails}
         onPreviewReplaced={refreshRobotDashboard}
       />
       <PartsInventoryDetailsDialog
         item={selectedPart}
         onClose={() => setSelectedPart(null)}
         onSaved={refreshParts}
       />
    </main>
  );
}
