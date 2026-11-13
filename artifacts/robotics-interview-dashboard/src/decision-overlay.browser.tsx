import { createRoot } from "react-dom/client";

import "./index.css";
import { DecisionOverlay, type DecisionOverlayState } from "./components/DecisionOverlay";

const STATES: Record<string, DecisionOverlayState> = {
  coin: { kind: "coin", flips: [true], heads: 1, tails: 0 },
  coinMulti: { kind: "coin", flips: [true, false, true, true, false, true, false, true], heads: 5, tails: 3 },
  roll: { kind: "roll", sides: 20, modifier: 3, dice: [17], total: 20 },
  rollMulti: { kind: "roll", sides: 6, modifier: 0, dice: [4, 2, 6, 1], total: 13 },
  spinner: { kind: "spinner", options: ["Pizza", "Tacos", "Sushi", "Thai"], winnerIndex: 1 },
  yesNo: { kind: "spinner", options: ["Yes", "No"], winnerIndex: 0 },
};

const state = STATES[window.location.hash.replace("#", "")] ?? STATES.coin;
const reduceMotion = new URLSearchParams(window.location.search).get("reduceMotion") === "1";

const root = createRoot(document.getElementById("root")!);
root.render(
  <DecisionOverlay
    state={state}
    reduceMotion={reduceMotion}
    onDone={() => { document.body.dataset.decisionDone = "true"; }}
  />,
);
