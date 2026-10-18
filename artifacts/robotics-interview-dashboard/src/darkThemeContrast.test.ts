import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const themeCss = readFileSync("src/index.css", "utf8");

function darkBackgroundFor(classToken: string): string {
  const rulePrefix = `.dark [class~="${classToken}"] { background-color: `;
  const rule = themeCss.split(rulePrefix)[1]?.split(";")[0]?.trim();
  if (!rule) throw new Error(`Missing dark background mapping for ${classToken}`);
  return rule;
}

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[a-f\d]{2}/gi)?.map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  if (!channels || channels.length !== 3) throw new Error(`Expected a hex color, got ${hex}`);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)]
    .sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("dark-theme dashboard contrast mappings", () => {
  it("keeps common dashboard action colors readable with white labels", () => {
    const actions = [
      ["bg-[#16869a]", "#126b78"],
      ["bg-[#28a47f]", "#176a53"],
      ["bg-[#b34a42]", "#87352f"],
      ["bg-[#c99a1f]", "#78580d"],
    ];
    for (const [classToken, expected] of actions) {
      const background = darkBackgroundFor(classToken);
      expect(background).toBe(expected);
      expect(contrastRatio("#ffffff", background)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("remaps light-only dashboard surfaces, muted labels, and separators", () => {
    expect(themeCss).toContain('.dark [class~="bg-[#fff8f7]"] { background-color: #40221f; }');
    expect(themeCss).toContain('.dark [class~="bg-[#fff8e1]/95"] { background-color: hsl(var(--card) / 95%); }');
    expect(themeCss).toContain('.dark [class~="bg-[#eef5ff]"] { background-color: #10232d; }');
    expect(themeCss).toContain('.dark [class~="text-[#526d75]"]');
    expect(themeCss).toContain('.dark [class~="text-[#8a6508]"]');
    expect(themeCss).toContain('.dark [class~="border-[#eef3f2]"]');
    expect(themeCss).toContain('.dark [class~="border-[#e0b8b4]"]');
  });
});
