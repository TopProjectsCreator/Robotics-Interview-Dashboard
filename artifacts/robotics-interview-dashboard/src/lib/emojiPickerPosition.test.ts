import { describe, expect, it } from "vitest";
import { getEmojiPickerFloatingPosition } from "./emojiPickerPosition";

describe("getEmojiPickerFloatingPosition", () => {
  it("keeps the full picker visible beside an anchor near the left edge", () => {
    const position = getEmojiPickerFloatingPosition(
      { left: 198, top: 374, bottom: 414 },
      { width: 932, height: 1024 },
    );

    expect(position.left).toBe(198);
    expect(position.placement).toBe("below");
    expect(position.top).toBe(422);
    expect(position.left + position.width).toBeLessThanOrEqual(932 - 12);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(1024 - 12);
  });

  it("clamps the picker horizontally on a narrow viewport", () => {
    const position = getEmojiPickerFloatingPosition(
      { left: 198, top: 130, bottom: 170 },
      { width: 320, height: 700 },
    );

    expect(position.left).toBe(12);
    expect(position.width).toBe(296);
    expect(position.left + position.width).toBeLessThanOrEqual(320 - 12);
  });

  it("places the picker above when there is not enough room below", () => {
    const position = getEmojiPickerFloatingPosition(
      { left: 240, top: 630, bottom: 670 },
      { width: 900, height: 700 },
    );

    expect(position.placement).toBe("above");
    expect(position.top).toBeGreaterThanOrEqual(12);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(700 - 12);
  });

  it("keeps the picker within a shifted visual viewport", () => {
    const position = getEmojiPickerFloatingPosition(
      { left: 200, top: 250, bottom: 290 },
      { width: 390, height: 500, offsetLeft: 0, offsetTop: 120 },
    );

    expect(position.placement).toBe("below");
    expect(position.top).toBeGreaterThanOrEqual(132);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(608);
  });

  it("never places the picker outside a very short viewport", () => {
    const position = getEmojiPickerFloatingPosition(
      { left: 80, top: 30, bottom: 40 },
      { width: 320, height: 100 },
    );

    expect(position.top).toBeGreaterThanOrEqual(12);
    expect(position.top + position.maxHeight).toBeLessThanOrEqual(88);
  });
});
