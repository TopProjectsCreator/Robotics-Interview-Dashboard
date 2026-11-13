/**
 * `/roll`, `/coin` and `/spinner` — the composer's decision helpers.
 *
 * These are pure parsing + randomness helpers; the UI layer (DecisionOverlay)
 * owns the animations and the chat posting. Everything here is synchronous
 * and takes an injectable `random` so tests can be deterministic.
 *
 * Syntax:
 *   /coin            → flip one coin
 *   /coin 3          → flip three coins (totals shown)
 *   /roll            → 1d6
 *   /roll 20         → 1d20 (a bare number is a single die)
 *   /roll d20        → 1d20
 *   /roll 2d6        → two six-sided dice
 *   /roll 4d8+2      → four eight-sided dice plus a modifier
 *   /roll 3d10-1     → modifier may be negative
 *   /spinner         → Yes / No two-slice wheel
 *   /spinner a, b, c → wheel with the given comma-separated options
 */

export const MAX_DICE = 8;
export const MAX_SIDES = 1000;
export const MAX_MODIFIER = 9999;
export const MAX_COIN_FLIPS = 20;
export const MAX_SPINNER_OPTIONS = 12;
export const MAX_SPINNER_OPTION_CHARS = 48;
export const DEFAULT_SPINNER_OPTIONS = ["Yes", "No"];

export type DecisionCommand =
  | { kind: "coin"; count: number }
  | { kind: "roll"; count: number; sides: number; modifier: number }
  | { kind: "spinner"; options: string[] }
  | { error: string };

export function parseDecisionCommand(raw: string): DecisionCommand | null {
  const trimmed = raw.trim();
  const head = /^\/(coin|roll|spinner)(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (!head) return null;
  const [, name, restText] = head;
  const rest = (restText ?? "").trim();
  const lower = name.toLowerCase();
  if (lower === "coin") return parseCoin(rest);
  if (lower === "roll") return parseRoll(rest);
  return parseSpinner(rest);
}

function parseCoin(rest: string): DecisionCommand {
  if (!rest) return { kind: "coin", count: 1 };
  if (!/^\d+$/.test(rest)) return { error: "Usage: /coin [count] — e.g. /coin 3" };
  const count = Number(rest);
  if (!Number.isSafeInteger(count) || count < 1) return { error: "Coin count must be a whole number of at least 1." };
  if (count > MAX_COIN_FLIPS) return { error: `Flip at most ${MAX_COIN_FLIPS} coins at a time.` };
  return { kind: "coin", count };
}

function parseRoll(rest: string): DecisionCommand {
  const usage = "Usage: /roll [NdM[+/-modifier]] — e.g. /roll, /roll 20, /roll 2d6, /roll 2d6+1";
  if (!rest) return { kind: "roll", count: 1, sides: 6, modifier: 0 };
  const bare = /^(\d+)$/.exec(rest);
  if (bare) {
    const sides = Number(bare[1]);
    if (!Number.isSafeInteger(sides) || sides < 1) return { error: "Die needs at least 1 side." };
    if (sides > MAX_SIDES) return { error: `The largest die is d${MAX_SIDES}.` };
    return { kind: "roll", count: 1, sides, modifier: 0 };
  }
  const notation = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(rest);
  if (!notation) return { error: usage };
  const count = notation[1] ? Number(notation[1]) : 1;
  const sides = Number(notation[2]);
  const modifier = notation[3] ? Number(notation[3]) : 0;
  if (!Number.isSafeInteger(count) || count < 1) return { error: "Roll at least one die." };
  if (count > MAX_DICE) return { error: `Roll at most ${MAX_DICE} dice at a time.` };
  if (!Number.isSafeInteger(sides) || sides < 1) return { error: "Die needs at least 1 side." };
  if (sides > MAX_SIDES) return { error: `The largest die is d${MAX_SIDES}.` };
  if (Math.abs(modifier) > MAX_MODIFIER) return { error: `Modifiers are capped at ±${MAX_MODIFIER}.` };
  return { kind: "roll", count, sides, modifier };
}

function parseSpinner(rest: string): DecisionCommand {
  if (!rest) return { kind: "spinner", options: [...DEFAULT_SPINNER_OPTIONS] };
  const options = rest.split(",").map(part => part.trim()).filter(Boolean);
  if (options.length < 2) {
    return { error: "Give at least two comma-separated options — e.g. /spinner pizza, tacos, sushi" };
  }
  if (options.length > MAX_SPINNER_OPTIONS) {
    return { error: `The spinner supports at most ${MAX_SPINNER_OPTIONS} options.` };
  }
  for (const option of options) {
    if (option.length > MAX_SPINNER_OPTION_CHARS) {
      return { error: `Options are capped at ${MAX_SPINNER_OPTION_CHARS} characters each.` };
    }
  }
  return { kind: "spinner", options };
}

/** Rolls `count` d`sides` dice. Returns the individual results in order. */
export function rollDice(count: number, sides: number, random: () => number = Math.random): number[] {
  return Array.from({ length: count }, () => 1 + Math.floor(random() * sides));
}

/** Flips `count` coins. true = heads. */
export function flipCoins(count: number, random: () => number = Math.random): boolean[] {
  return Array.from({ length: count }, () => random() < 0.5);
}

/** Picks a random index into `length` options. */
export function pickWinnerIndex(length: number, random: () => number = Math.random): number {
  return Math.floor(random() * length);
}

/** The chat line posted after a roll settles. */
export function formatRollResult(sides: number, modifier: number, dice: number[]): string {
  const total = dice.reduce((sum, die) => sum + die, 0) + modifier;
  const label = `${dice.length}d${sides}${modifier >= 0 && modifier !== 0 ? `+${modifier}` : modifier !== 0 ? `${modifier}` : ""}`;
  const parts = dice.join(", ");
  const modPart = modifier !== 0 ? ` ${modifier >= 0 ? "+" : "−"} ${Math.abs(modifier)}` : "";
  return `🎲 Rolled **${label}** — ${parts}${modPart} = **${total}**`;
}

/** The chat line posted after coin flips settle. */
export function formatCoinResult(flips: boolean[]): string {
  if (flips.length === 1) {
    return `🪙 Coin flip — **${flips[0] ? "Heads" : "Tails"}**`;
  }
  const heads = flips.filter(Boolean).length;
  const tails = flips.length - heads;
  const sequence = flips.map(flip => (flip ? "H" : "T")).join(", ");
  return `🪙 Coin flip ×${flips.length} — ${sequence} → **${heads} ${heads === 1 ? "head" : "heads"}, ${tails} ${tails === 1 ? "tail" : "tails"}**`;
}

/** The chat line posted after the spinner settles. */
export function formatSpinnerResult(options: string[], winnerIndex: number): string {
  const winner = options[winnerIndex];
  const label = options.length === DEFAULT_SPINNER_OPTIONS.length
    && options.every((option, index) => option === DEFAULT_SPINNER_OPTIONS[index])
    ? "Yes / No spinner"
    : `from ${options.join(" · ")}`;
  return `🎡 Spinner landed on **${winner}** (${label})`;
}
