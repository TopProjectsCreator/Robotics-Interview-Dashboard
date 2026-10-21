import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export interface ModalOverlayOptions {
  /** Accessible name for the dialog. */
  label: string;
  /** Called when Escape is pressed. */
  onClose?: () => void;
  /** Set to false while the overlay is closed. */
  enabled?: boolean;
}

/**
 * Mobile-safe behaviour for the app's modal overlays.
 *
 * Every overlay used to be a bare `fixed inset-0` div, which meant no scroll
 * lock, no focus trap, no Escape handling and no height cap. This hook adds
 * all of that without forcing the overlays to be rewritten:
 *
 * - locks body scroll while the overlay is open
 * - keeps Tab inside the dialog and restores focus on close
 * - closes on Escape
 * - marks the overlay so CSS can cap its height against the *visual* viewport
 *   and lift it above the on-screen keyboard and the home indicator
 */
export function useModalOverlay({ label, onClose, enabled = true }: ModalOverlayOptions) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!enabled) return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTarget = panelRef.current?.querySelector<HTMLElement>("[data-autofocus]");
    (focusTarget ?? panelRef.current)?.focus?.();
    return () => {
      document.body.style.overflow = previousOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, [enabled]);

  React.useEffect(() => {
    if (!enabled || !onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, onClose]);

  // Keep Tab inside the dialog so a phone's on-screen keyboard never walks
  // focus into the page behind the overlay.
  React.useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        element => element.offsetParent !== null || element === document.activeElement,
      );
      if (!focusable.length) return;
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
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  const overlayProps = {
    "data-modal-overlay": label,
    style: { zIndex: 150 },
  } as const;

  const panelProps = {
    ref: panelRef,
    "data-modal-panel": label,
  } as const;

  return { overlayProps, panelProps };
}

export interface ModalOverlayProps {
  children: React.ReactNode;
  onClose?: () => void;
  label: string;
  className?: string;
  testId?: string;
  backdropClassName?: string;
  zIndex?: number;
}

/**
 * A ready-made modal shell built on `useModalOverlay`. Portals to
 * `document.body` so it always paints above the page's own overlays, sits at
 * the bottom of the screen on phones like a native sheet, and stays clear of
 * the on-screen keyboard and the home indicator.
 */
export function ModalOverlay({
  children,
  onClose,
  label,
  className,
  testId,
  backdropClassName = "bg-[#112433]/55",
  zIndex = 200,
}: ModalOverlayProps) {
  const { overlayProps, panelProps } = useModalOverlay({ label, onClose });

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 flex items-end justify-center overflow-y-auto overscroll-contain p-0 sm:items-center sm:p-4",
        backdropClassName,
      )}
      style={{ zIndex }}
      onClick={onClose ? () => onClose() : undefined}
      data-testid={testId ? `${testId}-overlay` : undefined}
    >
      <div
        {...panelProps}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        data-testid={testId}
        onClick={event => event.stopPropagation()}
        className={cn(
          "w-full overflow-y-auto overscroll-contain outline-none",
          className,
        )}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
