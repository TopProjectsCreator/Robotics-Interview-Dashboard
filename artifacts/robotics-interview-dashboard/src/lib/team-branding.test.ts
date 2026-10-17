import { describe, expect, it } from "vitest";
import { readableBrandForeground } from "./team-branding";

function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => {
      const raw = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return raw <= 0.04045 ? raw / 12.92 : ((raw + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("team brand foreground contrast", () => {
  it.each(["#000000", "#16869a", "#f8c84a", "#ffffff", "#7351c8"])(
    "keeps text readable on the team color %s",
    (color) => {
      expect(contrastRatio(readableBrandForeground(color), color)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("uses a safe default for malformed stored values", () => {
    expect(readableBrandForeground("invalid")).toBe("#182232");
  });
});
