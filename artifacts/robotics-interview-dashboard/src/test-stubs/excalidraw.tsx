import type { ComponentProps } from "react";

export function Excalidraw(_props: ComponentProps<"div">) {
  return null;
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