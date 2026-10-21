import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Loader2, ScanLine } from "lucide-react";
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
const CAMERA_CAPTURE_SIZES = [
  { maxWidth: 1280, maxHeight: 960, quality: 0.82 },
  { maxWidth: 960, maxHeight: 720, quality: 0.72 },
  { maxWidth: 640, maxHeight: 480, quality: 0.62 },
] as const;

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

type CameraStatus = "idle" | "loading" | "ready" | "error";

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Could not identify this frame. Try another capture or add the part manually.";
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof Error ? error.name : "";
  if (name === "CameraUnsupportedError") {
    return "This browser cannot access a live camera. Try a supported browser or continue with manual entry.";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera access was blocked. Allow camera access in your browser’s site settings, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found. Connect or enable a camera, then try again.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is busy or unavailable. Close other apps using it, then try again.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "The camera could not use the requested settings. Try again or use manual entry.";
  }
  return "The camera could not be started. Check its connection and browser permissions, then try again.";
}

function cameraFrameToBlob(video: HTMLVideoElement): Promise<Blob> {
  if (!video.videoWidth || !video.videoHeight) {
    return Promise.reject(new Error("The camera preview is not ready yet. Wait a moment and try again."));
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    return Promise.reject(new Error("This browser could not capture a camera frame. Try another browser."));
  }

  const { videoWidth, videoHeight } = video;
  const encode = (quality: number) => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("This browser could not encode the camera frame. Try another capture."));
        return;
      }
      resolve(blob);
    }, "image/jpeg", quality);
  });

  return (async () => {
    for (const size of CAMERA_CAPTURE_SIZES) {
      const scale = Math.min(1, size.maxWidth / videoWidth, size.maxHeight / videoHeight);
      canvas.width = Math.max(1, Math.round(videoWidth * scale));
      canvas.height = Math.max(1, Math.round(videoHeight * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = await encode(size.quality);
      if (image.size > 0 && image.size <= MAX_IMAGE_BYTES) {
        return new Blob([image], { type: "image/jpeg" });
      }
    }
    throw new Error("The captured frame is too large to analyze. Move closer to the part and try again.");
  })();
}

async function encodeImage(image: Blob): Promise<PartsImageIdentificationInput> {
  if (image.type !== "image/jpeg" || image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    throw new Error("The captured frame is not a supported size. Try another capture.");
  }
  const bytes = new Uint8Array(await image.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return {
    contentType: "image/jpeg",
    imageBase64: window.btoa(binary),
  };
}

function stopStream(stream: MediaStream) {
  stream.getTracks().forEach((track) => track.stop());
}

function resetReviewFields(setters: {
  setResult: (value: PartsImageIdentification | null) => void;
  setError: (value: string) => void;
  setName: (value: string) => void;
  setVendorKey: (value: string) => void;
  setSku: (value: string) => void;
  setCategory: (value: string) => void;
  setDescription: (value: string) => void;
  setQuantity: (value: string) => void;
  setSaveError: (value: string) => void;
  setManualMode: (value: boolean) => void;
}) {
  setters.setResult(null);
  setters.setError("");
  setters.setName("");
  setters.setVendorKey("");
  setters.setSku("");
  setters.setCategory("");
  setters.setDescription("");
  setters.setQuantity("0");
  setters.setSaveError("");
  setters.setManualMode(false);
}

export function PartsImageIdentifyDialog({
  open,
  onOpenChange,
  vendors,
  saving = false,
  onSave,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRequestId = useRef(0);
  const scanAttempt = useRef(0);
  const scanningRef = useRef(false);
  const [cameraRetry, setCameraRetry] = useState(0);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [cameraError, setCameraError] = useState("");
  const [capturing, setCapturing] = useState(false);
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

  const stopCurrentCamera = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (videoRef.current?.srcObject === stream) videoRef.current.srcObject = null;
    if (stream) stopStream(stream);
  }, []);

  useEffect(() => {
    if (!open) return;

    const requestId = ++cameraRequestId.current;
    let active = true;
    let requestedStream: MediaStream | null = null;
    let handleTrackEnded: (() => void) | null = null;
    setCameraStatus("loading");
    setCameraError("");

    const connectCamera = async () => {
      try {
        const mediaDevices = navigator.mediaDevices;
        if (!mediaDevices?.getUserMedia) {
          const unsupported = new Error("Live camera access is unavailable");
          unsupported.name = "CameraUnsupportedError";
          throw unsupported;
        }

        requestedStream = await mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (!active || requestId !== cameraRequestId.current) {
          stopStream(requestedStream);
          return;
        }

        const activeStream = requestedStream;
        streamRef.current = activeStream;
        handleTrackEnded = () => {
          if (!active || requestId !== cameraRequestId.current) return;
          setCameraError("The camera stopped unexpectedly. Reconnect it, then try again or continue with manual entry.");
          setCameraStatus("error");
          if (streamRef.current === activeStream) {
            streamRef.current = null;
            stopStream(activeStream);
            if (videoRef.current?.srcObject === activeStream) videoRef.current.srcObject = null;
          }
        };
        activeStream.getVideoTracks().forEach((track) => {
          track.addEventListener("ended", handleTrackEnded as EventListener, { once: true });
        });
        const video = videoRef.current;
        if (!video) throw new Error("The camera preview could not be opened.");
        video.srcObject = activeStream;
        await video.play();
        if (active && requestId === cameraRequestId.current) setCameraStatus("ready");
      } catch (cameraFailure) {
        if (!active || requestId !== cameraRequestId.current) return;
        const failedStream = requestedStream;
        if (failedStream) {
          if (handleTrackEnded) {
            failedStream.getVideoTracks().forEach((track) => {
              track.removeEventListener("ended", handleTrackEnded as EventListener);
            });
          }
          if (streamRef.current === failedStream) streamRef.current = null;
          stopStream(failedStream);
        }
        if (videoRef.current?.srcObject === failedStream) videoRef.current.srcObject = null;
        setCameraError(cameraErrorMessage(cameraFailure));
        setCameraStatus("error");
      }
    };

    void connectCamera();

    return () => {
      active = false;
      cameraRequestId.current += 1;
      if (requestedStream && handleTrackEnded) {
        requestedStream.getVideoTracks().forEach((track) => {
          track.removeEventListener("ended", handleTrackEnded as EventListener);
        });
      }
      if (requestedStream && streamRef.current === requestedStream) {
        streamRef.current = null;
        stopStream(requestedStream);
      }
      if (videoRef.current?.srcObject === requestedStream) videoRef.current.srcObject = null;
    };
  }, [open, cameraRetry]);

  const reset = () => {
    cameraRequestId.current += 1;
    stopCurrentCamera();
    scanAttempt.current += 1;
    scanningRef.current = false;
    setCapturing(false);
    resetReviewFields({
      setResult,
      setError,
      setName,
      setVendorKey,
      setSku,
      setCategory,
      setDescription,
      setQuantity,
      setSaveError,
      setManualMode,
    });
  };

  const changeOpen = (nextOpen: boolean) => {
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  const captureAndIdentify = useCallback(async () => {
    if (cameraStatus !== "ready" || scanningRef.current || identifyMutation.isPending) return;
    const attempt = ++scanAttempt.current;
    scanningRef.current = true;
    setCapturing(true);
    resetReviewFields({
      setResult,
      setError,
      setName,
      setVendorKey,
      setSku,
      setCategory,
      setDescription,
      setQuantity,
      setSaveError,
      setManualMode,
    });

    try {
      const video = videoRef.current;
      if (!video) throw new Error("The camera preview is unavailable. Try restarting the camera.");
      const frame = await cameraFrameToBlob(video);
      const data = await encodeImage(frame);
      if (scanAttempt.current !== attempt) return;
      const identified = await identifyMutation.mutateAsync({ data });
      if (scanAttempt.current !== attempt) return;
      setResult(identified);
      setName(identified.identified ? identified.name : "");
      setSku(identified.identified ? identified.sku ?? "" : "");
      setCategory(identified.identified ? identified.category ?? "" : "");
      setDescription(identified.identified ? identified.description ?? "" : "");
    } catch (identifyError) {
      if (scanAttempt.current === attempt) setError(errorMessage(identifyError));
    } finally {
      if (scanAttempt.current === attempt) {
        scanningRef.current = false;
        setCapturing(false);
      }
    }
  }, [cameraStatus, identifyMutation]);

  useEffect(() => {
    if (!open) return;
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (event.key !== " " && event.key !== "Enter") ||
        cameraStatus !== "ready"
      ) return;

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, button, form, [contenteditable='true'], [role='textbox'], [role='button'], [role='combobox']")
      ) return;

      event.preventDefault();
      void captureAndIdentify();
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [open, cameraStatus, captureAndIdentify]);

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
    setName("");
    setVendorKey("");
    setSku("");
    setCategory("");
    setDescription("");
    setQuantity("0");
    setSaveError("");
  };

  const suggested = Boolean(result?.identified);
  const quantityValue = quantity.trim() === "" ? Number.NaN : Number(quantity);
  const canSave = Boolean(
    (suggested || manualMode) &&
    name.trim() &&
    vendorKey &&
    Number.isInteger(quantityValue) &&
    quantityValue >= 0 &&
    !identifyMutation.isPending &&
    !capturing
  );

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Identify a part with your camera</DialogTitle>
          <DialogDescription>
            Capture a part for a visual suggestion, then review every field and confirm the quantity before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-label="Live camera" className="min-w-0 space-y-3">
            <Card className="overflow-hidden border-border bg-card">
              <CardContent className="p-0">
                <div className="relative flex aspect-video min-h-48 items-center justify-center overflow-hidden bg-muted">
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    aria-label="Live camera preview"
                    className={`h-full w-full object-contain ${cameraStatus === "ready" ? "" : "hidden"}`}
                  />
                  {cameraStatus === "loading" && (
                    <div role="status" className="flex flex-col items-center gap-2 p-4 text-center text-sm text-muted-foreground">
                      <Loader2 size={24} className="animate-spin" aria-hidden="true" />
                      Requesting camera access…
                    </div>
                  )}
                  {cameraStatus === "error" && (
                    <div className="flex flex-col items-center gap-2 p-4 text-center text-sm text-muted-foreground">
                      <Camera size={28} aria-hidden="true" />
                      Camera preview unavailable
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {cameraError && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {cameraError}
              </div>
            )}
            {cameraStatus === "error" && (
              <Button type="button" variant="outline" onClick={() => setCameraRetry((retry) => retry + 1)}>
                <Camera size={16} aria-hidden="true" /> Try camera again
              </Button>
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              Center the part and any markings in the preview. Press Space or Enter outside a form field, or use the capture button. Frames are temporary and are not saved.
            </p>
            <Button
              type="button"
              onClick={() => void captureAndIdentify()}
              disabled={cameraStatus !== "ready" || capturing || identifyMutation.isPending || saving}
              className="w-full"
            >
              {capturing || identifyMutation.isPending
                ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> {capturing ? "Capturing frame…" : "Analyzing frame…"}</>
                : <><ScanLine size={16} aria-hidden="true" /> {error ? "Retry identification" : result ? "Scan next part" : "Capture and identify"}</>}
            </Button>
            {(capturing || identifyMutation.isPending) && (
              <p role="status" className="text-sm text-muted-foreground">
                {capturing ? "Capturing a temporary frame…" : "Analyzing the captured frame. No inventory changes are being made."}
              </p>
            )}
          </section>

          <section aria-label="Review suggested part details" className="min-w-0 space-y-3">
            {error && (
              <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {error} Capture another frame to retry, or continue with manual entry.
              </div>
            )}
            {result && !result.identified && (
              <div role="status" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
                <p className="font-medium">The part is unclear</p>
                <p className="mt-1 text-muted-foreground">{result.uncertaintyReason ?? "No part could be identified confidently."} Try a closer, brighter capture or use manual entry.</p>
              </div>
            )}
            {manualMode && !result?.identified && (
              <div role="status" className="rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground">
                <p className="font-medium">Manual part details</p>
                <p className="mt-1 text-muted-foreground">Enter the part details below. No camera frame will be saved to inventory.</p>
              </div>
            )}
            {(result?.identified || manualMode) && (
              <>
                {result?.identified && (
                  <div role="status" className="rounded-md border border-border bg-muted/50 p-3 text-sm text-foreground">
                    <p className="font-medium">Visual suggestion · {result.uncertainty} uncertainty</p>
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
                      className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-base md:text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
                      {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <ScanLine size={16} aria-hidden="true" />}
                      {saving ? "Saving part…" : "Save reviewed part"}
                    </Button>
                  </div>
                </form>
              </>
            )}
            {((result && !result.identified) || error || cameraError) && !manualMode && (
              <Button type="button" variant="outline" onClick={useManualEntry}>
                Continue in manual entry
              </Button>
            )}
            {!result && !error && !manualMode && (
              <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                Suggestions appear here after capture. Nothing is saved until you review the details and choose “Save reviewed part.”
              </p>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ReviewedPart as PartsImageReviewedPart };
