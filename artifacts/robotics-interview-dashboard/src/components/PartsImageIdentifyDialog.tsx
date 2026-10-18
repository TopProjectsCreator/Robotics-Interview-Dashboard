import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, ImagePlus, Loader2, RefreshCw, ScanLine, Upload } from "lucide-react";
import {
  useIdentifyPartsImage,
  type PartsImageIdentification,
  type PartsImageIdentificationInput,
  type PartsVendor,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const HEIC_IMAGE_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);
const HEIC_CONVERSION_ERROR =
  "This HEIC/HEIF photo could not be converted. Try again, choose another photo, or continue with manual entry.";

type ReviewedPart = {
  name: string;
  vendorKey: string;
  sku: string;
  category: string;
  description: string;
  quantityOwned: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vendors: PartsVendor[];
  saving?: boolean;
  onSave: (part: ReviewedPart) => Promise<void>;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Could not identify this image. Try again or add the part manually.";
}

function isHeicPhoto(file: File): boolean {
  return HEIC_IMAGE_TYPES.has(file.type.toLowerCase()) || /\.(heic|heif)$/i.test(file.name);
}

async function prepareImage(file: File): Promise<Blob> {
  if (!isHeicPhoto(file)) return file;

  try {
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    const jpeg = Array.isArray(converted) ? converted[0] : converted;
    if (!(jpeg instanceof Blob) || jpeg.size === 0) throw new Error("No converted image was returned");
    if (jpeg.size > MAX_IMAGE_BYTES) {
      throw new Error("The converted JPEG is larger than 3 MiB. Choose a smaller photo.");
    }
    return new Blob([jpeg], { type: "image/jpeg" });
  } catch (conversionError) {
    if (conversionError instanceof Error && conversionError.message.includes("larger than 3 MiB")) {
      throw conversionError;
    }
    throw new Error(HEIC_CONVERSION_ERROR);
  }
}

async function encodeImage(image: Blob): Promise<PartsImageIdentificationInput> {
  const bytes = new Uint8Array(await image.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return {
    contentType: image.type as PartsImageIdentificationInput["contentType"],
    imageBase64: window.btoa(binary),
  };
}

export function PartsImageIdentifyDialog({
  open,
  onOpenChange,
  vendors,
  saving = false,
  onSave,
}: Props) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const photoSelection = useRef(0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preparedPhoto, setPreparedPhoto] = useState<Blob | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState<PartsImageIdentification | null>(null);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [vendorKey, setVendorKey] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [saveError, setSaveError] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const identifyMutation = useIdentifyPartsImage();

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => () => {
    photoSelection.current += 1;
  }, []);

  const reset = () => {
    photoSelection.current += 1;
    setPhoto(null);
    setPreparedPhoto(null);
    setPreparingPhoto(false);
    setPreviewUrl("");
    setResult(null);
    setError("");
    setName("");
    setVendorKey("");
    setSku("");
    setCategory("");
    setDescription("");
    setQuantity("0");
    setSaveError("");
    setManualMode(false);
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const choosePhoto = async (file: File | undefined) => {
    if (!file) return;
    const isHeic = isHeicPhoto(file);
    if (!isHeic && !ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setError("Choose a JPEG, PNG, WebP, HEIC, or HEIF image. Other formats are not supported.");
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setError("Choose an image that is smaller than 3 MiB.");
      return;
    }
    const selectionId = ++photoSelection.current;
    setPhoto(file);
    setPreparedPhoto(null);
    setPreviewUrl("");
    setPreparingPhoto(isHeic);
    setResult(null);
    setError("");
    setSaveError("");
    setName("");
    setVendorKey("");
    setSku("");
    setCategory("");
    setDescription("");
    setQuantity("0");
    setManualMode(false);
    if (!isHeic) {
      setPreparedPhoto(file);
      setPreviewUrl(URL.createObjectURL(file));
      return;
    }

    try {
      const prepared = await prepareImage(file);
      if (photoSelection.current !== selectionId) return;
      setPreparedPhoto(prepared);
      setPreviewUrl(URL.createObjectURL(prepared));
    } catch (preparationError) {
      if (photoSelection.current === selectionId) {
        setError(errorMessage(preparationError));
      }
    } finally {
      if (photoSelection.current === selectionId) setPreparingPhoto(false);
    }
  };

  const analyzePhoto = async () => {
    if (!photo || preparingPhoto || identifyMutation.isPending) return;
    const selectionId = photoSelection.current;
    setError("");
    setSaveError("");
    try {
      let image = preparedPhoto;
      if (!image) {
        setPreparingPhoto(true);
        image = await prepareImage(photo);
        if (photoSelection.current !== selectionId) return;
        setPreparedPhoto(image);
        setPreviewUrl(URL.createObjectURL(image));
      }
      const data = await encodeImage(image);
      if (photoSelection.current !== selectionId) return;
      const identified = await identifyMutation.mutateAsync({ data });
      if (photoSelection.current !== selectionId) return;
      setResult(identified);
      setName(identified.name);
      setSku(identified.sku ?? "");
      setCategory(identified.category ?? "");
      setDescription(identified.description ?? "");
      setVendorKey("");
    } catch (identifyError) {
      if (photoSelection.current === selectionId) setError(errorMessage(identifyError));
    } finally {
      if (photoSelection.current === selectionId) setPreparingPhoto(false);
    }
  };

  const submitReviewedPart = async (event: FormEvent) => {
    event.preventDefault();
    const ownedQuantity = quantity.trim() === "" ? Number.NaN : Number(quantity);
    if (!name.trim() || !vendorKey) {
      setSaveError("Enter a part name and choose a supported supplier.");
      return;
    }
    if (!Number.isInteger(ownedQuantity) || ownedQuantity < 0) {
      setSaveError("Owned quantity must be a non-negative whole number.");
      return;
    }
    setSaveError("");
    try {
      await onSave({
        name: name.trim(),
        vendorKey,
        sku: sku.trim(),
        category: category.trim(),
        description: description.trim(),
        quantityOwned: ownedQuantity,
      });
      changeOpen(false);
    } catch (saveFailure) {
      setSaveError(errorMessage(saveFailure));
    }
  };

  const useManualEntry = () => {
    setManualMode(true);
  };

  const suggested = Boolean(result?.identified);
  const quantityValue = quantity.trim() === "" ? Number.NaN : Number(quantity);
  const canSave = Boolean(
    (suggested || manualMode) &&
    name.trim() &&
    vendorKey &&
    Number.isInteger(quantityValue) &&
    quantityValue >= 0 &&
    !identifyMutation.isPending
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="w-[calc(100%-1rem)] max-w-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Identify a part from a photo</DialogTitle>
          <DialogDescription>
            Get a visual suggestion, review every field, and confirm the quantity before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <section aria-label="Part photo" className="space-y-3">
            <input
              ref={cameraInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.heic,.heif"
              capture="environment"
              className="sr-only"
              aria-label="Capture a part photo"
              disabled={identifyMutation.isPending}
              onChange={(event) => {
                choosePhoto(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <input
              ref={uploadInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/heic-sequence,image/heif-sequence,.heic,.heif"
              className="sr-only"
              aria-label="Upload a part photo"
              disabled={identifyMutation.isPending}
              onChange={(event) => {
                choosePhoto(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => cameraInput.current?.click()}
                disabled={identifyMutation.isPending}
              >
                <Camera size={16} aria-hidden="true" /> Use camera
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => uploadInput.current?.click()}
                disabled={identifyMutation.isPending}
              >
                <Upload size={16} aria-hidden="true" /> Upload photo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, HEIC, or HEIF; maximum 3 MiB. HEIC/HEIF photos are converted to JPEG for analysis. Photos are temporary and are not saved to inventory.</p>
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={`Selected part photo: ${photo?.name ?? "uploaded image"}`}
                className="max-h-64 w-full rounded-lg border border-border bg-muted object-contain"
              />
            ) : (
              <Card className="border-dashed border-border bg-card">
                <CardContent className="flex min-h-40 flex-col items-center justify-center gap-2 p-5 text-center text-sm text-muted-foreground">
                  <ImagePlus size={24} aria-hidden="true" />
                  Choose a clear photo with the part and any markings visible.
                </CardContent>
              </Card>
            )}
            <Button
              type="button"
              onClick={analyzePhoto}
              disabled={!photo || preparingPhoto || identifyMutation.isPending}
              className="w-full"
            >
              {preparingPhoto
                ? <><Loader2 size={16} className="animate-spin" /> Preparing photo…</>
                : identifyMutation.isPending
                ? <><Loader2 size={16} className="animate-spin" /> Analyzing image…</>
                : <><ScanLine size={16} /> {error ? "Retry identification" : "Identify part"}</>}
            </Button>
            {preparingPhoto && (
              <p role="status" className="text-sm text-muted-foreground">Preparing a temporary JPEG preview. The original photo is not saved.</p>
            )}
            {identifyMutation.isPending && (
              <p role="status" className="text-sm text-muted-foreground">Analyzing the selected photo. No inventory changes are being made.</p>
            )}
          </section>

          <section aria-label="Review suggested part details" className="min-w-0 space-y-3">
            {error && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error} You can retry with this photo or use manual entry.
              </div>
            )}
            {result && !result.identified && (
              <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
                <p className="font-medium">The photo is unclear</p>
                <p className="mt-1 text-muted-foreground">{result.uncertaintyReason ?? "No part could be identified confidently."} Try a closer, brighter photo or use manual entry.</p>
              </div>
            )}
            {manualMode && !result?.identified && (
              <div role="status" className="rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground">
                <p className="font-medium">Manual part details</p>
                <p className="mt-1 text-muted-foreground">
                  {previewUrl
                    ? "Your selected photo stays here for reference and will not be saved to inventory."
                    : "The selected photo could not be previewed; it will not be saved to inventory."}
                </p>
              </div>
            )}
            {(result?.identified || manualMode) && (
              <>
                {result?.identified && (
                  <div role="status" className="rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground">
                    <p className="font-medium">
                      Visual suggestion · {result.uncertainty} uncertainty
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {result.uncertaintyReason ?? "This is an AI suggestion, not confirmation of the manufacturer or exact product."}
                      {" "}Check and edit all fields. Select the supplier yourself.
                    </p>
                  </div>
                )}
                <form onSubmit={submitReviewedPart} className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-medium sm:col-span-2">
                    Part name *
                    <Input value={name} maxLength={250} onChange={(event) => setName(event.target.value)} className="mt-1" required />
                  </label>
                  <label className="text-sm font-medium sm:col-span-2">
                    Supplier *
                    <select
                      value={vendorKey}
                      onChange={(event) => setVendorKey(event.target.value)}
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      required
                    >
                      <option value="">Choose a supported supplier</option>
                      {vendors.map((vendor) => <option key={vendor.key} value={vendor.key}>{vendor.name}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium">
                    Possible SKU (check label)
                    <Input value={sku} maxLength={200} onChange={(event) => setSku(event.target.value)} className="mt-1" />
                  </label>
                  <label className="text-sm font-medium">
                    Category
                    <Input value={category} maxLength={200} onChange={(event) => setCategory(event.target.value)} className="mt-1" />
                  </label>
                  <label className="text-sm font-medium sm:col-span-2">
                    Description
                    <Input value={description} maxLength={1200} onChange={(event) => setDescription(event.target.value)} className="mt-1" />
                  </label>
                  <label className="text-sm font-medium">
                    Owned quantity *
                    <Input
                      type="number"
                      min={0}
                      step={1}
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      className="mt-1"
                      required
                    />
                  </label>
                  {saveError && <p role="alert" className="text-sm text-destructive sm:col-span-2">{saveError}</p>}
                  <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                    <Button type="submit" disabled={!canSave || saving}>
                      {saving ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
                      {saving ? "Saving part…" : "Save reviewed part"}
                    </Button>
                  </div>
                </form>
              </>
            )}
            {((result && !result.identified) || error) && !manualMode && (
              <Button type="button" variant="outline" onClick={useManualEntry}>
                Continue in manual entry
              </Button>
            )}
            {!result && !error && (
              <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                Suggestions appear here after analysis. Nothing is saved until you review and choose “Save reviewed part.”
              </p>
            )}
            {result && (
              <Button type="button" variant="ghost" onClick={analyzePhoto} disabled={!photo || identifyMutation.isPending}>
                <RefreshCw size={15} aria-hidden="true" /> Analyze this photo again
              </Button>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ReviewedPart as PartsImageReviewedPart };
