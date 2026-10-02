import { shouldUseChunkedUpload, uploadChunked } from "@/lib/chunkedUpload";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import {
  AlertCircle,
  ArrowUpRight,
  Download,
  FileUp,
  Image as ImageIcon,
  Loader2,
  PackageOpen,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import {
  useDeletePartsRobotPreview,
  getGetPartsRobotDetailsQueryKey,
  getListPartsCatalogQueryKey,
  useCreatePartsPriceSnapshot,
  useGetPartsRobotDetails,
  useUpdatePartsCatalogCost,
  useUpdatePartsRobotPreview,
  useUploadPartsRobotPreviewFile,
  type PartsPriceSnapshot,
  type PartsRobot,
  type PartsRobotBuildPart,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ChatGlbViewer } from "@/components/ChatGlbViewer";
import { ChatParasolidViewer } from "@/components/ChatParasolidViewer";
import { ChatStlViewer } from "@/components/ChatStlViewer";

type PartsRobotDetailsDialogProps = {
  robot: PartsRobot | null;
  onClose: () => void;
  onPreviewReplaced: () => Promise<void>;
};

type CostFormValue = {
  unitCost: string;
  costCurrency: string;
};

type QuoteFormValue = {
  unitPrice: string;
  currency: string;
  sourceUrl: string;
  isStartingAt: boolean;
};

const SUPPORTED_PREVIEW_ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.glb,.stl,.x_t,.x_b";

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { error?: unknown } } }).response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return fallback;
}

function storageUrl(objectPath: string): string {
  const base = String(import.meta.env.BASE_URL ?? "/").replace(/\/+$/, "");
  const path = objectPath.startsWith("/") ? objectPath : `/${objectPath}`;
  return `${base}/api/storage${path}`;
}

function previewContentType(file: File): string | null {
  const extension = file.name.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  if (extension === "glb") return "model/gltf-binary";
  if (extension === "stl") return "model/stl";
  if (extension === "x_t" || extension === "x_b") return "model/x-parasolid";
  return null;
}

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount === null || currency === null || !Number.isFinite(amount)) return "Cost not saved";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown capture time";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function isImagePreview(contentType: string): boolean {
  return contentType.startsWith("image/");
}

function PreviewPanel({ robot }: { robot: PartsRobot }) {
  const [failed, setFailed] = useState(false);
  const preview = robot.preview;
  useEffect(() => setFailed(false), [preview?.objectPath]);

  if (!preview) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-5 text-center" data-testid={`empty-robot-preview-${robot.id}`}>
        <ImageIcon size={28} className="text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">No preview attached</p>
        <p className="max-w-xs text-xs text-muted-foreground">Add a robot image or CAD file to identify this build at a glance.</p>
      </div>
    );
  }

  const src = storageUrl(preview.objectPath);
  const lowerName = preview.fileName.toLowerCase();
  const downloadLink = (
    <a
      href={src}
      download={preview.fileName}
      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
      data-testid={`link-download-robot-preview-${robot.id}`}
    >
      <Download size={13} aria-hidden="true" />
      Download {preview.fileName}
    </a>
  );

  if (isImagePreview(preview.contentType)) {
    return (
      <div className="space-y-2" data-testid={`preview-robot-image-${robot.id}`}>
        {failed ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 text-center" role="alert" data-testid={`error-robot-preview-image-${robot.id}`}>
            <AlertCircle size={24} className="text-destructive" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">This image could not be displayed.</p>
            {downloadLink}
          </div>
        ) : (
          <img
            src={src}
            alt={`${robot.name} build preview`}
            className="max-h-[22rem] min-h-48 w-full rounded-xl border border-border bg-muted/30 object-contain p-2"
            onError={() => setFailed(true)}
            data-testid={`img-robot-preview-${robot.id}`}
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">{preview.fileName}</span>
          {!failed && downloadLink}
        </div>
      </div>
    );
  }

  if (preview.contentType === "model/gltf-binary" || lowerName.endsWith(".glb")) {
    return <ChatGlbViewer name={preview.fileName} src={src} />;
  }
  if (preview.contentType === "model/stl" || lowerName.endsWith(".stl")) {
    return <ChatStlViewer name={preview.fileName} src={src} />;
  }
  if (preview.contentType === "model/x-parasolid" || lowerName.endsWith(".x_t") || lowerName.endsWith(".x_b")) {
    return <ChatParasolidViewer name={preview.fileName} src={src} />;
  }
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground" role="alert">
      This preview type is not available in the workspace. {downloadLink}
    </div>
  );
}

function SnapshotBadge({ snapshot }: { snapshot: PartsPriceSnapshot }) {
  return (
    <>
      {snapshot.isStale && (
        <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Stale estimate
        </span>
      )}
      {snapshot.isStartingAt && (
        <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
          Starting-at estimate
        </span>
      )}
      {!snapshot.isStale && !snapshot.isStartingAt && (
        <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Captured quote
        </span>
      )}
    </>
  );
}

function BuildPartRow({
  part,
  onSaveCost,
  onSaveSnapshot,
  busy,
}: {
  part: PartsRobotBuildPart;
  onSaveCost: (partId: string, unitCost: number | null, costCurrency: string | null) => Promise<void>;
  onSaveSnapshot: (partId: string, value: QuoteFormValue) => Promise<void>;
  busy: boolean;
}) {
  const costForm = useForm<CostFormValue>({
    defaultValues: {
      unitCost: part.unitCost === null ? "" : String(part.unitCost),
      costCurrency: part.costCurrency ?? "USD",
    },
  });
  const quoteForm = useForm<QuoteFormValue>({
    defaultValues: {
      unitPrice: "",
      currency: part.costCurrency ?? "USD",
      sourceUrl: part.productUrl ?? "",
      isStartingAt: false,
    },
  });
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    costForm.reset({
      unitCost: part.unitCost === null ? "" : String(part.unitCost),
      costCurrency: part.costCurrency ?? "USD",
    });
  }, [part.partId, part.unitCost, part.costCurrency, costForm]);

  const submitCost = async (cost: CostFormValue) => {
    try {
      const trimmed = cost.unitCost.trim();
      if (trimmed === "") {
        await onSaveCost(part.partId, null, null);
        setMessage("Saved cost cleared; total remains unknown.");
        return;
      }
      const amount = Number(trimmed);
      if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 99_999_999.99 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) >= 1e-7 ||
        !/^[A-Z]{3}$/.test(cost.costCurrency)
      ) {
        setMessage("Enter an amount with up to two decimal places and a three-letter currency.");
        return;
      }
      await onSaveCost(part.partId, amount, cost.costCurrency);
      setMessage("Saved cost updated.");
    } catch (error) {
      setMessage(errorMessage(error, "Unable to update the saved cost."));
    }
  };

  const submitQuote = async (quote: QuoteFormValue) => {
    try {
      const amount = Number(quote.unitPrice);
      if (
        !Number.isFinite(amount) ||
        amount < 0 ||
        amount > 99_999_999.99 ||
        Math.abs(amount * 100 - Math.round(amount * 100)) >= 1e-7 ||
        !/^[A-Z]{3}$/.test(quote.currency) ||
        !quote.sourceUrl.trim()
      ) {
        setMessage("Enter a price with up to two decimal places, a currency, and a source URL.");
        return;
      }
      await onSaveSnapshot(part.partId, quote);
      quoteForm.setValue("unitPrice", "");
      setMessage("Quote snapshot saved separately from the saved cost.");
    } catch (error) {
      setMessage(errorMessage(error, "Unable to save the supplier quote."));
    }
  };

  return (
    <article className="rounded-xl border border-border bg-card p-4" data-testid={`row-robot-build-part-${part.partId}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground" data-testid={`text-build-part-name-${part.partId}`}>{part.name}</h3>
            <span className="rounded-md bg-muted px-2 py-1 text-[11px] text-muted-foreground">{part.vendorName}</span>
          </div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
            {part.sku && <span>SKU {part.sku}</span>}
            <span>Quantity {part.quantity}</span>
            {part.productUrl && (
              <a href={part.productUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid={`link-build-part-product-${part.partId}`}>
                Supplier page <ArrowUpRight size={12} aria-hidden="true" />
              </a>
            )}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Saved unit cost</p>
              <p className={`mt-1 text-sm font-semibold ${part.unitCost === null ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`} data-testid={`text-saved-cost-${part.partId}`}>
                {part.unitCost === null ? "Unknown" : formatMoney(part.unitCost, part.costCurrency)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Line total</p>
              <p className={`mt-1 text-sm font-semibold ${part.lineTotal === null ? "text-amber-700 dark:text-amber-300" : "text-foreground"}`} data-testid={`text-line-total-${part.partId}`}>
                {part.lineTotal === null ? "Unknown" : formatMoney(part.lineTotal, part.costCurrency)}
              </p>
            </div>
          </div>
        </div>

        <Form {...costForm}>
          <form onSubmit={costForm.handleSubmit(submitCost)} className="w-full rounded-lg border border-border bg-muted/20 p-3 lg:max-w-[22rem]" data-testid={`form-saved-cost-${part.partId}`}>
            <p className="mb-2 text-xs font-semibold text-foreground">Saved cost basis</p>
            <div className="flex gap-2">
              <Input
                type="number"
                min={0}
                step="0.01"
                {...costForm.register("unitCost")}
                placeholder="Unknown"
                aria-label={`Saved unit cost for ${part.name}`}
                data-testid={`input-saved-cost-${part.partId}`}
                className="h-9 bg-background"
              />
              <Input
                {...costForm.register("costCurrency", {
                  setValueAs: (value: string) => value.toUpperCase().slice(0, 3),
                })}
                aria-label={`Saved cost currency for ${part.name}`}
                data-testid={`input-saved-cost-currency-${part.partId}`}
                className="h-9 w-20 bg-background font-mono uppercase"
                maxLength={3}
              />
              <Button type="submit" size="sm" variant="outline" disabled={busy} data-testid={`button-save-cost-${part.partId}`}>
                {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : "Save"}
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Blank clears the saved cost; it is not treated as zero.</p>
          </form>
        </Form>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-foreground">Supplier quote snapshots</p>
            <p className="text-[11px] text-muted-foreground">Estimates only. They never change the saved cost above.</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)} data-testid={`button-toggle-quotes-${part.partId}`}>
            {expanded ? "Hide quote form" : "Add quote"}
          </Button>
        </div>
        {part.priceSnapshots.length > 0 ? (
          <div className="mt-3 grid gap-2">
            {part.priceSnapshots.map((snapshot) => (
              <div key={snapshot.id} className="flex flex-col gap-2 rounded-lg border border-border/80 bg-background px-3 py-2 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-price-snapshot-${snapshot.id}`}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{formatMoney(snapshot.unitPrice, snapshot.currency)} / unit</span>
                    <SnapshotBadge snapshot={snapshot} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{snapshot.vendorName} · captured {formatDate(snapshot.capturedAt)}</p>
                </div>
                <a href={snapshot.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline" data-testid={`link-snapshot-source-${snapshot.id}`}>
                  View source <ArrowUpRight size={12} aria-hidden="true" />
                </a>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground" data-testid={`empty-price-snapshots-${part.partId}`}>No supplier quotes saved for this part.</p>
        )}
        {expanded && (
          <Form {...quoteForm}>
          <form onSubmit={quoteForm.handleSubmit(submitQuote)} className="mt-3 grid gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 sm:grid-cols-2" data-testid={`form-price-snapshot-${part.partId}`}>
            <Input
              type="number"
              min={0}
              step="0.01"
              {...quoteForm.register("unitPrice")}
              placeholder="Unit price"
              aria-label={`Quote unit price for ${part.name}`}
              data-testid={`input-quote-price-${part.partId}`}
            />
            <Input
              {...quoteForm.register("currency", {
                setValueAs: (value: string) => value.toUpperCase().slice(0, 3),
              })}
              placeholder="Currency"
              aria-label={`Quote currency for ${part.name}`}
              data-testid={`input-quote-currency-${part.partId}`}
              maxLength={3}
            />
            <Input
              {...quoteForm.register("sourceUrl")}
              placeholder="Supplier source URL"
              aria-label={`Quote source URL for ${part.name}`}
              data-testid={`input-quote-source-${part.partId}`}
              className="sm:col-span-2"
              type="url"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                {...quoteForm.register("isStartingAt")}
                data-testid={`checkbox-quote-starting-at-${part.partId}`}
              />
              Mark as starting-at estimate
            </label>
            <Button type="submit" size="sm" disabled={busy} className="sm:justify-self-end" data-testid={`button-save-quote-${part.partId}`}>
              {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : "Save quote snapshot"}
            </Button>
          </form>
          </Form>
        )}
        {message && <p className="mt-2 text-xs text-primary" role="status" data-testid={`status-part-action-${part.partId}`}>{message}</p>}
      </div>
    </article>
  );
}

export function PartsRobotDetailsDialog({ robot, onClose, onPreviewReplaced }: PartsRobotDetailsDialogProps) {
  const queryClient = useQueryClient();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const previewForm = useForm<{ file: File | null }>({ defaultValues: { file: null } });
  const selectedFile = previewForm.watch("file");
  const [previewError, setPreviewError] = useState("");
  const [previewStatus, setPreviewStatus] = useState("");
  const detailsQuery = useGetPartsRobotDetails(robot?.id ?? "", {
    query: {
      enabled: Boolean(robot),
      queryKey: getGetPartsRobotDetailsQueryKey(robot?.id ?? ""),
    },
  });
  const uploadMutation = useUploadPartsRobotPreviewFile();
  const updatePreviewMutation = useUpdatePartsRobotPreview();
  const deletePreviewMutation = useDeletePartsRobotPreview();
  const updateCostMutation = useUpdatePartsCatalogCost();
  const snapshotMutation = useCreatePartsPriceSnapshot();

  useEffect(() => {
    if (!robot) return;
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>("[data-testid='dialog-robot-details']");
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>("button, input, select, a[href], [tabindex]:not([tabindex='-1'])"))
        .filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [robot, onClose]);

  if (!robot) return null;

  const replacePreview = async ({ file }: { file: File | null }) => {
    if (!file) return;
    const contentType = previewContentType(file);
    if (!contentType) {
      setPreviewError("Choose a JPEG, PNG, WebP, GIF, GLB, STL, X_T, or X_B file.");
      return;
    }
    setPreviewError("");
    setPreviewStatus("Uploading private preview…");
    try {
      // Oversized CAD models are sent part-by-part straight to storage so
      // the API never buffers the whole file in memory.
      const objectPath = shouldUseChunkedUpload(file.size)
        ? await uploadChunked(file, file.name, contentType, (done, total) => {
            setPreviewStatus(`Uploading ${Math.round((done / Math.max(total, 1)) * 100)}%`);
          })
        : (await uploadMutation.mutateAsync({
            data: file,
            params: { fileName: file.name, contentType },
          })).objectPath;
      await updatePreviewMutation.mutateAsync({
        robotId: robot.id,
        data: { objectPath, fileName: file.name, contentType },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPartsRobotDetailsQueryKey(robot.id) }),
        onPreviewReplaced(),
      ]);
      previewForm.reset();
      setPreviewStatus("Preview replaced.");
    } catch (error) {
      setPreviewError(errorMessage(error, "Unable to replace the robot preview."));
      setPreviewStatus("");
    }
  };

  const removePreview = async () => {
    if (!window.confirm(`Remove the preview from "${robot.name}"? The robot and its part allocations will remain.`)) {
      return;
    }

    setPreviewError("");
    setPreviewStatus("Removing preview…");
    try {
      await deletePreviewMutation.mutateAsync({ robotId: robot.id });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPartsRobotDetailsQueryKey(robot.id) }),
        onPreviewReplaced(),
      ]);
      setPreviewStatus("Preview removed.");
    } catch (error) {
      setPreviewStatus("");
      setPreviewError(errorMessage(error, "Unable to remove the robot preview."));
    }
  };

  const saveCost = async (partId: string, unitCost: number | null, costCurrency: string | null) => {
    try {
      await updateCostMutation.mutateAsync({ partId, data: { unitCost, costCurrency } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: getGetPartsRobotDetailsQueryKey(robot.id) }),
        queryClient.invalidateQueries({ queryKey: getListPartsCatalogQueryKey() }),
      ]);
    } catch (error) {
      throw new Error(errorMessage(error, "Unable to update the saved cost."));
    }
  };

  const saveSnapshot = async (partId: string, value: QuoteFormValue) => {
    try {
      await snapshotMutation.mutateAsync({
        partId,
        data: {
          unitPrice: Number(value.unitPrice),
          currency: value.currency,
          sourceUrl: value.sourceUrl.trim(),
          isStartingAt: value.isStartingAt,
        },
      });
      await queryClient.invalidateQueries({ queryKey: getGetPartsRobotDetailsQueryKey(robot.id) });
    } catch (error) {
      throw new Error(errorMessage(error, "Unable to save the supplier quote."));
    }
  };

  const isPartBusy = updateCostMutation.isPending || snapshotMutation.isPending;
  const details = detailsQuery.data;
  const currentRobot = details?.robot ?? robot;
  const backdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={backdropClick} data-testid="dialog-backdrop-robot-details">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="robot-details-title"
        className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-2xl sm:max-h-[92dvh] sm:rounded-2xl"
        data-testid="dialog-robot-details"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Build details</p>
            <h2 id="robot-details-title" className="mt-1 truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{robot.name}</h2>
            <p className="mt-1 text-xs text-muted-foreground">Allocated bill of materials, saved costs, and supplier estimates.</p>
          </div>
          <Button ref={closeButtonRef} type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close robot build details" data-testid="button-close-robot-details">
            <X size={18} aria-hidden="true" />
          </Button>
        </header>

        <div className="min-h-0 overflow-y-auto">
          <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.2fr)]">
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Robot preview</h3>
                    <p className="text-xs text-muted-foreground">Private team asset</p>
                  </div>
                  <PackageOpen size={18} className="text-primary" aria-hidden="true" />
                </div>
                <PreviewPanel robot={currentRobot} />
                <Form {...previewForm}>
                  <form onSubmit={previewForm.handleSubmit(replacePreview)} className="mt-4 space-y-2 border-t border-border pt-4" data-testid="form-upload-robot-preview">
                    <label className="block text-xs font-semibold text-foreground" htmlFor="robot-preview-file">Replace preview</label>
                    <input
                      id="robot-preview-file"
                      type="file"
                      accept={SUPPORTED_PREVIEW_ACCEPT}
                      onChange={(event) => {
                        previewForm.setValue("file", event.target.files?.[0] ?? null);
                        setPreviewError("");
                        setPreviewStatus("");
                      }}
                      className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary hover:file:bg-primary/20"
                      data-testid="input-robot-preview-file"
                    />
                    <p className="text-[11px] text-muted-foreground">JPG, PNG, WebP, GIF, GLB, STL, X_T, or X_B.</p>
                    {selectedFile && <p className="truncate text-xs text-foreground" data-testid="text-selected-preview-file">{selectedFile.name}</p>}
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" disabled={!selectedFile || uploadMutation.isPending || updatePreviewMutation.isPending || deletePreviewMutation.isPending} data-testid="button-upload-robot-preview">
                        {uploadMutation.isPending || updatePreviewMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <FileUp size={14} aria-hidden="true" />}
                        {uploadMutation.isPending ? "Uploading…" : updatePreviewMutation.isPending ? "Saving…" : "Upload preview"}
                      </Button>
                      {currentRobot.preview && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => void removePreview()}
                          disabled={uploadMutation.isPending || updatePreviewMutation.isPending || deletePreviewMutation.isPending}
                          className="text-destructive hover:text-destructive"
                          data-testid="button-remove-robot-preview"
                        >
                          {deletePreviewMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Trash2 size={14} aria-hidden="true" />}
                          {deletePreviewMutation.isPending ? "Removing…" : "Remove preview"}
                        </Button>
                      )}
                    </div>
                    {previewStatus && <p className="text-xs text-primary" role="status" data-testid="status-robot-preview">{previewStatus}</p>}
                    {previewError && <p className="flex items-start gap-1.5 text-xs text-destructive" role="alert" data-testid="error-robot-preview">{previewError}</p>}
                  </form>
                </Form>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              {detailsQuery.isLoading && (
                <div className="space-y-3" aria-label="Loading robot build details" data-testid="loading-robot-details">
                  {[1, 2, 3].map((value) => <div key={value} className="h-28 animate-pulse rounded-xl bg-muted" />)}
                </div>
              )}
              {detailsQuery.isError && (
                <div className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4" role="alert" data-testid="error-robot-details">
                  <div className="flex items-center gap-2 text-sm font-semibold text-destructive"><AlertCircle size={17} aria-hidden="true" />Could not load build details.</div>
                  <p className="text-xs text-muted-foreground">The dashboard remains available. Try loading this robot again.</p>
                  <Button type="button" variant="outline" size="sm" onClick={() => void detailsQuery.refetch()} data-testid="button-retry-robot-details"><RefreshCw size={14} aria-hidden="true" />Retry</Button>
                </div>
              )}
              {details && (
                <>
                  <section className="rounded-xl border border-border bg-card p-4 sm:p-5" data-testid="section-robot-cost-summary">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Saved build cost</p>
                        <h3 className="mt-1 text-lg font-semibold text-foreground">Totals by currency</h3>
                      </div>
                      {details.unpricedPartCount > 0 && (
                        <span className="rounded-full border border-amber-400/50 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300" data-testid="status-unpriced-parts">
                          {details.unpricedPartCount} part{details.unpricedPartCount === 1 ? "" : "s"} with unknown cost
                        </span>
                      )}
                    </div>
                    {details.subtotalsByCurrency.length === 0 ? (
                      <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground" data-testid="empty-cost-subtotals">No saved costs are available for this build.</p>
                    ) : (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {details.subtotalsByCurrency.map((subtotal) => (
                          <div key={subtotal.currency} className="rounded-lg bg-primary/10 px-3 py-3" data-testid={`metric-saved-total-${subtotal.currency}`}>
                            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-primary">{subtotal.currency}</p>
                            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{formatMoney(subtotal.amount, subtotal.currency)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="space-y-3" aria-labelledby="allocated-parts-title">
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Allocated BOM</p>
                        <h3 id="allocated-parts-title" className="mt-1 text-lg font-semibold text-foreground">{details.parts.length} part{details.parts.length === 1 ? "" : "s"}</h3>
                      </div>
                    </div>
                    {details.parts.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border bg-card px-4 py-8 text-center" data-testid="empty-robot-parts">
                        <PackageOpen size={26} className="mx-auto text-muted-foreground" aria-hidden="true" />
                        <p className="mt-2 text-sm font-medium text-foreground">No parts allocated yet</p>
                        <p className="mt-1 text-xs text-muted-foreground">Use the allocation controls on the Parts page to add components to this build.</p>
                      </div>
                    ) : (
                      details.parts.map((part) => (
                        <BuildPartRow
                          key={part.partId}
                          part={part}
                          onSaveCost={saveCost}
                          onSaveSnapshot={saveSnapshot}
                          busy={isPartBusy}
                        />
                      ))
                    )}
                  </section>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}