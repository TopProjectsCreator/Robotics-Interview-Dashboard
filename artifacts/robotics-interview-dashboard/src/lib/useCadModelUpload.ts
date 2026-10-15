import { useCallback, useRef, useState } from "react";

import { shouldUseChunkedUpload, uploadChunked } from "./chunkedUpload";
import { createCadModel, uploadCadModelFile } from "@workspace/api-client-react";
import { cadUploadContentType, isCadFile } from "./cadUpload";
import type { CadBot, CadFolder, CadModel } from "@workspace/api-client-react";

/** Where a dropped file should land. `folderId: null` means the bot's root. */
export type CadDropTarget = {
  botId: string | null;
  folderId: string | null;
};

export type CadUploadProgress = {
  /** File currently being uploaded, or null when idle. */
  fileName: string | null;
  /** 0-100, or null when the size is not known in advance. */
  percent: number | null;
  completed: number;
  total: number;
};

const DEFAULT_PROGRESS: CadUploadProgress = {
  fileName: null,
  percent: null,
  completed: 0,
  total: 0,
};

/** Keeps a rejected file from failing a whole drop without telling anyone why. */
function reasonFor(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const response = (error as { response?: { data?: { error?: unknown } } }).response;
    if (typeof response?.data?.error === "string") return response.data.error;
  }
  return "Upload failed. Try again.";
}

/**
 * Stores CAD files then records them in the library.
 *
 * The bytes are uploaded first and the record created second, so a failed
 * upload never leaves an entry that renders nothing. Files past the chunk
 * threshold stream straight to storage in parts, keeping large assemblies out
 * of the API process entirely.
 */
export function useCadModelUpload(options: {
  onUploaded?: (model: CadModel) => void;
  onSettled?: () => void;
}) {
  const { onUploaded, onSettled } = options;
  const [progress, setProgress] = useState<CadUploadProgress>(DEFAULT_PROGRESS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Guards against a second drop starting while the first is still running,
  // which would interleave two batches of records.
  const inFlight = useRef(false);

  const uploadFiles = useCallback(
    async (files: File[], target: CadDropTarget) => {
      if (inFlight.current || files.length === 0) return;
      inFlight.current = true;
      setBusy(true);
      setError(null);
      setProgress({ fileName: files[0]?.name ?? null, percent: 0, completed: 0, total: files.length });
      let completed = 0;
      try {
        for (const file of files) {
          const contentType = cadUploadContentType(file);
          if (!contentType || !isCadFile(file)) {
            throw new Error(
              `${file.name} is not a supported CAD file. Use GLB, STL, 3MF, STEP, IGES, BREP, X_T, or X_B.`,
            );
          }
          setProgress({ fileName: file.name, percent: 0, completed, total: files.length });

          const stored = shouldUseChunkedUpload(file.size)
            ? {
              objectPath: await uploadChunked(file, file.name, contentType, (done, total) => {
                setProgress({
                  fileName: file.name,
                  percent: Math.round((done / Math.max(total, 1)) * 100),
                  completed,
                  total: files.length,
                });
              }, "cad"),
            }
            : (
              await uploadCadModelFile(file, {
                fileName: file.name,
                contentType,
              })
            );

          const model = await createCadModel({
            objectPath: stored.objectPath,
            fileName: file.name,
            contentType,
            sizeBytes: file.size,
            botId: target.botId,
            folderId: target.folderId,
          });
          onUploaded?.(model);
          completed += 1;
          setProgress({
            fileName: file.name,
            percent: 100,
            completed,
            total: files.length,
          });
        }
      } catch (caught) {
        setError(reasonFor(caught));
      } finally {
        inFlight.current = false;
        setBusy(false);
        onSettled?.();
      }
    },
    [onUploaded, onSettled],
  );

  const reset = useCallback(() => {
    setProgress(DEFAULT_PROGRESS);
    setError(null);
  }, []);

  return { uploadFiles, progress, error, busy, reset };
}

export type { CadBot, CadFolder, CadModel };
