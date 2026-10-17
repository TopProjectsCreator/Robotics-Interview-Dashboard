import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CircleDot,
  ClipboardList,
  ClipboardX,
  Construction,
  Fingerprint,
  Gauge,
  LayoutDashboard,
  Monitor,
  Radar,
  ServerCrash,
  ShieldX,
  TimerReset,
  UsersRound,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import type { ErrorFallbackProps } from "@/components/error-boundary";

export interface ErrorPageConfig {
  code: number;
  signalLabel: string;
  eyebrow: string;
  headlineA: string;
  headlineB: string;
  tagline: string;
  status: string;
  fix: string;
  icon: LucideIcon;
  accent: string;
  chip: string;
  panelTitle: string;
  panelBody: string;
  footerLine: string;
  lightFooter: string;
}

const QUICK_LINKS = [
  {
    href: "/dashboard",
    label: "Overview",
    detail: "Live totals & signal",
    icon: LayoutDashboard,
    testId: "link-404-overview",
  },
  {
    href: "/applicants",
    label: "Applicants",
    detail: "Rank & review",
    icon: UsersRound,
    testId: "link-404-applicants",
  },
  {
    href: "/queue",
    label: "Interview queue",
    detail: "Who is on deck",
    icon: ClipboardList,
    testId: "link-404-queue",
  },
  {
    href: "/assistant",
    label: "AI assistant",
    detail: "Ask the roster",
    icon: Bot,
    testId: "link-404-assistant",
  },
] as const;

export const ERROR_PAGES: Record<number, ErrorPageConfig> = {
  400: {
    code: 400,
    signalLabel: "Signal lost · 400",
    eyebrow: "Error 400 — garbled packet",
    headlineA: "Malformed",
    headlineB: "command.",
    tagline:
      "The robot heard a command it couldn’t parse — wrong field, wrong bits. Nothing was executed, so nothing was lost.",
    status: "400 · BAD_PACKET",
    fix: "Re-drive the request with valid fields.",
    icon: ClipboardX,
    accent: "#51d2ad",
    chip: "Bad request",
    panelTitle: "The play call was garbled.",
    panelBody:
      "Your request didn’t match the rules. Check the required fields and retransmit — the robot is still warmed up.",
    footerLine:
      "Robotics team workspace · Garbled packet dropped",
    lightFooter: "Team workspace — re-run the play, nothing was lost",
  },
  401: {
    code: 401,
    signalLabel: "Access denied · 401",
    eyebrow: "Error 401 — badge not scanned",
    headlineA: "Pit gate",
    headlineB: "locked.",
    tagline:
      "No credentials on this badge. Scan in with the admin passcode before your robot rolls into the bay.",
    status: "401 · NO_CREDENTIALS",
    fix: "Sign in from the control room, then retry.",
    icon: Fingerprint,
    accent: "#f8c84a",
    chip: "Authentication required",
    panelTitle: "Not signed in yet.",
    panelBody:
      "This bay needs a pit pass. Head to the control room, sign in, and the route will open right up.",
    footerLine:
      "Robotics team workspace · Badge not scanned",
    lightFooter: "Team workspace — scan in and rejoin the field",
  },
  403: {
    code: 403,
    signalLabel: "Access denied · 403",
    eyebrow: "Error 403 — off-limits bay",
    headlineA: "This bay is",
    headlineB: "off-limits.",
    tagline:
      "The robot tried an alliance station it isn’t cleared for. The route number doesn’t match your access level.",
    status: "403 · FORBIDDEN_BAY",
    fix: "Ask an admin to unlock this area.",
    icon: ShieldX,
    accent: "#f0564a",
    chip: "Access denied",
    panelTitle: "The rulebook says no.",
    panelBody:
      "Even signed in, this zone is restricted. Grab an admin to open it up for you.",
    footerLine:
      "Robotics team workspace · Restricted bay",
    lightFooter: "Team workspace — restricted zone, get an admin",
  },
  404: {
    code: 404,
    signalLabel: "Signal lost · 404",
    eyebrow: "Error 404 — off the field",
    headlineA: "Dropped",
    headlineB: "out of queue.",
    tagline:
      "This bay was never staged. The robot looked here, found no game piece, and kept driving.",
    status: "404 · NO_ROUTE",
    fix: "Rejoin the control room — nothing was deleted.",
    icon: Radar,
    accent: "#f8c84a",
    chip: "Route not found",
    panelTitle: "This bay doesn’t exist.",
    panelBody:
      "There’s nothing staged at {{path}}. Check the path, or hop back to where the event is live.",
    footerLine:
      "Robotics team workspace · All systems ready",
    lightFooter: "Team workspace — nothing lost, rejoin the workspace",
  },
  429: {
    code: 429,
    signalLabel: "Throttled · 429",
    eyebrow: "Error 429 — too fast",
    headlineA: "Too fast,",
    headlineB: "driver.",
    tagline:
      "You spooled the robot up faster than the field controller can process. Park it on the bench and wait for the green light.",
    status: "429 · RATE_LIMITED",
    fix: "Cool down a few seconds and retry.",
    icon: Gauge,
    accent: "#5ab1e0",
    chip: "Throttled",
    panelTitle: "The queue is full.",
    panelBody:
      "You’re pinging faster than the controller can answer. Back off briefly, then retry the same route.",
    footerLine:
      "Robotics team workspace · Request queue full",
    lightFooter: "Team workspace — breathe, then re-queue",
  },
  500: {
    code: 500,
    signalLabel: "Field fault · 500",
    eyebrow: "Error 500 — servo fault",
    headlineA: "Drive train",
    headlineB: "faulted.",
    tagline:
      "The robot threw a runtime fault mid-match. The driver station is still powered — the pit crew is pulling the logs.",
    status: "500 · SERVO_FAULT",
    fix: "Pit crew notified — retry in a moment.",
    icon: ServerCrash,
    accent: "#f0564a",
    chip: "Internal error",
    panelTitle: "The robot wants a pit stop.",
    panelBody:
      "Something inside the control loop broke. Hit retry, or head back to the control room while we clear the fault.",
    footerLine:
      "Robotics team workspace · Fault codes pulled",
    lightFooter: "Team workspace — support is on it, back shortly",
  },
  502: {
    code: 502,
    signalLabel: "Field fault · 502",
    eyebrow: "Error 502 — link lost mid-packet",
    headlineA: "Field link",
    headlineB: "broken.",
    tagline:
      "The robot’s radio lost its bridge to the field control system. The switch heard static instead of the next match packet.",
    status: "502 · LINK_DOWN",
    fix: "Relay is resetting — hold position.",
    icon: WifiOff,
    accent: "#9f7ae8",
    chip: "Bad gateway",
    panelTitle: "Bridge to the field dropped.",
    panelBody:
      "The relay between you and the control system is down. Give it a second and retry the same packet.",
    footerLine:
      "Robotics team workspace · Network relay resetting",
    lightFooter: "Team workspace — relay back up soon, hold position",
  },
  503: {
    code: 503,
    signalLabel: "Field fault · 503",
    eyebrow: "Error 503 — maintenance stop",
    headlineA: "Pit lane",
    headlineB: "down.",
    tagline:
      "The pits are in a scheduled maintenance stop. All robots park in the queue until the stations power back up.",
    status: "503 · MAINTENANCE",
    fix: "Back soon — the match schedule resumes shortly.",
    icon: Construction,
    accent: "#e09a4e",
    chip: "Unavailable",
    panelTitle: "Maintenance stop in progress.",
    panelBody:
      "The service is intentionally offline for a pit stop. It should be back on the next match poll.",
    footerLine:
      "Robotics team workspace · Returning after maintenance",
    lightFooter: "Team workspace — maintenance break, back shortly",
  },
  504: {
    code: 504,
    signalLabel: "Field fault · 504",
    eyebrow: "Error 504 — ping dropped",
    headlineA: "No answer",
    headlineB: "from the field.",
    tagline:
      "The field controller waited past its timeout and never got a reply. The link is up — the robot just isn’t answering.",
    status: "504 · PING_TIMEOUT",
    fix: "Wake the robot and hit retry.",
    icon: TimerReset,
    accent: "#e8765e",
    chip: "Gateway timeout",
    panelTitle: "Nobody answered the ping.",
    panelBody:
      "The relay answered but the robot didn’t. Try again — sometimes the bot just needs a tap.",
    footerLine:
      "Robotics team workspace · Ping timed out",
    lightFooter: "Team workspace — nudge the bot and retry",
  },
};

export function isErrorPageCode(
  code: number,
): code is keyof typeof ERROR_PAGES {
  return code in ERROR_PAGES;
}

function Mark() {
  return (
    <div className="flex items-center gap-2.5" data-testid="brand-robotics">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#f8c84a] text-[#182232]">
        <CircleDot size={20} strokeWidth={2.4} />
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-current" />
      </span>
      <span className="leading-none text-white">
        <b className="block text-[15px] tracking-[.18em]">ROBOTICS</b>
        <small className="mono text-[9px] uppercase tracking-[.3em] opacity-60">
          Tryout control
        </small>
      </span>
    </div>
  );
}

interface ErrorStatePageProps {
  config: ErrorPageConfig;
  target: string;
  retry?: () => void;
}

function ErrorStatePage({ config, target, retry }: ErrorStatePageProps) {
  const {
    signalLabel,
    eyebrow,
    headlineA,
    headlineB,
    tagline,
    status,
    fix,
    icon: Icon,
    accent,
    chip,
    panelTitle,
    panelBody,
    footerLine,
    lightFooter,
  } = config;

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = "/dashboard";
  };

  return (
    <main
      className="noise relative flex min-h-[100dvh] overflow-hidden bg-[#172a3a] text-white"
      data-testid="page-error-state"
    >
      {/* decorative rings — same language as the login hero */}
      <div className="pointer-events-none absolute -right-40 -top-40 h-[680px] w-[680px] rounded-full border border-[#387182]/30" />
      <div className="pointer-events-none absolute -right-20 -top-20 h-[440px] w-[440px] rounded-full border border-[#387182]/30" />
      <div className="pointer-events-none absolute -bottom-56 -left-56 h-[560px] w-[560px] rounded-full border border-[#387182]/20" />

      <div className="relative z-10 grid w-full lg:grid-cols-[1fr_520px]">
        {/* ---- dark field side ---- */}
        <section className="hidden flex-col justify-between p-12 lg:flex xl:p-16">
          <div className="flex items-center justify-between">
            <Mark />
            <span className="mono inline-flex items-center gap-2 rounded-full border border-[#365161] bg-[#1d3545] px-3 py-1.5 text-[10px] uppercase tracking-[.2em] text-[#87a3ac]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#f0564a]" />
              {signalLabel}
            </span>
          </div>

          <div className="fade-up">
            <p
              className="mono mb-5 text-xs uppercase tracking-[.28em]"
              style={{ color: accent }}
            >
              {eyebrow}
            </p>
            <h1 className="max-w-xl text-7xl font-semibold leading-[.92] tracking-[-.05em] xl:text-[7.5rem]">
              {headlineA}
              <br />
              <span style={{ color: accent }}>{headlineB}</span>
            </h1>
            <p className="mt-7 max-w-md text-lg leading-7 text-[#abc0c7]">
              {tagline}
            </p>

            {/* telemetry readout */}
            <div className="mt-9 max-w-md overflow-hidden rounded-2xl border border-[#365161] bg-[#1d3545]/90">
              <div className="flex items-center gap-2 border-b border-[#365161]/70 px-4 py-2.5">
                <Icon size={14} style={{ color: accent }} />
                <span className="mono text-[10px] uppercase tracking-[.22em] text-[#78949d]">
                  Telemetry // last ping
                </span>
                <span className="mono ml-auto text-[10px] text-[#51d2ad]">
                  ● live
                </span>
              </div>
              <dl className="mono space-y-2 px-4 py-4 text-[11px] leading-5">
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 uppercase tracking-[.18em] text-[#617d86]">
                    Target
                  </dt>
                  <dd
                    className="min-w-0 flex-1 truncate text-[#e8f1f2]"
                    data-testid="text-attempted-path"
                    title={target}
                  >
                    {target}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 uppercase tracking-[.18em] text-[#617d86]">
                    Status
                  </dt>
                  <dd style={{ color: accent }}>{status}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 uppercase tracking-[.18em] text-[#617d86]">
                    Fix
                  </dt>
                  <dd className="text-[#abc0c7]">{fix}</dd>
                </div>
              </dl>
              {/* scanline flourish */}
              <div className="relative h-px overflow-hidden bg-[#365161]/60">
                <div
                  className="scanline absolute inset-y-0 w-1/3"
                  style={{ background: `${accent}b3` }}
                />
              </div>
            </div>
          </div>

          <p className="mono text-[10px] uppercase tracking-[.2em] text-[#76929c]">
            {footerLine}
          </p>
        </section>

        {/* ---- light recovery panel ---- */}
        <section className="flex flex-col justify-center bg-[#f3f6f5] px-7 py-12 text-[#182232] sm:px-12">
          <div className="mb-10 lg:hidden">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#163247] text-[#f8c84a]">
                <CircleDot size={20} strokeWidth={2.4} />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-current" />
              </span>
              <span className="leading-none text-[#182232]">
                <b className="block text-[15px] tracking-[.18em]">ROBOTICS</b>
                <small className="mono text-[9px] uppercase tracking-[.3em] opacity-60">
                  Tryout control
                </small>
              </span>
            </div>
          </div>

          <div className="fade-up mx-auto w-full max-w-[400px]">
            <span className="mono inline-flex items-center gap-1.5 rounded-full bg-[#dff4f2] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.08em] text-[#12737d]">
              {chip}
            </span>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-.05em]">
              {panelTitle}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#63747c]">
              {panelBody.split("{{path}}").map((part, i) => (
                <span key={i}>
                  {i > 0 && target ? (
                    <code
                      className="mono break-all rounded bg-[#e6edec] px-1.5 py-0.5 text-[12px] text-[#315a61]"
                      data-testid="text-attempted-path-inline"
                    >
                      {target}
                    </code>
                  ) : null}
                  {part}
                </span>
              ))}
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/dashboard"
                data-testid="button-back-dashboard"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#16869a] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#106d7a]"
              >
                Back to control room <ArrowRight size={16} />
              </Link>
              {retry ? (
                <button
                  onClick={retry}
                  data-testid="button-reload"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#cbd7da] bg-white px-4 py-3.5 text-sm font-semibold text-[#38555e] transition hover:border-[#16869a] hover:text-[#16869a]"
                >
                  <ArrowLeft size={16} /> Try again
                </button>
              ) : (
                <button
                  onClick={goBack}
                  data-testid="button-go-back"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#cbd7da] bg-white px-4 py-3.5 text-sm font-semibold text-[#38555e] transition hover:border-[#16869a] hover:text-[#16869a]"
                >
                  <ArrowLeft size={16} /> Go back
                </button>
              )}
            </div>

            <p className="mono mt-8 mb-3 text-[10px] uppercase tracking-[.22em] text-[#16869a]">
              Or jump to
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {QUICK_LINKS.map(
                ({ href, label, detail, icon: QuickIcon, testId }) => (
                  <Link
                    key={href}
                    href={href}
                    data-testid={testId}
                    className="group flex items-center gap-3 rounded-xl border border-[#dce5e5] bg-white p-3.5 shadow-[0_3px_12px_rgba(26,49,60,.04)] transition hover:border-[#16869a]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf4f3] text-[#16869a] transition group-hover:bg-[#16869a] group-hover:text-white">
                      <QuickIcon size={17} />
                    </span>
                    <span className="min-w-0 leading-tight">
                      <b className="block truncate text-sm">{label}</b>
                      <small className="block truncate text-xs text-[#7c8c91]">
                        {detail}
                      </small>
                    </span>
                  </Link>
                ),
              )}
            </div>

            <Link
              href="/display"
              data-testid="link-404-display"
              className="mt-2.5 flex items-center gap-3 rounded-xl border border-dashed border-[#b9d2d0] bg-[#eaf7f5]/60 p-3.5 text-sm transition hover:border-[#16869a]"
            >
              <Monitor size={17} className="shrink-0 text-[#16869a]" />
              <span className="text-[13px] leading-5 text-[#38555e]">
                Looking for the big screen?{" "}
                <b className="font-semibold text-[#12737d]">
                  The waiting-room display is still live.
                </b>
              </span>
            </Link>

            <p className="mono mt-8 border-t border-[#d7e0e0] pt-4 text-[10px] uppercase tracking-[.2em] text-[#8a999d]">
              {lightFooter}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

interface ErrorPageProps {
  code: number;
  target?: string;
  retry?: () => void;
}

export default function ErrorPage({ code, target, retry }: ErrorPageProps) {
  const config = ERROR_PAGES[code];
  if (!config) {
    return <NotFound />;
  }
  return (
    <ErrorStatePage
      config={config}
      target={target ?? `/${code}`}
      retry={retry}
    />
  );
}

export function NotFound() {
  const [location] = useLocation();
  const attempted = location || "/";
  return <ErrorStatePage config={ERROR_PAGES[404]} target={attempted} />;
}

export function CrashFallback({ error, resetError }: ErrorFallbackProps) {
  return (
    <ErrorStatePage
      config={ERROR_PAGES[500]}
      target={error.message || "Unhandled render error"}
      retry={resetError}
    />
  );
}
