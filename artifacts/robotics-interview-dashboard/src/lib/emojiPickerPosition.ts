export type EmojiPickerAnchor = Pick<DOMRect, "left" | "top" | "bottom">;

export type EmojiPickerFloatingPosition = {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "above" | "below";
};

const EDGE_GUTTER = 12;
const ANCHOR_GAP = 8;
const MAX_PICKER_HEIGHT = 420;
const MAX_PICKER_WIDTH = 360;

export function getEmojiPickerFloatingPosition(
  anchor: EmojiPickerAnchor,
  viewport: { width: number; height: number; offsetLeft?: number; offsetTop?: number },
): EmojiPickerFloatingPosition {
  const offsetLeft = viewport.offsetLeft ?? 0;
  const offsetTop = viewport.offsetTop ?? 0;
  const minLeft = offsetLeft + EDGE_GUTTER;
  const minTop = offsetTop + EDGE_GUTTER;
  const maxRight = offsetLeft + viewport.width - EDGE_GUTTER;
  const maxBottom = offsetTop + viewport.height - EDGE_GUTTER;
  const desiredHeight = Math.min(MAX_PICKER_HEIGHT, Math.max(1, viewport.height - EDGE_GUTTER * 2));
  const spaceAbove = Math.max(0, anchor.top - ANCHOR_GAP - minTop);
  const spaceBelow = Math.max(0, maxBottom - anchor.bottom - ANCHOR_GAP);
  const placement = spaceAbove >= desiredHeight
    ? "above"
    : spaceBelow >= desiredHeight
      ? "below"
      : spaceBelow >= spaceAbove
        ? "below"
        : "above";
  const availableSpace = placement === "above" ? spaceAbove : spaceBelow;
  const maxHeight = Math.min(desiredHeight, Math.max(120, availableSpace));
  const width = Math.min(MAX_PICKER_WIDTH, Math.max(0, viewport.width - EDGE_GUTTER * 2));
  const maxLeft = Math.max(minLeft, maxRight - width);
  const left = Math.min(maxLeft, Math.max(minLeft, anchor.left));
  const requestedTop = placement === "above"
    ? anchor.top - ANCHOR_GAP - maxHeight
    : anchor.bottom + ANCHOR_GAP;
  const maxTop = Math.max(minTop, maxBottom - maxHeight);
  const top = Math.min(maxTop, Math.max(minTop, requestedTop));

  return { left, top, width, maxHeight, placement };
}
