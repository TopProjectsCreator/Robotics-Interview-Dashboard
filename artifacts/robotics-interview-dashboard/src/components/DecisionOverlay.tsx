import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Coins, Dices, Disc3, X } from "lucide-react";

import { formatCoinResult, formatRollResult, formatSpinnerResult, isDefaultSpinnerOptions } from "../lib/decisionCommands";

/** The settled outcome of a decision command, handed to the overlay and back to the parent. */
export type DecisionOverlayState =
  | { kind: "coin"; flips: boolean[]; heads: number; tails: number }
  | { kind: "roll"; sides: number; modifier: number; dice: number[]; total: number }
  | { kind: "spinner"; options: string[]; winnerIndex: number };

interface DecisionOverlayProps {
  state: DecisionOverlayState;
  /** When true, skip all motion and show the settled result immediately. */
  reduceMotion: boolean;
  /** Called exactly once, when the overlay is done (result shown, or the user dismisses it). */
  onDone: () => void;
}

const COIN_DURATION_MS = 1550;
const DIE_DURATION_MS = 1300;
const DIE_STAGGER_MS = 110;
const SPINNER_DURATION_MS = 3400;
const SETTLE_LINGER_MS = 2300;

/** Cube face layout for a given die edge length. Face value → transform applied to the face element. */
function dieFaces(size: number): { value: number; transform: string }[] {
  const z = Math.round(size / 2);
  return [
    { value: 1, transform: `rotateY(0deg) translateZ(${z}px)` },
    { value: 6, transform: `rotateY(180deg) translateZ(${z}px)` },
    { value: 3, transform: `rotateX(90deg) translateZ(${z}px)` },
    { value: 4, transform: `rotateX(-90deg) translateZ(${z}px)` },
    { value: 2, transform: `rotateY(90deg) translateZ(${z}px)` },
    { value: 5, transform: `rotateY(-90deg) translateZ(${z}px)` },
  ];
}

/** Cube end orientation that brings each face value to the viewer (extra full turns baked in). */
const DIE_END: Record<number, { x: number; y: number }> = {
  1: { x: 720, y: 720 },
  2: { x: 720, y: 990 },   // rotateY(-90) brought to +270 on top of two turns
  3: { x: 630, y: 720 },   // rotateX(-90)
  4: { x: 810, y: 720 },   // rotateX(90)
  5: { x: 720, y: 810 },   // rotateY(90)
  6: { x: 720, y: 900 },   // rotateY(180)
};

/** 3×3 pip cell indices per face value (0 = top-left … 8 = bottom-right). */
const DIE_PIPS: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const SPINNER_PALETTE = [
  "#f97316", "#16a34a", "#0ea5e9", "#a855f7", "#eab308", "#ef4444",
  "#14b8a6", "#6366f1", "#ec4899", "#22c55e", "#f43f5e", "#84cc16",
];

function animationDurationMs(state: DecisionOverlayState): number {
  switch (state.kind) {
    case "coin": return COIN_DURATION_MS;
    case "roll": return DIE_DURATION_MS + Math.max(0, state.dice.length - 1) * DIE_STAGGER_MS;
    case "spinner": return SPINNER_DURATION_MS;
  }
}

function overlayTitle(state: DecisionOverlayState, settled: boolean): string {
  switch (state.kind) {
    case "coin": return settled ? "Coin flip" : "Flipping…";
    case "roll": {
      const label = `${state.dice.length}d${state.sides}${state.modifier > 0 ? `+${state.modifier}` : state.modifier < 0 ? `${state.modifier}` : ""}`;
      return settled ? `Rolled ${label}` : `Rolling ${label}…`;
    }
    case "spinner": return settled ? "The wheel has spoken" : "Deciding…";
  }
}

function resultText(state: DecisionOverlayState): string {
  switch (state.kind) {
    case "coin": return formatCoinResult(state.flips).replaceAll("**", "");
    case "roll": return formatRollResult(state.sides, state.modifier, state.dice).replaceAll("**", "");
    case "spinner": return formatSpinnerResult(state.options, state.winnerIndex).replaceAll("**", "");
  }
}

function WheelSegment({ index, total, label, color, cx, cy, r }: {
  index: number; total: number; label: string; color: string; cx: number; cy: number; r: number;
}) {
  const sliceDeg = 360 / total;
  const startDeg = index * sliceDeg - 90;
  const endDeg = (index + 1) * sliceDeg - 90;
  const midDeg = (startDeg + endDeg) / 2;
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRadians(startDeg));
  const y1 = cy + r * Math.sin(toRadians(startDeg));
  const x2 = cx + r * Math.cos(toRadians(endDeg));
  const y2 = cy + r * Math.sin(toRadians(endDeg));
  const largeArc = sliceDeg > 180 ? 1 : 0;
  const textRadius = r * 0.62;
  const tx = cx + textRadius * Math.cos(toRadians(midDeg));
  const ty = cy + textRadius * Math.sin(toRadians(midDeg));
  // Keep labels readable: flip the rotation on the lower half of the wheel.
  const flip = midDeg > 90 && midDeg < 270;
  const textRotation = flip ? midDeg + 180 : midDeg;
  const truncated = label.length > 16 ? `${label.slice(0, 15)}…` : label;
  return (
    <g>
      <path
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={color}
        stroke="#0c1b26"
        strokeWidth={2}
      />
      <text
        x={tx}
        y={ty}
        className="spinner-label"
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(${textRotation} ${tx} ${ty})`}
      >
        {truncated}
      </text>
    </g>
  );
}

function SpinnerWheel({ options, winnerIndex, reduceMotion }: { options: string[]; winnerIndex: number; reduceMotion: boolean }) {
  const size = 300;
  const cx = size / 2;
  const cy = size / 2;
  const r = 128;
  const sliceDeg = 360 / options.length;
  const winnerMidFromTop = (winnerIndex + 0.5) * sliceDeg; // clockwise from 12 o'clock
  const spinTarget = 360 * 5 - winnerMidFromTop; // five full turns, landing the winner under the pointer
  const rotateStyle = reduceMotion
    ? { transform: `rotate(${spinTarget}deg)`, transformBox: "fill-box" as const, transformOrigin: "50% 50%" }
    : undefined;
  return (
    <div className="spinner-stage" data-testid="decision-spinner">
      <svg viewBox={`0 0 ${size} ${size}`} width="240" height="240" className="spinner-wheel-svg" role="img" aria-label={`Spinner wheel with ${options.length} options`}>
        <g
          className={reduceMotion ? undefined : "spinner-rotate"}
          style={{
            ...rotateStyle,
            ["--spin-end" as string]: `${spinTarget}deg`,
            transformBox: "fill-box",
            transformOrigin: "50% 50%",
          }}
        >
          {options.map((option, index) => (
            <WheelSegment
              key={`${index}-${option}`}
              index={index}
              total={options.length}
              label={option}
              color={SPINNER_PALETTE[index % SPINNER_PALETTE.length]}
              cx={cx}
              cy={cy}
              r={r}
            />
          ))}
          <circle cx={cx} cy={cy} r={27} fill="#0f2a36" stroke="#fbbf24" strokeWidth={3} />
          <text x={cx} y={cy + 1} textAnchor="middle" dominantBaseline="central" fill="#fbbf24" fontSize={11} fontWeight={800} letterSpacing="0.12em">SPIN</text>
        </g>
        <polygon className="spinner-pointer" points={`${cx - 17},4 ${cx + 17},4 ${cx},44`} strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function CoinView({ state, reduceMotion }: { state: Extract<DecisionOverlayState, { kind: "coin" }>; reduceMotion: boolean }) {
  const outcome = state.flips[0]; // animated coin represents the first flip; chips below show each flip
  const endDeg = outcome ? "1800deg" : "1980deg";
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={reduceMotion ? "coin-3d coin-static" : "coin-3d"}
        data-testid="decision-coin"
        style={{
          ["--coin-end" as string]: endDeg,
          ...(reduceMotion ? { transform: `rotateY(${outcome ? "0deg" : "180deg"})` } : {}),
        }}
      >
        <div className="coin-face coin-face-heads"><span className="coin-glyph">H</span></div>
        <div className="coin-face coin-face-tails"><span className="coin-glyph">T</span></div>
      </div>
      {state.flips.length > 1 && (
        <div className="flex max-w-full flex-wrap justify-center gap-1.5" aria-hidden="true">
          {state.flips.map((flip, index) => (
            <span key={index} className={`coin-chip ${flip ? "coin-chip-heads" : "coin-chip-tails"}`}>{flip ? "H" : "T"}</span>
          ))}
        </div>
      )}
    </div>
  );
}

let tokenGradientCounter = 0;

function DieTokenFace({ label, value, sides }: { label: string; value: number; sides: number }) {
  const id = useRef(`tokenFace-${++tokenGradientCounter}`).current;
  return (
    <svg viewBox="0 0 100 100" className="die-token-svg" role="img" aria-label={`d${sides} showing ${value}`}>
      <polygon
        points="30,2 70,2 98,30 98,70 70,98 30,98 2,70 2,30"
        fill={`url(#${id})`}
        stroke="#8fa9b8"
        strokeWidth="1.5"
      />
      <polygon points="34,10 66,10 90,34 90,66 66,90 34,90 10,66 10,34" fill="none" stroke="rgba(255,255,255,.75)" strokeWidth="1" strokeDasharray="3 3" />
      <defs>
        <radialGradient id={id} cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="55%" stopColor="#dfe7ee" />
          <stop offset="100%" stopColor="#8fa9b8" />
        </radialGradient>
      </defs>
      <text x="50" y="46" textAnchor="middle" dominantBaseline="central" className="die-token-value">{value}</text>
      <text x="50" y="70" textAnchor="middle" dominantBaseline="central" className="die-token-sides">{label}</text>
    </svg>
  );
}

function DieView({ value, sides, index, count, reduceMotion }: { value: number; sides: number; index: number; count: number; reduceMotion: boolean }) {
  // Shrink the dice as the count grows so a full house fits the card.
  const size = count > 2 ? 62 : count > 1 ? 78 : 96;
  const style = {
    ["--die-delay" as string]: `${index * DIE_STAGGER_MS}ms`,
    width: `${size}px`,
    height: `${size}px`,
  };
  if (sides > 6) {
    // Pip faces only work up to d6 — render higher dice as an engraved octagon token instead.
    return (
      <div
        className={reduceMotion ? "die-token die-token-static" : "die-token"}
        data-testid={`decision-die-${index}`}
        style={style}
      >
        <DieTokenFace label={`d${sides}`} value={value} sides={sides} />
      </div>
    );
  }
  const end = DIE_END[value] ?? DIE_END[1];
  const faces = dieFaces(size);
  return (
    <div
      className={reduceMotion ? "die-3d die-static" : "die-3d"}
      data-testid={`decision-die-${index}`}
      style={{
        ...style,
        ["--die-end-x" as string]: `${end.x}deg`,
        ["--die-end-y" as string]: `${end.y}deg`,
        ...(reduceMotion ? { transform: `rotateX(${end.x}deg) rotateY(${end.y}deg)` } : {}),
      }}
    >
      {faces.map(face => (
        <div key={face.value} className="die-face" style={{ transform: face.transform }}>
          {Array.from({ length: 9 }, (_, cell) => (
            <span key={cell} className={DIE_PIPS[face.value].includes(cell) ? "die-pip" : "die-pip die-pip-empty"} />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Full-screen 3D animation for /coin and /roll, 2D wheel for /spinner.
 * Rendered through a portal so the chat transcript never reflows. The parent
 * owns posting the result to chat; this component only plays and reports "done".
 */
export function DecisionOverlay({ state, reduceMotion, onDone }: DecisionOverlayProps) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const [settled, setSettled] = useState(reduceMotion);
  const durationMs = animationDurationMs(state);

  useEffect(() => {
    if (settled) return;
    const timer = window.setTimeout(() => setSettled(true), reduceMotion ? 0 : durationMs);
    return () => window.clearTimeout(timer);
  }, [durationMs, reduceMotion, settled]);

  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(() => onDoneRef.current(), SETTLE_LINGER_MS);
    return () => window.clearTimeout(timer);
  }, [settled]);

  const skip = () => { if (!settled) setSettled(true); };
  const title = overlayTitle(state, settled);
  const isDecisionSpinner = state.kind === "spinner" && isDefaultSpinnerOptions(state.options);

  return createPortal(
    <div className="decision-overlay" role="dialog" aria-modal="true" aria-label={title} data-testid="decision-overlay" onClick={skip}>
      <div className="decision-card" onClick={event => event.stopPropagation()}>
        <button type="button" className="decision-close" aria-label="Skip animation and post the result" data-testid="decision-close" onClick={() => onDoneRef.current()}>
          <X size={17} />
        </button>
        <p className="decision-kicker">
          {state.kind === "spinner" ? <Disc3 size={13} aria-hidden="true" /> : state.kind === "coin" ? <Coins size={13} aria-hidden="true" /> : <Dices size={13} aria-hidden="true" />}
          <span>{state.kind === "spinner" ? (isDecisionSpinner ? "Yes / No" : `${state.options.length} options`) : state.kind === "coin" ? "Coin toss" : "Dice roll"}</span>
        </p>
        <h2 className="decision-title">{title}</h2>
        <div className="decision-stage">
          {state.kind === "coin" && <CoinView state={state} reduceMotion={reduceMotion} />}
          {state.kind === "roll" && (
            <div className="dice-row">
              {state.dice.map((value, index) => <DieView key={index} value={value} sides={state.sides} index={index} count={state.dice.length} reduceMotion={reduceMotion} />)}
            </div>
          )}
          {state.kind === "spinner" && <SpinnerWheel options={state.options} winnerIndex={state.winnerIndex} reduceMotion={reduceMotion} />}
        </div>
        <p key={settled ? "settled" : "pending"} className="decision-result" role="status" aria-live="polite" data-testid="decision-result">
          {settled ? resultText(state) : "…"}
        </p>
        <button type="button" className="decision-hint" data-testid="decision-hint" onClick={settled ? () => onDoneRef.current() : skip}>
          {settled ? "Post now" : "Tap to skip"}
        </button>
      </div>
    </div>,
    document.body,
  );
}
