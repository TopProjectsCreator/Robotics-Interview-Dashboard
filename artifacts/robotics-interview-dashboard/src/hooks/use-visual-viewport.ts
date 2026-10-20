import * as React from "react";

export interface VisualViewportState {
  /** Height of the visible (visual) viewport in CSS pixels. */
  height: number;
  /** Pixels of the layout viewport hidden behind the software keyboard. */
  keyboardInset: number;
  /** True while the software keyboard covers part of the viewport. */
  keyboardOpen: boolean;
}

const EMPTY: VisualViewportState = { height: 0, keyboardInset: 0, keyboardOpen: false };

function readViewport(): VisualViewportState {
  if (typeof window === "undefined") return EMPTY;
  const viewport = window.visualViewport;
  if (!viewport) {
    return { height: window.innerHeight, keyboardInset: 0, keyboardOpen: false };
  }
  // The keyboard shrinks the visual viewport without resizing the layout
  // viewport, so `dvh`/`vh` keep their old value and fixed bottom UI slides
  // underneath the keyboard.
  const keyboardInset = Math.max(
    0,
    Math.round(window.innerHeight - viewport.height - viewport.offsetTop),
  );
  return {
    height: Math.round(viewport.height),
    keyboardInset,
    // 80px separates a software keyboard from browser chrome collapsing.
    keyboardOpen: keyboardInset > 80,
  };
}

/**
 * Tracks the visual viewport so mobile layouts can react to the on-screen
 * keyboard. Browsers without `visualViewport` report no keyboard inset.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = React.useState<VisualViewportState>(readViewport);

  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onChange = () => setState(readViewport());
    viewport.addEventListener("resize", onChange);
    viewport.addEventListener("scroll", onChange);
    return () => {
      viewport.removeEventListener("resize", onChange);
      viewport.removeEventListener("scroll", onChange);
    };
  }, []);

  return state;
}
