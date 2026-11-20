import { useCallback, useRef, useState, type DragEvent } from "react";

type NativeFileDropOptions = {
  disabled?: boolean;
};

function carriesFiles(dataTransfer: DataTransfer | null | undefined): boolean {
  if (!dataTransfer) return false;
  return Array.from(dataTransfer.types ?? []).includes("Files") || dataTransfer.files.length > 0;
}

/**
 * Adds native OS-file dropping to one upload control. Internal app drags are
 * ignored, and a handled file drop cannot bubble into an ancestor upload zone.
 */
export function useNativeFileDrop(
  onFiles: (files: File[]) => void,
  { disabled = false }: NativeFileDropOptions = {},
) {
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const depth = useRef(0);
  const onFilesRef = useRef(onFiles);
  onFilesRef.current = onFiles;

  const onDragEnter = useCallback((event: DragEvent<HTMLElement>) => {
    if (!carriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    depth.current += 1;
    setIsDraggingFiles(true);
  }, [disabled]);

  const onDragOver = useCallback((event: DragEvent<HTMLElement>) => {
    if (!carriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    event.dataTransfer.dropEffect = "copy";
    setIsDraggingFiles(true);
  }, [disabled]);

  const onDragLeave = useCallback((event: DragEvent<HTMLElement>) => {
    if (!carriesFiles(event.dataTransfer)) return;
    event.stopPropagation();
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) return;
    depth.current = 0;
    setIsDraggingFiles(false);
  }, []);

  const onDrop = useCallback((event: DragEvent<HTMLElement>) => {
    if (!carriesFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.stopPropagation();
    depth.current = 0;
    setIsDraggingFiles(false);
    if (disabled) return;
    const files = Array.from(event.dataTransfer.files);
    if (files.length) onFilesRef.current(files);
  }, [disabled]);

  return {
    isDraggingFiles,
    fileDropProps: { onDragEnter, onDragOver, onDragLeave, onDrop },
  };
}
