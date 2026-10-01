import type { ComponentProps } from "react";
import { useEffect } from "react";
import type { ExcalidrawProps } from "@excalidraw/excalidraw/types";

type ExcalidrawStubProps = Omit<ComponentProps<"div">, "onChange"> &
  Pick<ExcalidrawProps, "validateEmbeddable" | "onChange" | "excalidrawAPI">;

export const excalidrawTestApi = {
  updateScene: (_scene: unknown) => {},
  getAppState: () => ({}),
};

export function Excalidraw({ validateEmbeddable, onChange, excalidrawAPI, ...props }: ExcalidrawStubProps) {
  useEffect(() => {
    excalidrawAPI?.(excalidrawTestApi as never);
  }, [excalidrawAPI]);

  const isValid = (url: string) => (
    typeof validateEmbeddable === "function" && validateEmbeddable(url) === true
  );
  const selectEmbed = (link: string) => {
    const args = [
      [{ id: "test-embed", type: "embeddable", link }],
      { selectedElementIds: { "test-embed": true } },
      {},
    ] as unknown as Parameters<NonNullable<ExcalidrawProps["onChange"]>>;
    onChange?.(...args);
  };

  return (
    <div
      {...props}
      data-testid="excalidraw-stub"
      data-embed-valid-unlisted-http={String(isValid("http://whiteboard.example.net/embed"))}
      data-embed-valid-unlisted-https={String(isValid("https://whiteboard.example.net/embed"))}
      data-embed-invalid-malformed={String(isValid("https://"))}
      data-embed-invalid-ftp={String(isValid("ftp://whiteboard.example.net/embed"))}
      data-embed-invalid-javascript={String(isValid("javascript:alert(1)"))}
    >
      <button type="button" data-testid="button-select-test-embed" onClick={() => selectEmbed("https://example.com/board")}>
        Select test embed
      </button>
      <button type="button" data-testid="button-select-invalid-test-embed" onClick={() => selectEmbed("javascript:alert(1)")}>
        Select invalid test embed
      </button>
    </div>
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