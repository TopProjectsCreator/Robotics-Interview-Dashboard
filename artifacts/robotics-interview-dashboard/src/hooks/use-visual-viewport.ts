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

const listeners = new Set<() => void>();
let current: VisualViewportState = readViewport();
let started = false;

function publish() {
  current = readViewport();
  // Publish the inset as a CSS variable so plain CSS (sticky footers,
  // overlay padding) can react to the keyboard without a React re-render.
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.style.setProperty("--kb-inset", `${current.keyboardInset}px`);
    root.style.setProperty("--kb-open", current.keyboardOpen ? "1" : "0");
  }
  for (const listener of listeners) listener();
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const viewport = window.visualViewport;
  if (!viewport) return;
  viewport.addEventListener("resize", publish);
  viewport.addEventListener("scroll", publish);
  window.addEventListener("orientationchange", publish);
  publish();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
  };
}

// Publish the inset as soon as the module loads so plain CSS (sticky
// footers, overlay padding) can react to the keyboard even on routes that
// never call the hook.
if (typeof window !== "undefined") start();

/**
 * Tracks the visual viewport so mobile layouts can react to the on-screen
 * keyboard. Browsers without `visualViewport` report no keyboard inset.
 */
export function useVisualViewport(): VisualViewportState {
  const [state, setState] = React.useState<VisualViewportState>(current);

  React.useEffect(() => subscribe(() => setState(current)), []);

  return state;
}

/**
 * The keyboard inset on its own, for components that only need to know how
 * far the keyboard covers the viewport.
 */
export function useKeyboardInset(): number {
  return useVisualViewport().keyboardInset;
}
