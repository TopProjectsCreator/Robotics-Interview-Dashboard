import type { ComponentProps } from "react";
import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";

type ExcalidrawStubProps = ComponentProps<"div"> & Pick<ExcalidrawProps, "validateEmbeddable">;

export function Excalidraw({ validateEmbeddable, ...props }: ExcalidrawStubProps) {
  const isValid = (url: string) => (
    typeof validateEmbeddable === "function" && validateEmbeddable(url) === true
  );

  return (
    <div
      {...props}
      data-testid="excalidraw-stub"
      data-embed-valid-unlisted-http={String(isValid("http://whiteboard.example.net/embed"))}
      data-embed-valid-unlisted-https={String(isValid("https://whiteboard.example.net/embed"))}
      data-embed-invalid-malformed={String(isValid("https://"))}
      data-embed-invalid-ftp={String(isValid("ftp://whiteboard.example.net/embed"))}
      data-embed-invalid-javascript={String(isValid("javascript:alert(1)"))}
    />
  );
}

export function sceneCoordsToViewportCoords(
  { sceneX, sceneY }: { sceneX: number; sceneY: number },
  { zoom, offsetLeft, offsetTop, scrollX, scrollY }: {
    zoom: { value: number };
    offsetLeft: number;
    offsetTop: number;
    scrollX: number;
    scrollY: number;
  },
) {
  return {
    x: (sceneX - scrollX) * zoom.value + offsetLeft,
    y: (sceneY - scrollY) * zoom.value + offsetTop,
  };
}