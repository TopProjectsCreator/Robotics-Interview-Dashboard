import { useEffect, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Loader2, Package } from "lucide-react";
import {
  getGetPartsCatalogDetailsQueryKey,
  getListPartsCatalogQueryKey,
  useGetPartsCatalogDetails,
  useUpdatePartsCatalogDetails,
  type PartsCatalogItem,
} from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !currency) return "No saved unit cost";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString();
}

export function PartsInventoryDetailsDialog({
  item,
  onClose,
  onSaved,
}: {
  item: PartsCatalogItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const queryClient = useQueryClient();
  const open = item !== null;
  const detailsQuery = useGetPartsCatalogDetails(item?.id ?? "", {
    query: {
      queryKey: getGetPartsCatalogDetailsQueryKey(item?.id ?? ""),
      enabled: open,
      staleTime: 0,
    },
  });
  const updateMutation = useUpdatePartsCatalogDetails();
  const details = detailsQuery.data;
  const current = details?.item ?? item;
  const [imageUrl, setImageUrl] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [costCurrency, setCostCurrency] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [inventoryNotes, setInventoryNotes] = useState("");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!details) return;
    setImageUrl(details.item.imageUrl ?? "");
    setUnitCost(details.item.unitCost == null ? "" : String(details.item.unitCost));
    setCostCurrency(details.item.costCurrency ?? "");
    setStorageLocation(details.item.storageLocation ?? "");
    setInventoryNotes(details.item.inventoryNotes ?? "");
    setFeedback(null);
  }, [details]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!item) return;
    const amount = unitCost.trim() ? Number(unitCost) : null;
    const currency = costCurrency.trim().toUpperCase() || null;
    if (
      (amount === null) !== (currency === null) ||
      (amount !== null && (!Number.isFinite(amount) || amount < 0 || amount > 99_999_999.99)) ||
      (currency !== null && !/^[A-Z]{3}$/.test(currency))
    ) {
      setFeedback({ kind: "error", text: "Enter a valid saved cost and three-letter currency together, or clear both." });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        partId: item.id,
        data: {
          imageUrl: imageUrl.trim() || null,
          unitCost: amount,
          costCurrency: currency,
          storageLocation: storageLocation.trim() || null,
          inventoryNotes: inventoryNotes.trim() || null,
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPartsCatalogDetailsQueryKey(item.id) }),
        queryClient.invalidateQueries({ queryKey: getListPartsCatalogQueryKey() }),
      ]);
      await onSaved();
      setFeedback({ kind: "success", text: "Part details saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save part details.";
      setFeedback({ kind: "error", text: message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto border-border bg-background text-foreground">
        {current && (
          <>
            <DialogHeader>
              <DialogTitle>{current.name}</DialogTitle>
              <DialogDescription>
                Review product details, saved inventory cost, supplier quotes, and this team’s storage notes.
              </DialogDescription>
            </DialogHeader>

            {detailsQuery.isLoading ? (
              <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="animate-spin" size={16} aria-hidden="true" />
                Loading part details…
              </div>
            ) : detailsQuery.isError ? (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                Could not load the saved part details. Close and reopen this dialog to try again.
              </p>
            ) : details ? (
              <>
                <section className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                  {details.item.imageUrl ? (
                    <img
                      src={details.item.imageUrl}
                      alt={details.item.name}
                      className="h-56 w-full rounded-lg border border-border bg-muted/40 object-contain p-3"
                    />
                  ) : (
                    <div className="flex h-56 items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground" role="img" aria-label="Part image unavailable">
                      <Package size={30} aria-hidden="true" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{details.item.vendorName}</Badge>
                      {details.item.category && <Badge variant="outline">{details.item.category}</Badge>}
                    </div>
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-muted-foreground">Part ID</dt>
                        <dd className="break-all font-mono text-xs">{details.item.id}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">SKU</dt>
                        <dd>{details.item.sku || "Not recorded"}</dd>
                      </div>
                    </dl>
                    <div>
                      <h3 className="text-xs font-medium text-muted-foreground">Supplier product description</h3>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{details.item.description || "No supplier description saved."}</p>
                    </div>
                    {details.item.productUrl && (
                      <a
                        href={details.item.productUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Supplier product page <ArrowUpRight size={14} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </section>

                <section className="rounded-lg border border-border bg-card p-4">
                  <h3 className="font-medium">Supplier quote history</h3>
                  {details.priceSnapshots.length === 0 ? (
                    <p className="mt-2 text-sm text-muted-foreground">No supplier quotes have been saved for this part.</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {details.priceSnapshots.map((quote) => (
                        <li key={quote.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-3 text-sm">
                          <div>
                            <strong>{formatMoney(quote.unitPrice, quote.currency)}</strong>
                            {quote.isStartingAt && <span className="ml-2 text-xs text-muted-foreground">starting at</span>}
                            <p className="text-xs text-muted-foreground">
                              {quote.vendorName} · {formatDate(quote.capturedAt)}
                              {quote.isStale ? " · Stale quote" : ""}
                            </p>
                          </div>
                          <a href={quote.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                            Source
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Quotes are historical supplier observations. They do not change the saved unit cost below.
                  </p>
                </section>

                <form className="space-y-4" onSubmit={(event) => void save(event)}>
                  <section className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <h3 className="font-medium">Saved inventory details</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        These values are saved for your team and remain separate from supplier search results.
                      </p>
                    </div>
                    <label className="text-sm font-medium">
                      Saved unit cost
                      <Input
                        type="number"
                        min="0"
                        max="99999999.99"
                        step="0.01"
                        value={unitCost}
                        onChange={(event) => setUnitCost(event.target.value)}
                        className="mt-1 bg-background"
                        aria-label="Saved unit cost"
                      />
                    </label>
                    <label className="text-sm font-medium">
                      Currency
                      <Input
                        value={costCurrency}
                        onChange={(event) => setCostCurrency(event.target.value.slice(0, 3).toUpperCase())}
                        maxLength={3}
                        placeholder="USD"
                        className="mt-1 bg-background"
                        aria-label="Saved cost currency"
                      />
                    </label>
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Current saved cost: {formatMoney(details.item.unitCost, details.item.costCurrency)}
                    </p>
                    <label className="text-sm font-medium sm:col-span-2">
                      Product image URL
                      <Input
                        type="url"
                        value={imageUrl}
                        onChange={(event) => setImageUrl(event.target.value)}
                        placeholder="https://…"
                        className="mt-1 bg-background"
                        aria-label="Product image URL"
                      />
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">
                      Storage location
                      <Input
                        list={`parts-storage-locations-${details.item.id}`}
                        value={storageLocation}
                        onChange={(event) => setStorageLocation(event.target.value)}
                        maxLength={120}
                        placeholder="Choose or enter a location"
                        className="mt-1 bg-background"
                        aria-label="Storage location"
                      />
                      <datalist id={`parts-storage-locations-${details.item.id}`}>
                        {details.locations.map((location) => <option key={location} value={location} />)}
                      </datalist>
                    </label>
                    <label className="text-sm font-medium sm:col-span-2">
                      Inventory notes
                      <Textarea
                        value={inventoryNotes}
                        onChange={(event) => setInventoryNotes(event.target.value)}
                        maxLength={2000}
                        rows={4}
                        placeholder="Team-specific notes about this part…"
                        className="mt-1 bg-background"
                        aria-label="Inventory notes"
                      />
                      <span className="mt-1 block text-xs font-normal text-muted-foreground">
                        Separate from the supplier’s product description.
                      </span>
                    </label>
                  </section>
                  {feedback && (
                    <p role={feedback.kind === "error" ? "alert" : "status"} className={`text-sm ${feedback.kind === "error" ? "text-destructive" : "text-primary"}`}>
                      {feedback.text}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>Close</Button>
                    <Button type="submit" disabled={updateMutation.isPending}>
                      {updateMutation.isPending && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
                      Save details
                    </Button>
                  </div>
                </form>
              </>
            ) : null}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
