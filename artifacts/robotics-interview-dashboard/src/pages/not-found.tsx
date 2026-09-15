import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  CircleDot,
  ClipboardList,
  LayoutDashboard,
  Monitor,
  Radar,
  UsersRound,
} from "lucide-react";

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

export default function NotFound() {
  const [location] = useLocation();
  const attempted = location || "/";

  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = "/dashboard";
  };

  return (
    <main
      className="noise relative flex min-h-[100dvh] overflow-hidden bg-[#172a3a] text-white"
      data-testid="page-not-found"
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
              Signal lost · 404
            </span>
          </div>

          <div className="fade-up">
            <p className="mono mb-5 text-xs uppercase tracking-[.28em] text-[#f8c84a]">
              Error 404 — off the field
            </p>
            <h1 className="max-w-xl text-7xl font-semibold leading-[.92] tracking-[-.05em] xl:text-[7.5rem]">
              Dropped
              <br />
              out of <span className="text-[#f8c84a]">queue.</span>
            </h1>
            <p className="mt-7 max-w-md text-lg leading-7 text-[#abc0c7]">
              This bay was never staged. The robot looked here, found no game
              piece, and kept driving.
            </p>

            {/* telemetry readout */}
            <div className="mt-9 max-w-md overflow-hidden rounded-2xl border border-[#365161] bg-[#1d3545]/90">
              <div className="flex items-center gap-2 border-b border-[#365161]/70 px-4 py-2.5">
                <Radar size={14} className="text-[#f8c84a]" />
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
                    title={attempted}
                  >
                    {attempted}
                  </dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 uppercase tracking-[.18em] text-[#617d86]">
                    Status
                  </dt>
                  <dd className="text-[#f8c84a]">404 · NO_ROUTE</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 uppercase tracking-[.18em] text-[#617d86]">
                    Fix
                  </dt>
                  <dd className="text-[#abc0c7]">
                    Rejoin the control room — nothing was deleted.
                  </dd>
                </div>
              </dl>
              {/* scanline flourish */}
              <div className="relative h-px overflow-hidden bg-[#365161]/60">
                <div className="scanline absolute inset-y-0 w-1/3 bg-[#f8c84a]/70" />
              </div>
            </div>
          </div>

          <div className="mono flex flex-wrap gap-3 text-[10px] uppercase tracking-[.2em] text-[#76929c]">
            <span>Wolverines / Team 23442</span>
            <span>·</span>
            <span>All claws on deck!</span>
            <span>·</span>
            <span>PLMS · Sammamish, WA</span>
          </div>
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
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#dff4f2] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[.08em] text-[#12737d]">
              <Bot size={13} />
              Route not found
            </span>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-.05em]">
              This bay doesn&rsquo;t exist.
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#63747c]">
              There&rsquo;s nothing staged at{" "}
              <code
                className="mono break-all rounded bg-[#e6edec] px-1.5 py-0.5 text-[12px] text-[#315a61]"
                data-testid="text-attempted-path-inline"
              >
                {attempted}
              </code>
              . Check the path, or hop back to where the event is live.
            </p>

            <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/dashboard"
                data-testid="button-back-dashboard"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#16869a] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#106d7a]"
              >
                Back to control room <ArrowRight size={16} />
              </Link>
              <button
                onClick={goBack}
                data-testid="button-go-back"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#cbd7da] bg-white px-4 py-3.5 text-sm font-semibold text-[#38555e] transition hover:border-[#16869a] hover:text-[#16869a]"
              >
                <ArrowLeft size={16} /> Go back
              </button>
            </div>

            <p className="mono mt-8 mb-3 text-[10px] uppercase tracking-[.22em] text-[#16869a]">
              Or jump to
            </p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {QUICK_LINKS.map(({ href, label, detail, icon: Icon, testId }) => (
                <Link
                  key={href}
                  href={href}
                  data-testid={testId}
                  className="group flex items-center gap-3 rounded-xl border border-[#dce5e5] bg-white p-3.5 shadow-[0_3px_12px_rgba(26,49,60,.04)] transition hover:border-[#16869a]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#edf4f3] text-[#16869a] transition group-hover:bg-[#16869a] group-hover:text-white">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <b className="block truncate text-sm">{label}</b>
                    <small className="block truncate text-xs text-[#7c8c91]">
                      {detail}
                    </small>
                  </span>
                </Link>
              ))}
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
              Wolverines · Team 23442 — nothing lost, rejoin the pit
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
