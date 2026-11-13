import { describe, expect, it } from "vitest";

import {
  parseDecisionCommand,
  rollDice,
  flipCoins,
  pickWinnerIndex,
  formatCoinResult,
  formatRollResult,
  formatSpinnerResult,
  MAX_DICE,
  MAX_SIDES,
} from "./lib/decisionCommands";

describe("parseDecisionCommand", () => {
  it("returns null for non-decision drafts", () => {
    expect(parseDecisionCommand("hello")).toBeNull();
    expect(parseDecisionCommand("/multimessage 2 hi")).toBeNull();
    expect(parseDecisionCommand("/rolle 2d6")).toBeNull();
    expect(parseDecisionCommand("/export")).toBeNull();
  });

  it("parses /roll with defaults and notation", () => {
    expect(parseDecisionCommand("/roll")).toEqual({ kind: "roll", count: 1, sides: 6, modifier: 0 });
    expect(parseDecisionCommand("/roll 20")).toEqual({ kind: "roll", count: 1, sides: 20, modifier: 0 });
    expect(parseDecisionCommand("/roll d20")).toEqual({ kind: "roll", count: 1, sides: 20, modifier: 0 });
    expect(parseDecisionCommand("/roll 2d6")).toEqual({ kind: "roll", count: 2, sides: 6, modifier: 0 });
    expect(parseDecisionCommand("/roll 2d6+3")).toEqual({ kind: "roll", count: 2, sides: 6, modifier: 3 });
    expect(parseDecisionCommand("/roll 4d8-1")).toEqual({ kind: "roll", count: 4, sides: 8, modifier: -1 });
    expect(parseDecisionCommand("/ROLL 2D6")).toEqual({ kind: "roll", count: 2, sides: 6, modifier: 0 });
    expect(parseDecisionCommand("/roll  d6  ")).toEqual({ kind: "roll", count: 1, sides: 6, modifier: 0 });
  });

  it("rejects out-of-range dice", () => {
    expect(parseDecisionCommand(`/roll ${MAX_DICE + 1}d6`)).toEqual({ error: `Roll at most ${MAX_DICE} dice at a time.` });
    expect(parseDecisionCommand(`/roll 1d${MAX_SIDES + 1}`)).toEqual({ error: `The largest die is d${MAX_SIDES}.` });
    expect(parseDecisionCommand("/roll 0d6")).toEqual({ error: "Roll at least one die." });
    expect(parseDecisionCommand("/roll 2d6+10000")).toMatchObject({ error: expect.stringContaining("Modifiers") });
    expect(parseDecisionCommand("/roll nonsense")).toMatchObject({ error: expect.stringContaining("Usage: /roll") });
  });

  it("parses /coin", () => {
    expect(parseDecisionCommand("/coin")).toEqual({ kind: "coin", count: 1 });
    expect(parseDecisionCommand("/coin 4")).toEqual({ kind: "coin", count: 4 });
    expect(parseDecisionCommand("/coin 21")).toEqual({ error: "Flip at most 20 coins at a time." });
    expect(parseDecisionCommand("/coin abc")).toEqual({ error: "Usage: /coin [count] — e.g. /coin 3" });
    expect(parseDecisionCommand("/coin 0")).toEqual({ error: "Coin count must be a whole number of at least 1." });
  });

  it("parses /spinner with defaults and comma-separated options", () => {
    expect(parseDecisionCommand("/spinner")).toEqual({ kind: "spinner", options: ["Yes", "No"] });
    expect(parseDecisionCommand("/spinner pizza, tacos, sushi")).toEqual({ kind: "spinner", options: ["pizza", "tacos", "sushi"] });
    expect(parseDecisionCommand("/spinner a ,b ,  c ")).toEqual({ kind: "spinner", options: ["a", "b", "c"] });
    expect(parseDecisionCommand("/spinner onlyone")).toEqual({ error: "Give at least two comma-separated options — e.g. /spinner pizza, tacos, sushi" });
    expect(parseDecisionCommand("/spinner ")).toEqual({ kind: "spinner", options: ["Yes", "No"] });
    const thirteen = Array.from({ length: 13 }, (_, i) => `o${i}`).join(",");
    expect(parseDecisionCommand(`/spinner ${thirteen}`)).toEqual({ error: "The spinner supports at most 12 options." });
  });
});

describe("decision randomness helpers", () => {
  it("rollDice produces values within range, deterministically with a seeded rng", () => {
    const seq = [0.0, 0.999, 0.5, 0.25];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    expect(rollDice(4, 6, rng)).toEqual([1, 6, 4, 2]); // floor(r*6)+1 with those values
    expect(rollDice(3, 1000, () => 0)).toEqual([1, 1, 1]);
    expect(rollDice(2, 20, () => 0.999999)).toEqual([20, 20]);
  });

  it("flipCoins maps rng < 0.5 to heads", () => {
    expect(flipCoins(4, () => 0.1)).toEqual([true, true, true, true]);
    expect(flipCoins(4, () => 0.9)).toEqual([false, false, false, false]);
  });

  it("pickWinnerIndex stays in range", () => {
    expect(pickWinnerIndex(3, () => 0)).toBe(0);
    expect(pickWinnerIndex(3, () => 0.999)).toBe(2);
    expect(pickWinnerIndex(1, () => 0.5)).toBe(0);
  });
});

describe("decision result formatting", () => {
  it("formats coin results", () => {
    expect(formatCoinResult([true])).toBe("🪙 Coin flip — **Heads**");
    expect(formatCoinResult([false])).toBe("🪙 Coin flip — **Tails**");
    expect(formatCoinResult([true, false, true])).toBe("🪙 Coin flip ×3 — H, T, H → **2 heads, 1 tail**");
  });

  it("formats roll results with and without modifiers", () => {
    expect(formatRollResult(6, 0, [4, 2])).toBe("🎲 Rolled **2d6** — 4, 2 = **6**");
    expect(formatRollResult(20, 3, [17])).toBe("🎲 Rolled **1d20+3** — 17 + 3 = **20**");
    expect(formatRollResult(8, -2, [5, 6])).toBe("🎲 Rolled **2d8-2** — 5, 6 − 2 = **9**");
  });

  it("formats spinner results, distinguishing the default Yes/No wheel", () => {
    expect(formatSpinnerResult(["Yes", "No"], 0)).toBe("🎡 Spinner landed on **Yes** (Yes / No spinner)");
    expect(formatSpinnerResult(["pizza", "tacos"], 1)).toBe("🎡 Spinner landed on **tacos** (from pizza · tacos)");
  });
});
