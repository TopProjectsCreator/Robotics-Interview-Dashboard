import { useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Cpu,
  Gauge,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  Menu,
  MessageSquare,
  Monitor,
  Radio,
  Rows3,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";

type ViewMode = "overview" | "flow" | "signals";

const lanes = [
  { label: "Bay 01", tone: "cyan", state: "Interview lane", count: "02" },
  { label: "Bay 02", tone: "yellow", state: "Interview lane", count: "01" },
  { label: "Next up", tone: "mint", state: "Ready lane", count: "03" },
];

const timeline = [
  { time: "08:00", label: "Doors open", detail: "Arrival desk starts the sample flow", tone: "cyan" },
  { time: "08:15", label: "Queue active", detail: "First interview lanes become available", tone: "yellow" },
  { time: "09:05", label: "Room check", detail: "Coordinator signal is steady", tone: "mint" },
  { time: "10:30", label: "Preview close", detail: "Aggregate snapshot ends", tone: "slate" },
];

const signals = [
  { label: "Queue movement", value: "STABLE", detail: "Three illustrative lanes in rhythm", tone: "cyan", icon: ArrowDownRight },
  { label: "Room readiness", value: "READY", detail: "Sample handoffs have an owner", tone: "mint", icon: Check },
  { label: "Public signal", value: "VISIBLE", detail: "Instructions stay on the shared display", tone: "yellow", icon: Monitor },
];

export default function PublicDashboard() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [previewStep, setPreviewStep] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);

  const advancePreview = () => setPreviewStep((step) => (step + 1) % 3);
  const closeMenu = () => setMenuOpen(false);

  return (
    <main className="public-dashboard" data-testid="public-dashboard">
      <style>{`
        .public-dashboard {
          --pd-ink: #16303b;
          --pd-ink-soft: #43616a;
          --pd-muted: #70868b;
          --pd-paper: #f5f8f4;
          --pd-surface: #ffffff;
          --pd-surface-alt: #edf4f1;
          --pd-line: #d9e6e1;
          --pd-line-strong: #bed4ce;
          --pd-navy: #153642;
          --pd-cyan: #1c91a0;
          --pd-cyan-soft: #d9f1ef;
          --pd-yellow: #efc34f;
          --pd-yellow-soft: #fff1c7;
          --pd-mint: #64ae8e;
          --pd-mint-soft: #dcefe6;
          --pd-red: #c86458;
          position: relative;
          isolation: isolate;
          min-height: 100dvh;
          overflow: hidden;
          background: var(--pd-paper);
          color: var(--pd-ink);
          font-family: var(--app-font-sans, "Space Grotesk", sans-serif);
        }
        .public-dashboard::before {
          content: "";
          position: absolute;
          z-index: -2;
          inset: 0 0 auto;
          height: 790px;
          pointer-events: none;
          background:
            radial-gradient(circle at 76% 7%, rgba(100, 174, 142, .2), transparent 24%),
            radial-gradient(circle at 15% 19%, rgba(28, 145, 160, .1), transparent 21%),
            linear-gradient(180deg, #e8f2ee 0%, var(--pd-paper) 82%);
        }
        .public-dashboard::after {
          content: "";
          position: fixed;
          z-index: 20;
          inset: 0;
          pointer-events: none;
          opacity: .028;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 160 160' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.78' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.55'/%3E%3C/svg%3E");
        }
        .public-dashboard a,
        .public-dashboard button { -webkit-tap-highlight-color: transparent; }
        .pd-shell { width: min(1360px, calc(100% - 40px)); margin: 0 auto; }
        .pd-mono { font-family: var(--app-font-mono, "DM Mono", monospace); }
        .pd-nav-wrap { position: relative; z-index: 10; padding: 22px 0 14px; }
        .pd-nav { display: flex; min-height: 52px; align-items: center; gap: 28px; }
        .pd-brand { display: inline-flex; flex-shrink: 0; align-items: center; gap: 11px; color: var(--pd-ink); text-decoration: none; }
        .pd-brand-mark { position: relative; display: grid; width: 40px; height: 40px; place-items: center; border-radius: 12px; background: var(--pd-navy); color: var(--pd-yellow); box-shadow: 0 8px 18px rgba(21, 54, 66, .13); }
        .pd-brand-mark::after { content: ""; position: absolute; right: 7px; top: 7px; width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
        .pd-brand-copy strong { display: block; font-size: 13px; letter-spacing: .17em; line-height: 1; }
        .pd-brand-copy small { display: block; margin-top: 6px; color: var(--pd-muted); font-size: 8px; letter-spacing: .18em; line-height: 1; }
        .pd-nav-links { display: flex; align-items: center; gap: clamp(16px, 2.4vw, 34px); margin-left: auto; }
        .pd-nav-links a { color: var(--pd-ink-soft); font-size: 12px; font-weight: 600; text-decoration: none; transition: color .2s ease, transform .2s ease; }
        .pd-nav-links a:hover { color: var(--pd-cyan); transform: translateY(-1px); }
        .pd-nav-link-primary { display: inline-flex; align-items: center; gap: 8px; border: 1px solid var(--pd-navy); border-radius: 8px; padding: 10px 14px; background: var(--pd-navy); color: #eff8f4 !important; }
        .pd-nav-link-primary:hover { background: #1f4955; color: #fff !important; }
        .pd-menu-button { display: none; border: 0; background: transparent; color: var(--pd-ink); }
        .pd-focus:focus-visible, .pd-nav a:focus-visible, .pd-menu-button:focus-visible, .pd-view-tab:focus-visible, .pd-control:focus-visible { outline: 3px solid rgba(28, 145, 160, .38); outline-offset: 3px; }
        .pd-preview-ribbon { display: flex; align-items: center; justify-content: center; gap: 8px; border-top: 1px solid var(--pd-line); border-bottom: 1px solid var(--pd-line); padding: 9px 14px; color: var(--pd-ink-soft); background: rgba(255,255,255,.48); font: 500 10px/1.4 var(--app-font-mono, monospace); letter-spacing: .08em; text-align: center; text-transform: uppercase; }
        .pd-preview-ribbon strong { color: var(--pd-cyan); font-weight: 500; }
        .pd-hero { display: grid; grid-template-columns: minmax(0, .9fr) minmax(470px, 1.1fr); gap: clamp(42px, 7vw, 112px); align-items: center; padding: clamp(54px, 7vw, 94px) 0 66px; }
        .pd-eyebrow { display: flex; align-items: center; gap: 9px; margin: 0 0 20px; color: var(--pd-cyan); font: 500 10px/1 var(--app-font-mono, monospace); letter-spacing: .16em; text-transform: uppercase; }
        .pd-pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--pd-mint); box-shadow: 0 0 0 5px rgba(100,174,142,.16); animation: pd-pulse 2.5s ease-in-out infinite; }
        @keyframes pd-pulse { 0%, 100% { opacity: .65; transform: scale(.9); } 50% { opacity: 1; transform: scale(1.1); } }
        .pd-hero h1 { max-width: 700px; margin: 0; color: var(--pd-navy); font-size: clamp(45px, 6vw, 86px); font-weight: 600; letter-spacing: -.075em; line-height: .94; }
        .pd-hero h1 em { color: var(--pd-cyan); font-style: normal; }
        .pd-hero-lede { max-width: 570px; margin: 26px 0 0; color: var(--pd-ink-soft); font-size: clamp(16px, 1.55vw, 20px); line-height: 1.55; }
        .pd-hero-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 32px; }
        .pd-button { display: inline-flex; min-height: 45px; align-items: center; justify-content: center; gap: 9px; border: 1px solid transparent; border-radius: 8px; padding: 0 16px; font-size: 12px; font-weight: 700; text-decoration: none; transition: background-color .2s ease, border-color .2s ease, color .2s ease, transform .2s ease; }
        .pd-button:hover { transform: translateY(-2px); }
        .pd-button-primary { background: var(--pd-navy); color: #f2f8f5; box-shadow: 0 9px 20px rgba(21,54,66,.13); }
        .pd-button-primary:hover { background: #1f4a56; }
        .pd-button-secondary { border-color: var(--pd-line-strong); background: rgba(255,255,255,.58); color: var(--pd-navy); }
        .pd-button-secondary:hover { border-color: var(--pd-cyan); background: var(--pd-surface); color: var(--pd-cyan); }
        .pd-hero-footnote { display: flex; align-items: center; gap: 7px; margin-top: 18px; color: var(--pd-muted); font: 500 10px/1.45 var(--app-font-mono, monospace); }
        .pd-hero-footnote svg { color: var(--pd-mint); }
        .pd-command-wrap { position: relative; min-width: 0; }
        .pd-command-wrap::before, .pd-command-wrap::after { content: ""; position: absolute; border: 1px solid rgba(28,145,160,.18); pointer-events: none; }
        .pd-command-wrap::before { width: 88px; height: 88px; left: -42px; top: -40px; border-right: 0; border-bottom: 0; }
        .pd-command-wrap::after { width: 100px; height: 100px; right: -33px; bottom: -34px; border-left: 0; border-top: 0; border-color: rgba(239,195,79,.32); }
        .pd-command-card { position: relative; overflow: hidden; border: 1px solid #2c5963; border-radius: 16px; background: var(--pd-navy); color: #eaf5f0; box-shadow: 0 22px 50px rgba(21,54,66,.18); }
        .pd-command-card::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .12; background-image: linear-gradient(rgba(157,221,210,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(157,221,210,.4) 1px, transparent 1px); background-size: 38px 38px; mask-image: linear-gradient(120deg, black, transparent 70%); }
        .pd-card-top, .pd-card-main, .pd-card-bottom { position: relative; z-index: 1; }
        .pd-card-top { display: flex; align-items: flex-start; justify-content: space-between; border-bottom: 1px solid rgba(196,229,219,.17); padding: 20px 22px 18px; }
        .pd-card-kicker { margin: 0 0 7px; color: #8cb7b5; font: 500 9px/1 var(--app-font-mono, monospace); letter-spacing: .13em; }
        .pd-card-top h2 { margin: 0; color: #f1f8f4; font-size: 22px; font-weight: 600; letter-spacing: -.04em; }
        .pd-signal-chip { display: inline-flex; align-items: center; gap: 7px; border: 1px solid rgba(100,174,142,.36); border-radius: 999px; padding: 7px 9px; color: #b8e0c7; background: rgba(100,174,142,.1); font: 500 9px/1 var(--app-font-mono, monospace); white-space: nowrap; }
        .pd-signal-chip span { width: 5px; height: 5px; border-radius: 50%; background: #79cb9c; }
        .pd-card-main { padding: 22px; }
        .pd-card-main-head { display: flex; align-items: end; justify-content: space-between; gap: 18px; margin-bottom: 19px; }
        .pd-card-main-head p { margin: 0; color: #8cb7b5; font: 500 9px/1.4 var(--app-font-mono, monospace); letter-spacing: .12em; text-transform: uppercase; }
        .pd-card-main-head strong { color: #f2f8f5; font-size: 31px; font-weight: 500; letter-spacing: -.06em; }
        .pd-card-main-head strong small { margin-left: 5px; color: #8cb7b5; font: 500 10px/1 var(--app-font-mono, monospace); letter-spacing: .02em; }
        .pd-lane-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 9px; }
        .pd-lane { min-height: 116px; border: 1px solid rgba(195,228,218,.16); border-radius: 9px; padding: 12px; background: rgba(7,28,36,.24); }
        .pd-lane.is-active { border-color: rgba(239,195,79,.74); background: rgba(239,195,79,.08); }
        .pd-lane-label { display: flex; align-items: center; justify-content: space-between; color: #b3ceca; font: 500 9px/1.2 var(--app-font-mono, monospace); }
        .pd-lane-label span { width: 7px; height: 7px; border-radius: 50%; background: #55bdc1; }
        .pd-lane.tone-yellow .pd-lane-label span { background: var(--pd-yellow); }
        .pd-lane.tone-mint .pd-lane-label span { background: var(--pd-mint); }
        .pd-lane-count { display: block; margin: 18px 0 5px; color: #f4faf7; font-size: 28px; font-weight: 500; letter-spacing: -.06em; }
        .pd-lane-state { color: #85aaa9; font-size: 10px; }
        .pd-card-bottom { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(196,229,219,.17); padding: 13px 22px; color: #8cb7b5; font: 500 9px/1.4 var(--app-font-mono, monospace); }
        .pd-card-bottom b { color: #dcf0e8; font-weight: 500; }
        .pd-scanline { position: absolute; left: 0; top: 0; width: 35%; height: 1px; background: rgba(176,231,218,.5); animation: pd-scan 4s ease-in-out infinite; }
        @keyframes pd-scan { 0% { transform: translateX(-110%); opacity: .1; } 45%, 60% { opacity: .65; } 100% { transform: translateX(400%); opacity: .1; } }
        .pd-stat-strip { display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--pd-line); border-bottom: 1px solid var(--pd-line); }
        .pd-stat { position: relative; padding: 18px 20px 20px 0; }
        .pd-stat:not(:first-child) { padding-left: 26px; }
        .pd-stat:not(:first-child)::before { content: ""; position: absolute; left: 0; top: 19px; bottom: 19px; width: 1px; background: var(--pd-line); }
        .pd-stat-label { color: var(--pd-muted); font: 500 9px/1.3 var(--app-font-mono, monospace); letter-spacing: .1em; text-transform: uppercase; }
        .pd-stat strong { display: block; margin: 8px 0 4px; color: var(--pd-navy); font-size: 29px; font-weight: 600; letter-spacing: -.06em; }
        .pd-stat small { color: var(--pd-ink-soft); font-size: 11px; }
        .pd-content { padding: 75px 0 94px; }
        .pd-section-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; margin-bottom: 24px; }
        .pd-section-heading h2 { max-width: 590px; margin: 0; color: var(--pd-navy); font-size: clamp(28px, 3.3vw, 46px); font-weight: 600; letter-spacing: -.065em; line-height: 1; }
        .pd-section-heading p { max-width: 340px; margin: 0; color: var(--pd-ink-soft); font-size: 13px; line-height: 1.55; }
        .pd-view-tabs { display: inline-flex; gap: 4px; margin-bottom: 24px; border: 1px solid var(--pd-line); border-radius: 8px; padding: 4px; background: var(--pd-surface-alt); }
        .pd-view-tab { border: 0; border-radius: 5px; padding: 8px 11px; color: var(--pd-muted); background: transparent; font: 500 10px/1 var(--app-font-mono, monospace); cursor: pointer; transition: color .2s ease, background-color .2s ease; }
        .pd-view-tab:hover { color: var(--pd-ink); }
        .pd-view-tab.is-active { color: var(--pd-navy); background: var(--pd-surface); box-shadow: 0 2px 6px rgba(21,54,66,.08); }
        .pd-dashboard-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(300px, .9fr); gap: 16px; }
        .pd-panel { border: 1px solid var(--pd-line); border-radius: 13px; background: var(--pd-surface); box-shadow: 0 11px 25px rgba(39,79,76,.05); }
        .pd-panel-large { grid-row: span 2; }
        .pd-panel-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 19px 20px 17px; border-bottom: 1px solid var(--pd-line); }
        .pd-panel-title { display: flex; align-items: flex-start; gap: 11px; }
        .pd-panel-icon { display: grid; width: 31px; height: 31px; flex: 0 0 auto; place-items: center; border-radius: 8px; color: var(--pd-cyan); background: var(--pd-cyan-soft); }
        .pd-panel-icon.yellow { color: #a1760a; background: var(--pd-yellow-soft); }
        .pd-panel-icon.mint { color: #277052; background: var(--pd-mint-soft); }
        .pd-panel-title h3 { margin: 1px 0 5px; color: var(--pd-navy); font-size: 15px; font-weight: 600; letter-spacing: -.02em; }
        .pd-panel-title p { margin: 0; color: var(--pd-muted); font-size: 11px; line-height: 1.4; }
        .pd-panel-meta { color: var(--pd-muted); font: 500 9px/1.3 var(--app-font-mono, monospace); text-align: right; white-space: nowrap; }
        .pd-panel-body { padding: 20px; }
        .pd-attendance-layout { display: grid; grid-template-columns: minmax(120px, .65fr) 1fr; gap: 30px; align-items: center; }
        .pd-ring { display: grid; width: 150px; height: 150px; place-items: center; border-radius: 50%; background: conic-gradient(var(--pd-cyan) 0 75%, #dfeae5 75% 100%); position: relative; }
        .pd-ring::before { content: ""; position: absolute; width: 116px; height: 116px; border-radius: 50%; background: var(--pd-surface); }
        .pd-ring-copy { position: relative; z-index: 1; text-align: center; }
        .pd-ring-copy strong { display: block; color: var(--pd-navy); font-size: 32px; letter-spacing: -.08em; }
        .pd-ring-copy span { color: var(--pd-muted); font: 500 9px/1 var(--app-font-mono, monospace); text-transform: uppercase; }
        .pd-metric-row { display: flex; align-items: end; justify-content: space-between; gap: 12px; padding: 11px 0; border-bottom: 1px solid var(--pd-line); }
        .pd-metric-row:first-child { padding-top: 0; }
        .pd-metric-row:last-child { border-bottom: 0; padding-bottom: 0; }
        .pd-metric-row span { color: var(--pd-ink-soft); font-size: 11px; }
        .pd-metric-row strong { color: var(--pd-navy); font: 600 14px/1 var(--app-font-mono, monospace); }
        .pd-progress { height: 6px; overflow: hidden; border-radius: 9px; background: #e1ece7; }
        .pd-progress i { display: block; width: 75%; height: 100%; border-radius: inherit; background: var(--pd-cyan); }
        .pd-mini-caption { display: flex; justify-content: space-between; margin-top: 8px; color: var(--pd-muted); font: 500 9px/1.3 var(--app-font-mono, monospace); }
        .pd-flow-list { display: grid; gap: 11px; }
        .pd-flow-row { display: grid; grid-template-columns: 52px 1fr auto; gap: 13px; align-items: center; }
        .pd-flow-number { color: var(--pd-muted); font: 500 11px/1 var(--app-font-mono, monospace); }
        .pd-flow-track { height: 9px; overflow: hidden; border-radius: 8px; background: var(--pd-surface-alt); }
        .pd-flow-track i { display: block; height: 100%; border-radius: inherit; background: var(--pd-cyan); }
        .pd-flow-row:nth-child(2) .pd-flow-track i { background: var(--pd-yellow); }
        .pd-flow-row:nth-child(3) .pd-flow-track i { background: var(--pd-mint); }
        .pd-flow-state { color: var(--pd-ink-soft); font-size: 10px; }
        .pd-display-preview { overflow: hidden; border: 1px solid #325b64; border-radius: 9px; padding: 20px; background: #112e3a; color: #ecf6f1; }
        .pd-display-top { display: flex; align-items: center; justify-content: space-between; color: #8eb9b6; font: 500 9px/1 var(--app-font-mono, monospace); letter-spacing: .1em; }
        .pd-display-top span { color: #8ad2a1; }
        .pd-display-message { padding: 27px 6px 23px; text-align: center; }
        .pd-display-message small { display: block; color: #8eb9b6; font: 500 9px/1.4 var(--app-font-mono, monospace); letter-spacing: .12em; text-transform: uppercase; }
        .pd-display-message strong { display: block; margin: 9px 0 7px; color: #f1f8f4; font-size: 23px; letter-spacing: -.045em; }
        .pd-display-message p { margin: 0; color: #a8cbca; font-size: 11px; }
        .pd-display-bar { height: 5px; border-radius: 5px; background: linear-gradient(90deg, var(--pd-yellow) 0 31%, #3c6d74 31% 100%); }
        .pd-timeline { display: grid; gap: 0; padding: 0 20px 12px; }
        .pd-timeline-item { display: grid; grid-template-columns: 61px 15px 1fr; gap: 12px; min-height: 61px; align-items: start; }
        .pd-timeline-time { padding-top: 19px; color: var(--pd-muted); font: 500 10px/1 var(--app-font-mono, monospace); }
        .pd-timeline-dot { position: relative; display: grid; width: 15px; height: 15px; margin-top: 16px; place-items: center; border: 3px solid var(--pd-cyan-soft); border-radius: 50%; background: var(--pd-cyan); }
        .pd-timeline-item:not(:last-child) .pd-timeline-dot::after { content: ""; position: absolute; top: 12px; width: 1px; height: 49px; background: var(--pd-line-strong); }
        .pd-timeline-item:nth-child(2) .pd-timeline-dot { background: var(--pd-yellow); border-color: var(--pd-yellow-soft); }
        .pd-timeline-item:nth-child(3) .pd-timeline-dot { background: var(--pd-mint); border-color: var(--pd-mint-soft); }
        .pd-timeline-item:last-child .pd-timeline-dot { background: var(--pd-muted); border-color: #e4ebea; }
        .pd-timeline-copy { padding: 14px 0 11px; }
        .pd-timeline-copy strong { display: block; margin-bottom: 4px; color: var(--pd-navy); font-size: 12px; }
        .pd-timeline-copy span { color: var(--pd-muted); font-size: 10px; line-height: 1.4; }
        .pd-signals-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .pd-signal-card { padding: 17px; border: 1px solid var(--pd-line); border-radius: 12px; background: var(--pd-surface); }
        .pd-signal-card-top { display: flex; align-items: center; justify-content: space-between; }
        .pd-signal-card-top svg { color: var(--pd-cyan); }
        .pd-signal-card:nth-child(2) .pd-signal-card-top svg { color: var(--pd-mint); }
        .pd-signal-card:nth-child(3) .pd-signal-card-top svg { color: #b48612; }
        .pd-signal-card strong { display: block; margin: 20px 0 5px; color: var(--pd-navy); font: 600 17px/1 var(--app-font-mono, monospace); letter-spacing: .03em; }
        .pd-signal-card label { color: var(--pd-muted); font: 500 9px/1 var(--app-font-mono, monospace); letter-spacing: .08em; text-transform: uppercase; }
        .pd-signal-card p { margin: 0; color: var(--pd-ink-soft); font-size: 11px; line-height: 1.4; }
        .pd-notes { margin-top: 19px; border: 1px solid var(--pd-line); border-radius: 10px; background: var(--pd-surface-alt); }
        .pd-notes button { display: flex; width: 100%; align-items: center; justify-content: space-between; border: 0; padding: 13px 15px; color: var(--pd-navy); background: transparent; font-size: 11px; font-weight: 700; text-align: left; }
        .pd-notes p { margin: -2px 15px 14px; color: var(--pd-ink-soft); font-size: 11px; line-height: 1.5; }
        .pd-notes svg { transition: transform .2s ease; }
        .pd-notes.is-open svg { transform: rotate(180deg); }
        .pd-lower { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
        .pd-collab-body { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: center; padding: 20px; }
        .pd-collab-list { display: grid; gap: 10px; }
        .pd-collab-row { display: flex; align-items: center; gap: 10px; color: var(--pd-ink-soft); font-size: 11px; }
        .pd-status-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--pd-mint); box-shadow: 0 0 0 4px var(--pd-mint-soft); }
        .pd-status-dot.yellow { background: var(--pd-yellow); box-shadow: 0 0 0 4px var(--pd-yellow-soft); }
        .pd-collab-clock { display: grid; width: 94px; height: 94px; place-items: center; border: 1px dashed var(--pd-line-strong); border-radius: 50%; color: var(--pd-cyan); font: 500 11px/1.4 var(--app-font-mono, monospace); text-align: center; }
        .pd-principles { padding: 20px; }
        .pd-principle { display: grid; grid-template-columns: 34px 1fr; gap: 12px; align-items: start; padding: 12px 0; border-bottom: 1px solid var(--pd-line); }
        .pd-principle:last-child { border-bottom: 0; padding-bottom: 0; }
        .pd-principle:first-child { padding-top: 0; }
        .pd-principle-number { color: var(--pd-cyan); font: 500 10px/1 var(--app-font-mono, monospace); }
        .pd-principle strong { display: block; margin-bottom: 4px; color: var(--pd-navy); font-size: 12px; }
        .pd-principle span { color: var(--pd-muted); font-size: 10px; line-height: 1.4; }
        .pd-cta { position: relative; overflow: hidden; margin-top: 75px; border-radius: 15px; padding: clamp(27px, 5vw, 48px); background: var(--pd-navy); color: #eef8f3; }
        .pd-cta::before { content: ""; position: absolute; width: 470px; height: 470px; right: -150px; top: -270px; border: 1px solid rgba(149,220,202,.3); border-radius: 50%; box-shadow: 0 0 0 30px rgba(149,220,202,.05), 0 0 0 60px rgba(149,220,202,.04); }
        .pd-cta-content { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 30px; }
        .pd-cta h2 { max-width: 620px; margin: 0; font-size: clamp(29px, 4vw, 52px); font-weight: 500; letter-spacing: -.07em; line-height: .98; }
        .pd-cta h2 em { color: var(--pd-yellow); font-style: normal; }
        .pd-cta-actions { display: grid; min-width: 210px; gap: 10px; }
        .pd-cta .pd-button-primary { color: var(--pd-navy); background: var(--pd-yellow); }
        .pd-cta .pd-button-primary:hover { background: #f6d36f; }
        .pd-cta .pd-button-secondary { border-color: rgba(221,242,234,.32); color: #e2f1eb; background: transparent; }
        .pd-cta .pd-button-secondary:hover { border-color: #b6dbca; background: rgba(220,242,233,.1); }
        .pd-footer { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 28px 0 34px; color: var(--pd-muted); font: 500 9px/1.4 var(--app-font-mono, monospace); letter-spacing: .05em; }
        .pd-footer-status { display: inline-flex; align-items: center; gap: 8px; color: var(--pd-mint); }
        .pd-footer-status span { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .pd-footer a { color: var(--pd-ink-soft); text-decoration: none; }
        .pd-footer a:hover { color: var(--pd-cyan); }
        .pd-entrance { animation: pd-entrance .55s ease both; }
        .pd-entrance-delay { animation-delay: .12s; }
        .pd-entrance-delay-2 { animation-delay: .22s; }
        @keyframes pd-entrance { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .public-dashboard *, .public-dashboard *::before, .public-dashboard *::after { animation: none !important; transition: none !important; } }
        .dark .public-dashboard {
          --pd-ink: #e3efeb;
          --pd-ink-soft: #aac1be;
          --pd-muted: #809a98;
          --pd-paper: #0c1d24;
          --pd-surface: #122a32;
          --pd-surface-alt: #17343b;
          --pd-line: #28464d;
          --pd-line-strong: #3b646b;
          --pd-navy: #d8eee7;
          --pd-cyan: #6bd1d0;
          --pd-cyan-soft: #17424a;
          --pd-yellow: #f3cc61;
          --pd-yellow-soft: #4b3c1c;
          --pd-mint: #79c99e;
          --pd-mint-soft: #1b4638;
          background: var(--pd-paper);
        }
        .dark .public-dashboard::before { background: radial-gradient(circle at 76% 7%, rgba(45,117,103,.22), transparent 24%), linear-gradient(180deg, #102f36 0%, var(--pd-paper) 82%); }
        .dark .pd-preview-ribbon, .dark .pd-button-secondary { background: rgba(18,42,50,.72); }
        .dark .pd-brand-mark { background: #153642; color: var(--pd-yellow); }
        .dark .pd-nav-link-primary, .dark .pd-button-primary { border-color: #335963; background: #153642; color: #eff8f4 !important; }
        .dark .pd-command-card, .dark .pd-cta { background: #153642; color: #eaf6f0; }
        .dark .pd-display-preview { color: #eaf6f0; }
        .dark .pd-cta .pd-button-primary { border-color: transparent; background: var(--pd-yellow); color: #153642 !important; }
        .dark .pd-brand, .dark .pd-hero h1, .dark .pd-section-heading h2, .dark .pd-panel-title h3, .dark .pd-stat strong, .dark .pd-ring-copy strong, .dark .pd-metric-row strong, .dark .pd-signal-card strong, .dark .pd-principle strong, .dark .pd-cta h2 { color: var(--pd-ink); }
        .dark .pd-ring::before { background: var(--pd-surface); }
        .dark .pd-progress { background: #29454b; }
        .dark .pd-flow-track { background: #213e45; }
        .dark .pd-stat:not(:first-child)::before, .dark .pd-timeline-item:not(:last-child) .pd-timeline-dot::after { background: var(--pd-line-strong); }
        .dark .pd-signal-card, .dark .pd-panel { box-shadow: 0 12px 28px rgba(0,0,0,.16); }
        @media (max-width: 980px) {
          .pd-shell { width: min(100% - 32px, 720px); }
          .pd-hero { grid-template-columns: 1fr; gap: 46px; padding-top: 58px; }
          .pd-hero h1 { max-width: 680px; }
          .pd-command-wrap { max-width: 720px; }
          .pd-dashboard-grid { grid-template-columns: 1fr; }
          .pd-panel-large { grid-row: auto; }
        }
        @media (max-width: 700px) {
          .pd-shell { width: min(100% - 28px, 560px); }
          .pd-nav { position: relative; justify-content: space-between; }
          .pd-nav-links { position: absolute; top: 58px; right: 0; left: 0; display: none; flex-direction: column; align-items: stretch; gap: 0; border: 1px solid var(--pd-line); border-radius: 10px; padding: 6px; background: var(--pd-surface); box-shadow: 0 15px 30px rgba(21,54,66,.14); }
          .pd-nav-links.is-open { display: flex; }
          .pd-nav-links a { padding: 12px 11px; }
          .pd-nav-link-primary { justify-content: center; margin-top: 4px; }
          .pd-menu-button { display: grid; width: 41px; height: 41px; place-items: center; border: 1px solid var(--pd-line-strong); border-radius: 8px; }
          .pd-preview-ribbon { font-size: 8px; }
          .pd-hero { padding: 50px 0 52px; }
          .pd-hero h1 { font-size: clamp(43px, 15vw, 68px); }
          .pd-hero-lede { font-size: 15px; }
          .pd-command-wrap::before, .pd-command-wrap::after { display: none; }
          .pd-card-top, .pd-card-main, .pd-card-bottom { padding-left: 16px; padding-right: 16px; }
          .pd-card-top { gap: 14px; }
          .pd-card-top h2 { font-size: 19px; }
          .pd-signal-chip { padding: 6px 7px; font-size: 8px; }
          .pd-lane-grid { gap: 6px; }
          .pd-lane { min-height: 104px; padding: 10px; }
          .pd-lane-count { margin-top: 16px; font-size: 24px; }
          .pd-stat-strip { grid-template-columns: repeat(2, 1fr); }
          .pd-stat { padding: 15px 12px 16px 0; }
          .pd-stat:not(:first-child) { padding-left: 14px; }
          .pd-stat:nth-child(3) { border-top: 1px solid var(--pd-line); }
          .pd-stat:nth-child(3)::before { top: 15px; }
          .pd-stat:nth-child(4) { border-top: 1px solid var(--pd-line); }
          .pd-stat strong { font-size: 24px; }
          .pd-content { padding: 56px 0 68px; }
          .pd-section-heading { display: block; }
          .pd-section-heading p { margin-top: 15px; }
          .pd-view-tabs { display: flex; width: 100%; }
          .pd-view-tab { flex: 1; }
          .pd-attendance-layout { grid-template-columns: 1fr; justify-items: center; }
          .pd-attendance-metrics { width: 100%; }
          .pd-lower, .pd-signals-grid { grid-template-columns: 1fr; }
          .pd-cta { margin-top: 56px; }
          .pd-cta-content { display: block; }
          .pd-cta-actions { margin-top: 25px; }
          .pd-footer { display: grid; gap: 13px; }
        }
        @media (max-width: 390px) {
          .pd-lane-label { font-size: 8px; }
          .pd-lane-state { font-size: 9px; }
          .pd-card-main-head strong { font-size: 27px; }
        }
      `}</style>

      <div className="pd-shell">
        <header className="pd-nav-wrap" data-testid="public-dashboard-header">
          <nav className="pd-nav" aria-label="Public preview navigation">
            <Link href="/" onClick={closeMenu} className="pd-brand pd-focus" data-testid="link-public-brand">
              <span className="pd-brand-mark"><CircleDot size={19} strokeWidth={2.5} /></span>
              <span className="pd-brand-copy"><strong>WOLVERINES</strong><small className="pd-mono">TEAM 23442 / CONTROL</small></span>
            </Link>
            <div className={`pd-nav-links ${menuOpen ? "is-open" : ""}`} data-testid="public-dashboard-nav-links">
              <a href="#operating-view" onClick={closeMenu} data-testid="link-operating-view">Operating view</a>
              <a href="#signals" onClick={closeMenu} data-testid="link-event-signals">Event signals</a>
              <a href="#about-preview" onClick={closeMenu} data-testid="link-about-preview">About this preview</a>
              <Link href="/interview-landing" onClick={closeMenu} className="pd-nav-link-primary pd-focus" data-testid="link-interview-entry">Interview <ArrowRight size={14} /></Link>
            </div>
            <button className="pd-menu-button pd-focus" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} data-testid="button-public-dashboard-menu">
              {menuOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </nav>
        </header>

        <div className="pd-preview-ribbon" role="note" data-testid="notice-preview-content">
          <Sparkles size={12} aria-hidden="true" /><strong>SAMPLE / PREVIEW CONTENT</strong><span>Illustrative aggregate values only · no applicant data · no live event connection</span>
        </div>

        <section className="pd-hero" aria-labelledby="public-dashboard-title">
          <div className="pd-hero-copy pd-entrance">
            <p className="pd-eyebrow"><span className="pd-pulse" /> Event operations preview <span aria-hidden="true">/</span> Sammamish, WA</p>
            <h1 id="public-dashboard-title">Make every<br /><em>handoff visible.</em></h1>
            <p className="pd-hero-lede">A robotics interview control room for Wolverines / Team 23442 — designed to keep attendance, queue movement, public instructions, and coordinators working from the same signal.</p>
            <div className="pd-hero-actions">
              <Link href="/interview-landing" className="pd-button pd-button-primary pd-focus" data-testid="link-hero-interview">Open interview preview <ArrowRight size={16} /></Link>
              <a href="#operating-view" className="pd-button pd-button-secondary pd-focus" data-testid="link-hero-operating-view">Read the operating view <ChevronRight size={16} /></a>
            </div>
            <div className="pd-hero-footnote"><ShieldCheck size={14} /><span>Public-facing preview · private coordinator workspace stays behind sign-in</span></div>
          </div>

          <div className="pd-command-wrap pd-entrance pd-entrance-delay" aria-label="Illustrative command surface">
            <div className="pd-command-card" data-testid="card-command-surface">
              <span className="pd-scanline" aria-hidden="true" />
              <div className="pd-card-top">
                <div><p className="pd-card-kicker">WOLVERINES / TEAM 23442</p><h2>Interview command surface</h2></div>
                <span className="pd-signal-chip"><span /> PREVIEW ONLINE</span>
              </div>
              <div className="pd-card-main">
                <div className="pd-card-main-head"><p>Sample room rhythm</p><strong>06 <small>in flow</small></strong></div>
                <div className="pd-lane-grid" data-testid="grid-sample-lanes">
                  {lanes.map((lane, index) => (
                    <div className={`pd-lane tone-${lane.tone} ${previewStep === index ? "is-active" : ""}`} key={lane.label} data-testid={`card-sample-lane-${index + 1}`}>
                      <div className="pd-lane-label"><span />{lane.label}</div>
                      <strong className="pd-lane-count">{lane.count}</strong>
                      <small className="pd-lane-state">{lane.state}</small>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pd-card-bottom"><span><Radio size={12} /> <b>Room signal:</b> steady</span><span>08:42 LOCAL / SAMPLE</span></div>
            </div>
          </div>
        </section>

        <section className="pd-stat-strip" aria-label="Sample preview metrics" data-testid="section-sample-metrics">
          <div className="pd-stat" data-testid="metric-sample-arrivals"><span className="pd-stat-label">Sample arrivals</span><strong>18 / 24</strong><small>Illustrative check-in pulse</small></div>
          <div className="pd-stat" data-testid="metric-sample-lanes"><span className="pd-stat-label">Interview lanes</span><strong>03</strong><small>Room assignments visible</small></div>
          <div className="pd-stat" data-testid="metric-sample-handoffs"><span className="pd-stat-label">Shared handoffs</span><strong>1 view</strong><small>Coordinator source of truth</small></div>
          <div className="pd-stat" data-testid="metric-sample-privacy"><span className="pd-stat-label">Public exposure</span><strong>0 names</strong><small>Aggregate preview only</small></div>
        </section>

        <section className="pd-content" id="operating-view" aria-labelledby="operating-view-title">
          <div className="pd-section-heading">
            <div><p className="pd-eyebrow">The operating view</p><h2 id="operating-view-title">A room that knows what happens next.</h2></div>
            <p>Built for event-day decisions: see the pulse, make the next move, and keep the public instruction clear.</p>
          </div>

          <div className="pd-view-tabs" role="tablist" aria-label="Preview dashboard views" data-testid="tabs-dashboard-views">
            <button type="button" className={`pd-view-tab pd-focus ${viewMode === "overview" ? "is-active" : ""}`} onClick={() => setViewMode("overview")} role="tab" aria-selected={viewMode === "overview"} data-testid="tab-overview">Overview</button>
            <button type="button" className={`pd-view-tab pd-focus ${viewMode === "flow" ? "is-active" : ""}`} onClick={() => setViewMode("flow")} role="tab" aria-selected={viewMode === "flow"} data-testid="tab-flow">Flow map</button>
            <button type="button" className={`pd-view-tab pd-focus ${viewMode === "signals" ? "is-active" : ""}`} onClick={() => setViewMode("signals")} role="tab" aria-selected={viewMode === "signals"} data-testid="tab-signals">Signals</button>
          </div>

          {viewMode === "signals" ? (
            <div className="pd-signals-grid pd-entrance" role="tabpanel" data-testid="panel-signals-view">
              {signals.map((signal, index) => {
                const SignalIcon = signal.icon;
                return <article className="pd-signal-card" key={signal.label} data-testid={`card-signal-${index + 1}`}><div className="pd-signal-card-top"><label>{signal.label}</label><SignalIcon size={17} /></div><strong>{signal.value}</strong><p>{signal.detail}</p></article>;
              })}
            </div>
          ) : (
            <div className="pd-dashboard-grid pd-entrance" role="tabpanel" data-testid={`panel-${viewMode}-view`}>
              <article className="pd-panel pd-panel-large" data-testid="card-attendance-pulse">
                <div className="pd-panel-header">
                  <div className="pd-panel-title"><span className="pd-panel-icon"><UsersRound size={16} /></span><div><h3>Attendance pulse</h3><p>Know the room before the next call.</p></div></div>
                  <span className="pd-panel-meta">SAMPLE / 08:42</span>
                </div>
                <div className="pd-panel-body">
                  <div className="pd-attendance-layout">
                    <div className="pd-ring" aria-label="Illustrative attendance progress, 75 percent"><div className="pd-ring-copy"><strong>75%</strong><span>sample checked in</span></div></div>
                    <div className="pd-attendance-metrics">
                      <div className="pd-metric-row"><span>Illustrative checked in</span><strong>18</strong></div>
                      <div className="pd-metric-row"><span>Illustrative expected</span><strong>24</strong></div>
                      <div className="pd-metric-row"><span>Next room handoff</span><strong>09:05</strong></div>
                      <div className="pd-progress" aria-hidden="true"><i /></div>
                      <div className="pd-mini-caption"><span>Arrival desk</span><span>Sample progress</span></div>
                    </div>
                  </div>
                  <div className="pd-notes">
                    <button type="button" onClick={() => setNotesOpen((open) => !open)} aria-expanded={notesOpen} className="pd-focus" data-testid="button-preview-notes"><span>Why this view matters</span><ChevronRight size={15} /></button>
                    {notesOpen && <p data-testid="text-preview-notes">The public preview shows only aggregate signals. A live coordinator uses the private workspace for individual decisions; this surface keeps the event rhythm legible without exposing people.</p>}
                  </div>
                </div>
              </article>

              <article className="pd-panel" data-testid="card-queue-flow">
                <div className="pd-panel-header"><div className="pd-panel-title"><span className="pd-panel-icon yellow"><Rows3 size={16} /></span><div><h3>Queue flow</h3><p>Movement by illustrative lane.</p></div></div><span className="pd-panel-meta">SAMPLE</span></div>
                <div className="pd-panel-body">
                  <div className="pd-flow-list">
                    <div className="pd-flow-row"><span className="pd-flow-number">01</span><span className="pd-flow-track"><i style={{ width: "82%" }} /></span><span className="pd-flow-state">Moving</span></div>
                    <div className="pd-flow-row"><span className="pd-flow-number">02</span><span className="pd-flow-track"><i style={{ width: "61%" }} /></span><span className="pd-flow-state">Ready</span></div>
                    <div className="pd-flow-row"><span className="pd-flow-number">03</span><span className="pd-flow-track"><i style={{ width: "44%" }} /></span><span className="pd-flow-state">Next</span></div>
                  </div>
                  {viewMode === "flow" && <button type="button" className="pd-button pd-button-secondary pd-focus" onClick={advancePreview} style={{ width: "100%", marginTop: "18px" }} data-testid="button-simulate-handoff"><Activity size={14} /> Simulate next sample handoff</button>}
                </div>
              </article>

              <article className="pd-panel" data-testid="card-public-display">
                <div className="pd-panel-header"><div className="pd-panel-title"><span className="pd-panel-icon mint"><Monitor size={16} /></span><div><h3>Public display</h3><p>One instruction. Everyone aligned.</p></div></div><span className="pd-panel-meta">VISIBLE</span></div>
                <div className="pd-panel-body">
                  <div className="pd-display-preview">
                    <div className="pd-display-top"><span><Radio size={11} /> PUBLIC DISPLAY</span><span>PREVIEW</span></div>
                    <div className="pd-display-message"><small>Next instruction</small><strong>Proceed to your lane</strong><p>Sample direction for event-day flow</p></div>
                    <div className="pd-display-bar" />
                  </div>
                </div>
              </article>
            </div>
          )}

          <div className="pd-lower">
            <article className="pd-panel" data-testid="card-collaboration-signal">
              <div className="pd-panel-header"><div className="pd-panel-title"><span className="pd-panel-icon"><MessageSquare size={16} /></span><div><h3>Coordinator collaboration</h3><p>A shared rhythm without radio chatter.</p></div></div><span className="pd-panel-meta">SAMPLE</span></div>
              <div className="pd-collab-body">
                <div className="pd-collab-list">
                  <div className="pd-collab-row"><span className="pd-status-dot" /> Front desk signal is steady</div>
                  <div className="pd-collab-row"><span className="pd-status-dot yellow" /> Interview lead has the next move</div>
                  <div className="pd-collab-row"><span className="pd-status-dot" /> Shared display is aligned</div>
                </div>
                <div className="pd-collab-clock"><Clock3 size={16} /><span>08:42<br />LOCAL</span></div>
              </div>
            </article>

            <article className="pd-panel" data-testid="card-operating-principles">
              <div className="pd-panel-header"><div className="pd-panel-title"><span className="pd-panel-icon yellow"><SlidersHorizontal size={16} /></span><div><h3>Operating principles</h3><p>The product stays close to the room.</p></div></div></div>
              <div className="pd-principles">
                <div className="pd-principle"><span className="pd-principle-number">01</span><div><strong>Next useful action</strong><span>No hunting across tabs when the room gets busy.</span></div></div>
                <div className="pd-principle"><span className="pd-principle-number">02</span><div><strong>Public by design, private by default</strong><span>Shared instructions never need individual details.</span></div></div>
                <div className="pd-principle"><span className="pd-principle-number">03</span><div><strong>Human decisions first</strong><span>Tools support the team’s judgment, not the other way around.</span></div></div>
              </div>
            </article>
          </div>

          <section id="signals" className="pd-panel" style={{ marginTop: "16px" }} aria-labelledby="timeline-title" data-testid="card-sample-timeline">
            <div className="pd-panel-header"><div className="pd-panel-title"><span className="pd-panel-icon"><Gauge size={16} /></span><div><h3 id="timeline-title">Sample event timeline</h3><p>A presentation-only rhythm for the interview day.</p></div></div><span className="pd-panel-meta"><MapPin size={11} /> PLMS / SAMPLE</span></div>
            <div className="pd-timeline">
              {timeline.map((item, index) => <div className="pd-timeline-item" key={item.time} data-testid={`timeline-item-${index + 1}`}><span className="pd-timeline-time">{item.time}</span><span className="pd-timeline-dot" /><div className="pd-timeline-copy"><strong>{item.label}</strong><span>{item.detail}</span></div></div>)}
            </div>
          </section>

          <section className="pd-cta" id="about-preview" aria-labelledby="cta-title" data-testid="section-dashboard-cta">
            <div className="pd-cta-content">
              <div><p className="pd-eyebrow" style={{ color: "#8dd3ca" }}>Ready for the real room?</p><h2 id="cta-title">See the interview flow <em>up close.</em></h2></div>
              <div className="pd-cta-actions">
                <Link href="/interview-landing" className="pd-button pd-button-primary pd-focus" data-testid="link-cta-interview">Open Interview <ArrowRight size={15} /></Link>
                <Link href="/auth" className="pd-button pd-button-secondary pd-focus" data-testid="link-coordinator-sign-in"><LockKeyhole size={14} /> Coordinator sign-in</Link>
              </div>
            </div>
          </section>
        </section>

        <footer className="pd-footer" data-testid="public-dashboard-footer">
          <span>WOLVERINES / TEAM 23442 · PUBLIC PREVIEW</span>
          <span className="pd-footer-status"><span /> PRESENTATION MODE · NO LIVE DATA</span>
          <Link href="/interview-landing" className="pd-focus" data-testid="link-footer-interview">Interview entry <ChevronRight size={12} /></Link>
        </footer>
      </div>
    </main>
  );
}