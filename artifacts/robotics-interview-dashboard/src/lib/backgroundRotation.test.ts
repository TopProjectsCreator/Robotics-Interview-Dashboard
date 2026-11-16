import { describe, expect, it } from "vitest";
import { backgroundIndexAt } from "./backgroundRotation";

describe("backgroundIndexAt", () => {
  it("returns the first background when rotation is off", () => {
    expect(backgroundIndexAt(3, 0, 10_000_000_000)).toBe(0);
    expect(backgroundIndexAt(3, -30, 10_000_000_000)).toBe(0);
  });

  it("returns 0 when there is nothing to show", () => {
    expect(backgroundIndexAt(0, 60, 10_000_000_000)).toBe(0);
  });

  it("walks the backgrounds in order on the configured interval", () => {
    const now = Date.parse("2026-11-13T20:00:00.000Z");
    const second = 1000;
    expect(backgroundIndexAt(3, 60, now)).toBe(Math.floor(now / 1000 / 60) % 3);
    expect(backgroundIndexAt(3, 60, now + 60 * second)).toBe((Math.floor(now / 1000 / 60) + 1) % 3);
    expect(backgroundIndexAt(3, 60, now + 120 * second)).toBe((Math.floor(now / 1000 / 60) + 2) % 3);
    expect(backgroundIndexAt(3, 60, now + 180 * second)).toBe(Math.floor(now / 1000 / 60) % 3);
  });

  it("is identical for every client holding the same inputs", () => {
    const now = Date.parse("2026-11-13T20:00:00.000Z") + 123_456;
    expect(backgroundIndexAt(5, 45, now)).toBe(backgroundIndexAt(5, 45, now));
  });

  it("survives non-finite inputs", () => {
    expect(backgroundIndexAt(2, Number.NaN, 1000)).toBe(0);
    expect(backgroundIndexAt(2, 60, Number.NaN)).toBe(0);
  });
});
